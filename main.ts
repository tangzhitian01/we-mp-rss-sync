import { Plugin, Notice, PluginSettingTab, Setting } from 'obsidian';

interface WeMPRSSSyncSettings {
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
  vaultPath: string;
  feedIds: string[];
  autoSync: boolean;
  syncIntervalMinutes: number;
  batchSize: number;
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
  vaultPath: '',
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

  async onload() {
    console.log('[We-MP-RSS Sync] Plugin loaded');

    await this.loadSettings();
    this.addSettingTab(new WeMPRSSSyncSettingsTab(this));

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

    if (this.settings.autoSync && this.settings.syncIntervalMinutes > 0) {
      this.startAutoSync();
    }
  }

  onunload() {
    console.log('[We-MP-RSS Sync] Plugin unloaded');
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    if (this.settings.autoSync && this.settings.syncIntervalMinutes > 0) {
      this.startAutoSync();
    }
  }

  private startAutoSync() {
    const intervalMs = this.settings.syncIntervalMinutes * 60 * 1000;
    this.intervalId = setInterval(() => this.syncNow(), intervalMs);
  }

  private async syncNow() {
    new Notice('Syncing We-MP-RSS articles...');
    console.log('[We-MP-RSS Sync] Starting sync...');
    // TODO: Implement sync logic
    new Notice('Sync completed!');
  }

  private async syncAll() {
    new Notice('Syncing all feeds...');
    console.log('[We-MP-RSS Sync] Syncing all feeds...');
    // TODO: Implement sync all logic
    new Notice('All feeds synced!');
  }
}

class WeMPRSSSyncSettingsTab extends PluginSettingTab {
  plugin: WeMPRSSSyncPlugin;

  constructor(plugin: WeMPRSSSyncPlugin) {
    super(plugin.app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl('h2', { text: 'We-MP-RSS Sync Settings' });

    // Database Type
    new Setting(containerEl)
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
        }));

    // DB Host
    new Setting(containerEl)
      .setName('Database Host')
      .addText(text => text
        .setValue(this.plugin.settings.dbHost)
        .onChange(async (value) => {
          this.plugin.settings.dbHost = value;
          await this.plugin.saveSettings();
        }));

    // DB Port
    new Setting(containerEl)
      .setName('Database Port')
      .addText(text => text
        .setValue(String(this.plugin.settings.dbPort))
        .onChange(async (value) => {
          this.plugin.settings.dbPort = parseInt(value) || 3306;
          await this.plugin.saveSettings();
        }));

    // DB User
    new Setting(containerEl)
      .setName('Database User')
      .addText(text => text
        .setValue(this.plugin.settings.dbUser)
        .onChange(async (value) => {
          this.plugin.settings.dbUser = value;
          await this.plugin.saveSettings();
        }));

    // DB Password
    new Setting(containerEl)
      .setName('Database Password')
      .addText(text => text
        .setValue(this.plugin.settings.dbPassword)
        .onChange(async (value) => {
          this.plugin.settings.dbPassword = value;
          await this.plugin.saveSettings();
        }));

    // DB Name
    new Setting(containerEl)
      .setName('Database Name')
      .addText(text => text
        .setValue(this.plugin.settings.dbName)
        .onChange(async (value) => {
          this.plugin.settings.dbName = value;
          await this.plugin.saveSettings();
        }));

    // DB-GPT Settings
    containerEl.createEl('h3', { text: 'DB-GPT Settings' });

    new Setting(containerEl)
      .setName('Enable DB-GPT')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.dbgptEnabled)
        .onChange(async (value) => {
          this.plugin.settings.dbgptEnabled = value;
          await this.plugin.saveSettings();
        }));

    if (this.plugin.settings.dbgptEnabled) {
      new Setting(containerEl)
        .setName('DB-GPT API URL')
        .addText(text => text
          .setValue(this.plugin.settings.dbgptApiUrl)
          .onChange(async (value) => {
            this.plugin.settings.dbgptApiUrl = value;
            await this.plugin.saveSettings();
          }));

      new Setting(containerEl)
        .setName('Space Name')
        .addText(text => text
          .setValue(this.plugin.settings.dbgptSpaceName)
          .onChange(async (value) => {
            this.plugin.settings.dbgptSpaceName = value;
            await this.plugin.saveSettings();
          }));
    }

    // Sync Settings
    containerEl.createEl('h3', { text: 'Sync Settings' });

    new Setting(containerEl)
      .setName('Auto Sync')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.autoSync)
        .onChange(async (value) => {
          this.plugin.settings.autoSync = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Sync Interval (minutes)')
      .addText(text => text
        .setValue(String(this.plugin.settings.syncIntervalMinutes))
        .onChange(async (value) => {
          this.plugin.settings.syncIntervalMinutes = parseInt(value) || 30;
          await this.plugin.saveSettings();
        }));
  }
}