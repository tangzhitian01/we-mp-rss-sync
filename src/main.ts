import { Plugin, Notice, PluginSettingTab, Setting, App, TFile } from 'obsidian';
import { Database, Article, Feed, DatabaseConfig } from './Database';
import { ObsidianWriter } from './ObsidianWriter';
import { DBGPTClient, DBGPTConfig } from './DBGPTClient';
import { SyncEngine, SyncState, SyncResult } from './SyncEngine';

interface WeMPRSSSyncSettings {
  // Database settings
  dbType: 'mysql' | 'postgresql' | 'supabase' | 'doris' | 'sqlite';
  dbHost: string;
  dbPort: number;
  dbUser: string;
  dbPassword: string;
  dbName: string;
  sqlitePath: string;
  sqliteUseDocker: boolean;
  dockerContainer: string;
  supabaseProjectRef: string;
  supabaseApiKey: string;

  // Sync settings
  vaultPath: string;
  feedIds: string[];
  autoSync: boolean;
  syncIntervalMinutes: number;
  batchSize: number;

  // DB-GPT settings
  dbgptEnabled: boolean;
  dbgptApiUrl: string;
  dbgptSpaceName: string;
  dbgptApiKey: string;
}

const DEFAULT_SETTINGS: WeMPRSSSyncSettings = {
  dbType: 'mysql',
  dbHost: 'localhost',
  dbPort: 3306,
  dbUser: 'rss_user',
  dbPassword: 'pass123456',
  dbName: 'we_mp_rss',
  sqlitePath: '/data/we_mp_rss.db',
  sqliteUseDocker: true,
  dockerContainer: 'we-mp-rss-backend-dev',
  supabaseProjectRef: '',
  supabaseApiKey: '',
  vaultPath: 'WeChat-Articles',
  feedIds: [],
  autoSync: false,
  syncIntervalMinutes: 30,
  batchSize: 100,
  dbgptEnabled: false,
  dbgptApiUrl: 'http://127.0.0.1:5670',
  dbgptSpaceName: 'we_mp_rss',
  dbgptApiKey: ''
};

export default class WeMPRSSSyncPlugin extends Plugin {
  settings!: WeMPRSSSyncSettings;
  private intervalId: NodeJS.Timeout | null = null;
  private syncEngine: SyncEngine | null = null;
  private feeds: Feed[] = [];

  async onload() {
    console.log('[We-MP-RSS Sync] Plugin loaded');

    await this.loadSettings();
    this.addSettingTab(new WeMPRSSSyncSettingsTab(this.app, this));

    // Register commands
    this.addCommand({
      id: 'sync-now',
      name: 'Sync articles now',
      callback: () => this.syncNow()
    });

    this.addCommand({
      id: 'sync-all-feeds',
      name: 'Sync all feeds',
      callback: () => this.syncAll()
    });

    this.addCommand({
      id: 'force-sync-all',
      name: 'Force sync all articles (ignore incremental state)',
      callback: () => this.forceSyncAll()
    });

    this.addCommand({
      id: 'test-connection',
      name: 'Test database connection',
      callback: () => this.testConnection()
    });

    // Start auto-sync if enabled
    if (this.settings.autoSync && this.settings.syncIntervalMinutes > 0) {
      this.startAutoSync();
    }
  }

  onunload() {
    console.log('[We-MP-RSS Sync] Plugin unloaded');
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    if (this.syncEngine) {
      this.syncEngine.close();
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

    // Auto-detect vault path if empty
    if (!this.settings.vaultPath) {
      this.settings.vaultPath = this.getVaultPath();
      await this.saveSettings();
    }
  }

  async saveSettings() {
    await this.saveData(this.settings);
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    if (this.settings.autoSync && this.settings.syncIntervalMinutes > 0) {
      this.startAutoSync();
    }
    // Update sync engine config
    this.updateSyncEngine();
  }

  private getVaultPath(): string {
    return (this.app.vault.adapter as any).basePath || 'WeChat-Articles';
  }

  private getDbConfig(): DatabaseConfig {
    return {
      dbType: this.settings.dbType,
      dbHost: this.settings.dbHost,
      dbPort: this.settings.dbPort,
      dbUser: this.settings.dbUser,
      dbPassword: this.settings.dbPassword,
      dbName: this.settings.dbName,
      sqlitePath: this.settings.sqlitePath,
      sqliteUseDocker: this.settings.sqliteUseDocker,
      dockerContainer: this.settings.dockerContainer,
      supabaseProjectRef: this.settings.supabaseProjectRef,
      supabaseApiKey: this.settings.supabaseApiKey
    };
  }

  private getDbgptConfig(): DBGPTConfig {
    return {
      enabled: this.settings.dbgptEnabled,
      apiUrl: this.settings.dbgptApiUrl,
      spaceName: this.settings.dbgptSpaceName,
      apiKey: this.settings.dbgptApiKey
    };
  }

  private updateSyncEngine(): void {
    if (this.syncEngine) {
      this.syncEngine.close();
    }
    this.syncEngine = new SyncEngine(
      this.app,
      this.getDbConfig(),
      this.getDbgptConfig(),
      this.settings.vaultPath
    );
  }

  private startAutoSync() {
    const intervalMs = this.settings.syncIntervalMinutes * 60 * 1000;
    this.intervalId = setInterval(() => this.syncNow(), intervalMs);
    console.log(`[We-MP-RSS Sync] Auto-sync enabled: every ${this.settings.syncIntervalMinutes} minutes`);
  }

  private async getSyncEngine(): Promise<SyncEngine> {
    if (!this.syncEngine) {
      this.updateSyncEngine();
    }
    await this.syncEngine!.testDatabaseConnection();
    return this.syncEngine!;
  }

  async syncNow(): Promise<void> {
    new Notice('[We-MP-RSS Sync] Starting sync...');

    try {
      const engine = await this.getSyncEngine();
      const feedIds = this.settings.feedIds.length > 0 ? this.settings.feedIds : [];

      const result = await engine.syncAllFeeds(feedIds, false);
      this.showSyncResult(result);
    } catch (error) {
      console.error('[We-MP-RSS Sync] Sync failed:', error);
      new Notice(`Sync failed: ${error}`);
    }
  }

  async syncAll(): Promise<void> {
    new Notice('[We-MP-RSS Sync] Syncing all feeds...');

    try {
      const engine = await this.getSyncEngine();
      const result = await engine.syncAllFeeds([], false);
      this.showSyncResult(result);
    } catch (error) {
      console.error('[We-MP-RSS Sync] Sync all failed:', error);
      new Notice(`Sync all failed: ${error}`);
    }
  }

  async forceSyncAll(): Promise<void> {
    new Notice('[We-MP-RSS Sync] Force syncing all articles...');

    try {
      const engine = await this.getSyncEngine();
      const result = await engine.syncAllFeeds([], true);
      this.showSyncResult(result);
    } catch (error) {
      console.error('[We-MP-RSS Sync] Force sync failed:', error);
      new Notice(`Force sync failed: ${error}`);
    }
  }

  async testConnection(): Promise<void> {
    new Notice('[We-MP-RSS Sync] Testing database connection...');

    try {
      const engine = await this.getSyncEngine();
      const connected = await engine.testDatabaseConnection();

      if (connected) {
        new Notice('[We-MP-RSS Sync] Database connection successful!');
      } else {
        new Notice('[We-MP-RSS Sync] Database connection failed!');
      }
    } catch (error) {
      console.error('[We-MP-RSS Sync] Connection test failed:', error);
      new Notice(`Connection test failed: ${error}`);
    }
  }

  private showSyncResult(result: SyncResult): void {
    if (result.success) {
      const messages: string[] = [];
      if (result.newArticles > 0) messages.push(`${result.newArticles} new`);
      if (result.updatedArticles > 0) messages.push(`${result.updatedArticles} updated`);
      if (result.failedArticles > 0) messages.push(`${result.failedArticles} failed`);

      const msg = messages.length > 0
        ? `[We-MP-RSS Sync] Done: ${messages.join(', ')}`
        : '[We-MP-RSS Sync] No articles to sync';

      new Notice(msg);
    } else {
      new Notice(`Sync failed: ${result.error}`);
    }
  }

  async getFeeds(): Promise<Feed[]> {
    if (this.feeds.length === 0) {
      const db = new Database(this.getDbConfig());
      await db.initialize();
      this.feeds = await db.getAllFeeds();
      db.close();
    }
    return this.feeds;
  }

  getSyncState(): SyncState | null {
    if (this.syncEngine) {
      return this.syncEngine.getSyncState();
    }
    return null;
  }
}

class WeMPRSSSyncSettingsTab extends PluginSettingTab {
  private plugin: WeMPRSSSyncPlugin;
  private feedListEl: HTMLElement | null = null;

  constructor(app: App, plugin: WeMPRSSSyncPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'We-MP-RSS Sync Settings' });

    // Database Type
    this.addDatabaseTypeSetting();

    // Show/hide settings based on DB type
    this.addDatabaseSettings();

    // Test Connection Button
    new Setting(containerEl)
      .setName('Test Connection')
      .setDesc('Test database connection')
      .addButton(button => button
        .setButtonText('Test')
        .setCta()
        .onClick(async () => {
          button.setDisabled(true);
          button.setButtonText('Testing...');
          await this.plugin.testConnection();
          button.setDisabled(false);
          button.setButtonText('Test');
        }));

    containerEl.createEl('hr');

    // Vault Settings
    containerEl.createEl('h3', { text: 'Vault Settings' });

    new Setting(containerEl)
      .setName('Article Folder')
      .setDesc('Folder path for storing articles (e.g., WeChat-Articles)')
      .addText(text => text
        .setValue(this.plugin.settings.vaultPath)
        .setPlaceholder('WeChat-Articles')
        .onChange(async (value) => {
          this.plugin.settings.vaultPath = value || 'WeChat-Articles';
          await this.plugin.saveSettings();
        }));

    // Feed Selection
    this.addFeedSelectionSetting();

    containerEl.createEl('hr');

    // Sync Settings
    containerEl.createEl('h3', { text: 'Sync Settings' });

    new Setting(containerEl)
      .setName('Auto Sync')
      .setDesc('Automatically sync at intervals')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.autoSync)
        .onChange(async (value) => {
          this.plugin.settings.autoSync = value;
          await this.plugin.saveSettings();
          this.display();
        }));

    if (this.plugin.settings.autoSync) {
      new Setting(containerEl)
        .setName('Sync Interval (minutes)')
        .setDesc('How often to auto-sync')
        .addText(text => text
          .setValue(String(this.plugin.settings.syncIntervalMinutes))
          .onChange(async (value) => {
            this.plugin.settings.syncIntervalMinutes = parseInt(value) || 30;
            await this.plugin.saveSettings();
          }));

      new Setting(containerEl)
        .setName('Batch Size')
        .setDesc('Maximum articles per sync')
        .addText(text => text
          .setValue(String(this.plugin.settings.batchSize))
          .onChange(async (value) => {
            this.plugin.settings.batchSize = parseInt(value) || 100;
            await this.plugin.saveSettings();
          }));
    }

    containerEl.createEl('hr');

    // DB-GPT Settings
    containerEl.createEl('h3', { text: 'DB-GPT Settings' });

    new Setting(containerEl)
      .setName('Enable DB-GPT')
      .setDesc('Upload articles to DB-GPT knowledge base')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.dbgptEnabled)
        .onChange(async (value) => {
          this.plugin.settings.dbgptEnabled = value;
          await this.plugin.saveSettings();
          this.display();
        }));

    if (this.plugin.settings.dbgptEnabled) {
      new Setting(containerEl)
        .setName('DB-GPT API URL')
        .setDesc('DB-GPT server URL')
        .addText(text => text
          .setValue(this.plugin.settings.dbgptApiUrl)
          .setPlaceholder('http://127.0.0.1:5670')
          .onChange(async (value) => {
            this.plugin.settings.dbgptApiUrl = value;
            await this.plugin.saveSettings();
          }));

      new Setting(containerEl)
        .setName('Space Name')
        .setDesc('Knowledge space name')
        .addText(text => text
          .setValue(this.plugin.settings.dbgptSpaceName)
          .setPlaceholder('we_mp_rss')
          .onChange(async (value) => {
            this.plugin.settings.dbgptSpaceName = value;
            await this.plugin.saveSettings();
          }));

      new Setting(containerEl)
        .setName('API Key')
        .setDesc('DB-GPT API Key (optional)')
        .addText(text => text
          .setValue(this.plugin.settings.dbgptApiKey)
          .setPlaceholder('')
          .onChange(async (value) => {
            this.plugin.settings.dbgptApiKey = value;
            await this.plugin.saveSettings();
          }));
    }

    containerEl.createEl('hr');

    // Manual Sync Buttons
    containerEl.createEl('h3', { text: 'Manual Sync' });

    new Setting(containerEl)
      .addButton(button => button
        .setButtonText('Sync Now')
        .setCta()
        .onClick(async () => {
          await this.plugin.syncNow();
        }))
      .addButton(button => button
        .setButtonText('Sync All Feeds')
        .onClick(async () => {
          await this.plugin.syncAll();
        }))
      .addButton(button => button
        .setButtonText('Force Full Sync')
        .setWarning()
        .onClick(async () => {
          await this.plugin.forceSyncAll();
        }));

    // Sync Status
    containerEl.createEl('hr');
    containerEl.createEl('h3', { text: 'Sync Status' });
    this.addSyncStatus();
  }

  private addDatabaseTypeSetting(): void {
    new Setting(this.containerEl)
      .setName('Database Type')
      .addDropdown(dropdown => dropdown
        .addOption('mysql', 'MySQL')
        .addOption('postgresql', 'PostgreSQL')
        .addOption('supabase', 'Supabase')
        .addOption('doris', 'Doris')
        .addOption('sqlite', 'SQLite')
        .setValue(this.plugin.settings.dbType)
        .onChange(async (value) => {
          this.plugin.settings.dbType = value as any;
          await this.plugin.saveSettings();
          this.display();
        }));
  }

  private addDatabaseSettings(): void {
    const dbType = this.plugin.settings.dbType;

    if (dbType === 'supabase') {
      new Setting(this.containerEl)
        .setName('Project Reference')
        .setDesc('Supabase project reference ID')
        .addText(text => text
          .setValue(this.plugin.settings.supabaseProjectRef)
          .setPlaceholder('xxxxx')
          .onChange(async (value) => {
            this.plugin.settings.supabaseProjectRef = value;
            await this.plugin.saveSettings();
          }));

      new Setting(this.containerEl)
        .setName('API Key')
        .setDesc('Supabase anon key')
        .addText(text => text
          .setValue(this.plugin.settings.supabaseApiKey)
          .setPlaceholder('')
          .onChange(async (value) => {
            this.plugin.settings.supabaseApiKey = value;
            await this.plugin.saveSettings();
          }));
    } else if (dbType === 'sqlite') {
      new Setting(this.containerEl)
        .setName('SQLite Path')
        .setDesc('Path to SQLite database file')
        .addText(text => text
          .setValue(this.plugin.settings.sqlitePath)
          .setPlaceholder('/data/we_mp_rss.db')
          .onChange(async (value) => {
            this.plugin.settings.sqlitePath = value;
            await this.plugin.saveSettings();
          }));

      new Setting(this.containerEl)
        .setName('Use Docker Exec')
        .setDesc('Access SQLite via docker exec')
        .addToggle(toggle => toggle
          .setValue(this.plugin.settings.sqliteUseDocker)
          .onChange(async (value) => {
            this.plugin.settings.sqliteUseDocker = value;
            await this.plugin.saveSettings();
            this.display();
          }));

      if (this.plugin.settings.sqliteUseDocker) {
        new Setting(this.containerEl)
          .setName('Docker Container')
          .setDesc('Container name for docker exec')
            .addText(text => text
              .setValue(this.plugin.settings.dockerContainer)
              .setPlaceholder('we-mp-rss-backend-dev')
              .onChange(async (value) => {
                this.plugin.settings.dockerContainer = value;
                await this.plugin.saveSettings();
              }));
      }
    } else {
      // MySQL, PostgreSQL, Doris
      new Setting(this.containerEl)
        .setName('Database Host')
        .setDesc('Database server hostname')
        .addText(text => text
          .setValue(this.plugin.settings.dbHost)
          .setPlaceholder('localhost')
          .onChange(async (value) => {
            this.plugin.settings.dbHost = value;
            await this.plugin.saveSettings();
          }));

      new Setting(this.containerEl)
        .setName('Database Port')
        .setDesc('Database server port')
        .addText(text => text
          .setValue(String(this.plugin.settings.dbPort))
          .setPlaceholder('3306')
          .onChange(async (value) => {
            this.plugin.settings.dbPort = parseInt(value) || 3306;
            await this.plugin.saveSettings();
          }));

      new Setting(this.containerEl)
        .setName('Database User')
        .addText(text => text
          .setValue(this.plugin.settings.dbUser)
          .onChange(async (value) => {
            this.plugin.settings.dbUser = value;
            await this.plugin.saveSettings();
          }));

      new Setting(this.containerEl)
        .setName('Database Password')
        .addText(text => text
          .setValue(this.plugin.settings.dbPassword)
          .onChange(async (value) => {
            this.plugin.settings.dbPassword = value;
            await this.plugin.saveSettings();
          }));

      new Setting(this.containerEl)
        .setName('Database Name')
        .addText(text => text
          .setValue(this.plugin.settings.dbName)
          .onChange(async (value) => {
            this.plugin.settings.dbName = value;
            await this.plugin.saveSettings();
          }));
    }
  }

  private async addFeedSelectionSetting(): Promise<void> {
    new Setting(this.containerEl)
      .setName('Select Feeds')
      .setDesc('Choose which feeds to sync (leave empty for all)');

    this.feedListEl = this.containerEl.createDiv('feed-list');

    try {
      const feeds = await this.plugin.getFeeds();

      if (feeds.length === 0) {
        this.feedListEl.createEl('p', { text: 'No feeds found or not connected', cls: 'feed-list-empty' });
      } else {
        const selectedIds = this.plugin.settings.feedIds;

        feeds.forEach(feed => {
          const item = this.feedListEl!.createDiv('feed-item');
          const checkbox = item.createEl('input', { type: 'checkbox' }) as HTMLInputElement;
          checkbox.checked = selectedIds.length === 0 || selectedIds.includes(feed.id);

          checkbox.onchange = async () => {
            if (checkbox.checked) {
              if (!this.plugin.settings.feedIds.includes(feed.id)) {
                this.plugin.settings.feedIds.push(feed.id);
              }
            } else {
              this.plugin.settings.feedIds = this.plugin.settings.feedIds.filter(id => id !== feed.id);
            }
            await this.plugin.saveSettings();
          };

          item.createEl('span', { text: ` ${feed.mp_name} (${feed.mp_intro || 'No description'})` });
        });
      }
    } catch (error) {
      this.feedListEl.createEl('p', { text: `Failed to load feeds: ${error}`, cls: 'feed-list-error' });
    }
  }

  private addSyncStatus(): void {
    const state = this.plugin.getSyncState();

    if (!state) {
      this.containerEl.createEl('p', { text: 'Not yet synced' });
      return;
    }

    const statusDiv = this.containerEl.createDiv('sync-status');

    if (state.lastSyncTime) {
      const lastSync = new Date(state.lastSyncTime);
      statusDiv.createEl('p', { text: `Last sync: ${lastSync.toLocaleString()}` });
    }

    if (Object.keys(state.feedSyncStates).length > 0) {
      const list = statusDiv.createEl('ul');
      for (const [feedId, millis] of Object.entries(state.feedSyncStates)) {
        const time = new Date(millis).toLocaleString();
        list.createEl('li', { text: `${feedId}: ${time}` });
      }
    } else {
      statusDiv.createEl('p', { text: 'No feeds synced yet' });
    }
  }
}
