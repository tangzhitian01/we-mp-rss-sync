/**
 * We-MP-RSS Sync - 设置界面
 */
import { PluginSettingTab, Setting, Notice } from 'obsidian';
export const DEFAULT_SETTINGS = {
    // 数据库配置
    dbType: 'mysql',
    dbHost: 'localhost',
    dbPort: 3306,
    dbUser: 'rss_user',
    dbPassword: 'pass123456',
    dbName: 'we_mp_rss',
    // SQLite 专用
    sqlitePath: '/data/we_mp_rss.db',
    sqliteUseDocker: true,
    dockerContainer: 'we-mp-rss-backend-dev',
    // Supabase 专用
    supabaseProjectRef: '',
    supabaseApiKey: '',
    // 同步配置
    vaultPath: 'd:\\smartgit_project\\myknowledge_01',
    feedIds: [],
    autoSync: true,
    syncIntervalMinutes: 30,
    batchSize: 100,
    // DB-GPT 配置
    dbgptEnabled: true,
    dbgptApiUrl: 'http://127.0.0.1:5670',
    dbgptSpaceName: 'we_mp_rss',
    dbgptApiKey: ''
};
export class WeMPRSSSyncSettingsTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }
    display() {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl('h2', { text: 'We-MP-RSS Sync 设置' });
        // 数据库类型
        new Setting(containerEl)
            .setName('数据库类型')
            .setDesc('选择要连接的数据库类型')
            .addDropdown(dropdown => dropdown
            .addOption('mysql', 'MySQL')
            .addOption('postgresql', 'PostgreSQL')
            .addOption('supabase', 'Supabase (PostgreSQL)')
            .addOption('doris', 'Doris')
            .addOption('sqlite', 'SQLite')
            .setValue(this.plugin.settings.dbType)
            .onChange(async (value) => {
            this.plugin.settings.dbType = value;
            await this.plugin.saveSettings();
            this.display();
        }));
        // MySQL/Doris/PostgreSQL 配置
        if (['mysql', 'doris', 'postgresql'].includes(this.plugin.settings.dbType)) {
            this.addDatabaseCredentials(containerEl);
        }
        // Supabase 配置
        if (this.plugin.settings.dbType === 'supabase') {
            this.addSupabaseSettings(containerEl);
        }
        // SQLite 配置
        if (this.plugin.settings.dbType === 'sqlite') {
            this.addSQLiteSettings(containerEl);
        }
        // 同步配置
        this.addSyncSettings(containerEl);
        // DB-GPT 配置
        this.addDBGPTSettings(containerEl);
    }
    addDatabaseCredentials(containerEl) {
        new Setting(containerEl)
            .setName('数据库主机')
            .setDesc('例如: localhost 或 192.168.1.100')
            .addText(text => text
            .setValue(this.plugin.settings.dbHost)
            .setPlaceholder('localhost')
            .onChange(async (value) => {
            this.plugin.settings.dbHost = value;
            await this.plugin.saveSettings();
        }));
        new Setting(containerEl)
            .setName('数据库端口')
            .setDesc('MySQL 默认 3306，PostgreSQL 默认 5432')
            .addText(text => text
            .setValue(String(this.plugin.settings.dbPort))
            .setPlaceholder('3306')
            .onChange(async (value) => {
            this.plugin.settings.dbPort = parseInt(value) || 3306;
            await this.plugin.saveSettings();
        }));
        new Setting(containerEl)
            .setName('数据库用户名')
            .setDesc('')
            .addText(text => text
            .setValue(this.plugin.settings.dbUser)
            .setPlaceholder('rss_user')
            .onChange(async (value) => {
            this.plugin.settings.dbUser = value;
            await this.plugin.saveSettings();
        }));
        new Setting(containerEl)
            .setName('数据库密码')
            .setDesc('')
            .addText(text => text
            .setValue(this.plugin.settings.dbPassword)
            .setPlaceholder('pass123456')
            .setEnabled(false)
            .onChange(async (value) => {
            this.plugin.settings.dbPassword = value;
            await this.plugin.saveSettings();
        }));
        new Setting(containerEl)
            .setName('数据库名称')
            .setDesc('')
            .addText(text => text
            .setValue(this.plugin.settings.dbName)
            .setPlaceholder('we_mp_rss')
            .onChange(async (value) => {
            this.plugin.settings.dbName = value;
            await this.plugin.saveSettings();
        }));
        containerEl.createEl('hr');
    }
    addSQLiteSettings(containerEl) {
        new Setting(containerEl)
            .setName('SQLite 文件路径')
            .setDesc('数据库文件路径，例如: /data/we_mp_rss.db')
            .addText(text => text
            .setValue(this.plugin.settings.sqlitePath)
            .setPlaceholder('/data/we_mp_rss.db')
            .onChange(async (value) => {
            this.plugin.settings.sqlitePath = value;
            await this.plugin.saveSettings();
        }));
        new Setting(containerEl)
            .setName('使用 Docker Exec')
            .setDesc('通过 docker exec 访问容器内的 SQLite')
            .addToggle(toggle => toggle
            .setValue(this.plugin.settings.sqliteUseDocker)
            .onChange(async (value) => {
            this.plugin.settings.sqliteUseDocker = value;
            await this.plugin.saveSettings();
        }));
        if (this.plugin.settings.sqliteUseDocker) {
            new Setting(containerEl)
                .setName('Docker 容器名称')
                .setDesc('例如: we-mp-rss-backend-dev')
                .addText(text => text
                .setValue(this.plugin.settings.dockerContainer)
                .setPlaceholder('we-mp-rss-backend-dev')
                .onChange(async (value) => {
                this.plugin.settings.dockerContainer = value;
                await this.plugin.saveSettings();
            }));
        }
        containerEl.createEl('hr');
    }
    addSupabaseSettings(containerEl) {
        new Setting(containerEl)
            .setName('Supabase 项目引用')
            .setDesc('在 Supabase 设置中找到的项目 ID')
            .addText(text => text
            .setValue(this.plugin.settings.supabaseProjectRef)
            .setPlaceholder('xxxxx')
            .onChange(async (value) => {
            this.plugin.settings.supabaseProjectRef = value;
            await this.plugin.saveSettings();
        }));
        new Setting(containerEl)
            .setName('Supabase API Key')
            .setDesc('在 Supabase 设置中找到的 anon/public API key')
            .addText(text => text
            .setValue(this.plugin.settings.supabaseApiKey)
            .setPlaceholder('your-api-key')
            .onChange(async (value) => {
            this.plugin.settings.supabaseApiKey = value;
            await this.plugin.saveSettings();
        }));
        new Setting(containerEl)
            .setName('数据库名称')
            .setDesc('')
            .addText(text => text
            .setValue(this.plugin.settings.dbName)
            .setPlaceholder('postgres')
            .onChange(async (value) => {
            this.plugin.settings.dbName = value;
            await this.plugin.saveSettings();
        }));
        containerEl.createEl('hr');
    }
    addSyncSettings(containerEl) {
        containerEl.createEl('h3', { text: '同步配置' });
        new Setting(containerEl)
            .setName('Vault 路径')
            .setDesc('Obsidian 仓库根目录路径')
            .addText(text => text
            .setValue(this.plugin.settings.vaultPath)
            .setPlaceholder('d:\\path\\to\\vault')
            .onChange(async (value) => {
            this.plugin.settings.vaultPath = value;
            await this.plugin.saveSettings();
        }));
        new Setting(containerEl)
            .setName('自动同步')
            .setDesc('启用后按时间间隔自动同步')
            .addToggle(toggle => toggle
            .setValue(this.plugin.settings.autoSync)
            .onChange(async (value) => {
            this.plugin.settings.autoSync = value;
            await this.plugin.saveSettings();
            this.display();
        }));
        if (this.plugin.settings.autoSync) {
            new Setting(containerEl)
                .setName('同步间隔（分钟）')
                .setDesc('')
                .addText(text => text
                .setValue(String(this.plugin.settings.syncIntervalMinutes))
                .setPlaceholder('30')
                .onChange(async (value) => {
                this.plugin.settings.syncIntervalMinutes = parseInt(value) || 30;
                await this.plugin.saveSettings();
            }));
        }
        new Setting(containerEl)
            .setName('批量大小')
            .setDesc('每次同步的最大文章数')
            .addText(text => text
            .setValue(String(this.plugin.settings.batchSize))
            .setPlaceholder('100')
            .onChange(async (value) => {
            this.plugin.settings.batchSize = parseInt(value) || 100;
            await this.plugin.saveSettings();
        }));
        // 测试连接按钮
        new Setting(containerEl)
            .setName('测试数据库连接')
            .addButton(button => button
            .setButtonText('测试')
            .onClick(async () => {
            new Notice('正在测试连接...');
            // 连接测试逻辑在 SyncEngine 中
            new Notice('请使用"同步所有公众号文章"命令测试');
        }));
        containerEl.createEl('hr');
    }
    addDBGPTSettings(containerEl) {
        containerEl.createEl('h3', { text: 'DB-GPT 知识库' });
        new Setting(containerEl)
            .setName('启用 DB-GPT 集成')
            .setDesc('同步后自动上传到 DB-GPT 知识库')
            .addToggle(toggle => toggle
            .setValue(this.plugin.settings.dbgptEnabled)
            .onChange(async (value) => {
            this.plugin.settings.dbgptEnabled = value;
            await this.plugin.saveSettings();
            this.display();
        }));
        if (this.plugin.settings.dbgptEnabled) {
            new Setting(containerEl)
                .setName('DB-GPT API 地址')
                .setDesc('例如: http://127.0.0.1:5670')
                .addText(text => text
                .setValue(this.plugin.settings.dbgptApiUrl)
                .setPlaceholder('http://127.0.0.1:5670')
                .onChange(async (value) => {
                this.plugin.settings.dbgptApiUrl = value;
                await this.plugin.saveSettings();
            }));
            new Setting(containerEl)
                .setName('知识库空间名称')
                .setDesc('例如: we_mp_rss')
                .addText(text => text
                .setValue(this.plugin.settings.dbgptSpaceName)
                .setPlaceholder('we_mp_rss')
                .onChange(async (value) => {
                this.plugin.settings.dbgptSpaceName = value;
                await this.plugin.saveSettings();
            }));
            new Setting(containerEl)
                .setName('API Key（可选）')
                .setDesc('如果 DB-GPT 配置了认证')
                .addText(text => text
                .setValue(this.plugin.settings.dbgptApiKey)
                .setPlaceholder('')
                .onChange(async (value) => {
                this.plugin.settings.dbgptApiKey = value;
                await this.plugin.saveSettings();
            }));
        }
    }
}
