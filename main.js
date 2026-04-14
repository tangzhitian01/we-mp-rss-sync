"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/Settings.ts
var Settings_exports = {};
__export(Settings_exports, {
  DEFAULT_SETTINGS: () => DEFAULT_SETTINGS,
  WeMPRSSSyncSettingsTab: () => WeMPRSSSyncSettingsTab
});
var import_obsidian, DEFAULT_SETTINGS, WeMPRSSSyncSettingsTab;
var init_Settings = __esm({
  "src/Settings.ts"() {
    "use strict";
    import_obsidian = require("obsidian");
    DEFAULT_SETTINGS = {
      // 数据库配置
      dbType: "mysql",
      dbHost: "localhost",
      dbPort: 3306,
      dbUser: "rss_user",
      dbPassword: "pass123456",
      dbName: "we_mp_rss",
      // SQLite 专用
      sqlitePath: "/data/we_mp_rss.db",
      sqliteUseDocker: true,
      dockerContainer: "we-mp-rss-backend-dev",
      // Supabase 专用
      supabaseProjectRef: "",
      supabaseApiKey: "",
      // 同步配置
      vaultPath: "d:\\smartgit_project\\myknowledge_01",
      feedIds: [],
      autoSync: true,
      syncIntervalMinutes: 30,
      batchSize: 100,
      // DB-GPT 配置
      dbgptEnabled: true,
      dbgptApiUrl: "http://127.0.0.1:5670",
      dbgptSpaceName: "we_mp_rss",
      dbgptApiKey: ""
    };
    WeMPRSSSyncSettingsTab = class extends import_obsidian.PluginSettingTab {
      constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
      }
      display() {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl("h2", { text: "We-MP-RSS Sync \u8BBE\u7F6E" });
        new import_obsidian.Setting(containerEl).setName("\u6570\u636E\u5E93\u7C7B\u578B").setDesc("\u9009\u62E9\u8981\u8FDE\u63A5\u7684\u6570\u636E\u5E93\u7C7B\u578B").addDropdown((dropdown) => dropdown.addOption("mysql", "MySQL").addOption("postgresql", "PostgreSQL").addOption("supabase", "Supabase (PostgreSQL)").addOption("doris", "Doris").addOption("sqlite", "SQLite").setValue(this.plugin.settings.dbType).onChange(async (value) => {
          this.plugin.settings.dbType = value;
          await this.plugin.saveSettings();
          this.display();
        }));
        if (["mysql", "doris", "postgresql"].includes(this.plugin.settings.dbType)) {
          this.addDatabaseCredentials(containerEl);
        }
        if (this.plugin.settings.dbType === "supabase") {
          this.addSupabaseSettings(containerEl);
        }
        if (this.plugin.settings.dbType === "sqlite") {
          this.addSQLiteSettings(containerEl);
        }
        this.addSyncSettings(containerEl);
        this.addDBGPTSettings(containerEl);
      }
      addDatabaseCredentials(containerEl) {
        new import_obsidian.Setting(containerEl).setName("\u6570\u636E\u5E93\u4E3B\u673A").setDesc("\u4F8B\u5982: localhost \u6216 192.168.1.100").addText((text) => text.setValue(this.plugin.settings.dbHost).setPlaceholder("localhost").onChange(async (value) => {
          this.plugin.settings.dbHost = value;
          await this.plugin.saveSettings();
        }));
        new import_obsidian.Setting(containerEl).setName("\u6570\u636E\u5E93\u7AEF\u53E3").setDesc("MySQL \u9ED8\u8BA4 3306\uFF0CPostgreSQL \u9ED8\u8BA4 5432").addText((text) => text.setValue(String(this.plugin.settings.dbPort)).setPlaceholder("3306").onChange(async (value) => {
          this.plugin.settings.dbPort = parseInt(value) || 3306;
          await this.plugin.saveSettings();
        }));
        new import_obsidian.Setting(containerEl).setName("\u6570\u636E\u5E93\u7528\u6237\u540D").setDesc("").addText((text) => text.setValue(this.plugin.settings.dbUser).setPlaceholder("rss_user").onChange(async (value) => {
          this.plugin.settings.dbUser = value;
          await this.plugin.saveSettings();
        }));
        new import_obsidian.Setting(containerEl).setName("\u6570\u636E\u5E93\u5BC6\u7801").setDesc("").addText((text) => text.setValue(this.plugin.settings.dbPassword).setPlaceholder("pass123456").setEnabled(false).onChange(async (value) => {
          this.plugin.settings.dbPassword = value;
          await this.plugin.saveSettings();
        }));
        new import_obsidian.Setting(containerEl).setName("\u6570\u636E\u5E93\u540D\u79F0").setDesc("").addText((text) => text.setValue(this.plugin.settings.dbName).setPlaceholder("we_mp_rss").onChange(async (value) => {
          this.plugin.settings.dbName = value;
          await this.plugin.saveSettings();
        }));
        containerEl.createEl("hr");
      }
      addSQLiteSettings(containerEl) {
        new import_obsidian.Setting(containerEl).setName("SQLite \u6587\u4EF6\u8DEF\u5F84").setDesc("\u6570\u636E\u5E93\u6587\u4EF6\u8DEF\u5F84\uFF0C\u4F8B\u5982: /data/we_mp_rss.db").addText((text) => text.setValue(this.plugin.settings.sqlitePath).setPlaceholder("/data/we_mp_rss.db").onChange(async (value) => {
          this.plugin.settings.sqlitePath = value;
          await this.plugin.saveSettings();
        }));
        new import_obsidian.Setting(containerEl).setName("\u4F7F\u7528 Docker Exec").setDesc("\u901A\u8FC7 docker exec \u8BBF\u95EE\u5BB9\u5668\u5185\u7684 SQLite").addToggle((toggle) => toggle.setValue(this.plugin.settings.sqliteUseDocker).onChange(async (value) => {
          this.plugin.settings.sqliteUseDocker = value;
          await this.plugin.saveSettings();
        }));
        if (this.plugin.settings.sqliteUseDocker) {
          new import_obsidian.Setting(containerEl).setName("Docker \u5BB9\u5668\u540D\u79F0").setDesc("\u4F8B\u5982: we-mp-rss-backend-dev").addText((text) => text.setValue(this.plugin.settings.dockerContainer).setPlaceholder("we-mp-rss-backend-dev").onChange(async (value) => {
            this.plugin.settings.dockerContainer = value;
            await this.plugin.saveSettings();
          }));
        }
        containerEl.createEl("hr");
      }
      addSupabaseSettings(containerEl) {
        new import_obsidian.Setting(containerEl).setName("Supabase \u9879\u76EE\u5F15\u7528").setDesc("\u5728 Supabase \u8BBE\u7F6E\u4E2D\u627E\u5230\u7684\u9879\u76EE ID").addText((text) => text.setValue(this.plugin.settings.supabaseProjectRef).setPlaceholder("xxxxx").onChange(async (value) => {
          this.plugin.settings.supabaseProjectRef = value;
          await this.plugin.saveSettings();
        }));
        new import_obsidian.Setting(containerEl).setName("Supabase API Key").setDesc("\u5728 Supabase \u8BBE\u7F6E\u4E2D\u627E\u5230\u7684 anon/public API key").addText((text) => text.setValue(this.plugin.settings.supabaseApiKey).setPlaceholder("your-api-key").onChange(async (value) => {
          this.plugin.settings.supabaseApiKey = value;
          await this.plugin.saveSettings();
        }));
        new import_obsidian.Setting(containerEl).setName("\u6570\u636E\u5E93\u540D\u79F0").setDesc("").addText((text) => text.setValue(this.plugin.settings.dbName).setPlaceholder("postgres").onChange(async (value) => {
          this.plugin.settings.dbName = value;
          await this.plugin.saveSettings();
        }));
        containerEl.createEl("hr");
      }
      addSyncSettings(containerEl) {
        containerEl.createEl("h3", { text: "\u540C\u6B65\u914D\u7F6E" });
        new import_obsidian.Setting(containerEl).setName("Vault \u8DEF\u5F84").setDesc("Obsidian \u4ED3\u5E93\u6839\u76EE\u5F55\u8DEF\u5F84").addText((text) => text.setValue(this.plugin.settings.vaultPath).setPlaceholder("d:\\path\\to\\vault").onChange(async (value) => {
          this.plugin.settings.vaultPath = value;
          await this.plugin.saveSettings();
        }));
        new import_obsidian.Setting(containerEl).setName("\u81EA\u52A8\u540C\u6B65").setDesc("\u542F\u7528\u540E\u6309\u65F6\u95F4\u95F4\u9694\u81EA\u52A8\u540C\u6B65").addToggle((toggle) => toggle.setValue(this.plugin.settings.autoSync).onChange(async (value) => {
          this.plugin.settings.autoSync = value;
          await this.plugin.saveSettings();
          this.display();
        }));
        if (this.plugin.settings.autoSync) {
          new import_obsidian.Setting(containerEl).setName("\u540C\u6B65\u95F4\u9694\uFF08\u5206\u949F\uFF09").setDesc("").addText((text) => text.setValue(String(this.plugin.settings.syncIntervalMinutes)).setPlaceholder("30").onChange(async (value) => {
            this.plugin.settings.syncIntervalMinutes = parseInt(value) || 30;
            await this.plugin.saveSettings();
          }));
        }
        new import_obsidian.Setting(containerEl).setName("\u6279\u91CF\u5927\u5C0F").setDesc("\u6BCF\u6B21\u540C\u6B65\u7684\u6700\u5927\u6587\u7AE0\u6570").addText((text) => text.setValue(String(this.plugin.settings.batchSize)).setPlaceholder("100").onChange(async (value) => {
          this.plugin.settings.batchSize = parseInt(value) || 100;
          await this.plugin.saveSettings();
        }));
        new import_obsidian.Setting(containerEl).setName("\u6D4B\u8BD5\u6570\u636E\u5E93\u8FDE\u63A5").addButton((button) => button.setButtonText("\u6D4B\u8BD5").onClick(async () => {
          new import_obsidian.Notice("\u6B63\u5728\u6D4B\u8BD5\u8FDE\u63A5...");
          new import_obsidian.Notice('\u8BF7\u4F7F\u7528"\u540C\u6B65\u6240\u6709\u516C\u4F17\u53F7\u6587\u7AE0"\u547D\u4EE4\u6D4B\u8BD5');
        }));
        containerEl.createEl("hr");
      }
      addDBGPTSettings(containerEl) {
        containerEl.createEl("h3", { text: "DB-GPT \u77E5\u8BC6\u5E93" });
        new import_obsidian.Setting(containerEl).setName("\u542F\u7528 DB-GPT \u96C6\u6210").setDesc("\u540C\u6B65\u540E\u81EA\u52A8\u4E0A\u4F20\u5230 DB-GPT \u77E5\u8BC6\u5E93").addToggle((toggle) => toggle.setValue(this.plugin.settings.dbgptEnabled).onChange(async (value) => {
          this.plugin.settings.dbgptEnabled = value;
          await this.plugin.saveSettings();
          this.display();
        }));
        if (this.plugin.settings.dbgptEnabled) {
          new import_obsidian.Setting(containerEl).setName("DB-GPT API \u5730\u5740").setDesc("\u4F8B\u5982: http://127.0.0.1:5670").addText((text) => text.setValue(this.plugin.settings.dbgptApiUrl).setPlaceholder("http://127.0.0.1:5670").onChange(async (value) => {
            this.plugin.settings.dbgptApiUrl = value;
            await this.plugin.saveSettings();
          }));
          new import_obsidian.Setting(containerEl).setName("\u77E5\u8BC6\u5E93\u7A7A\u95F4\u540D\u79F0").setDesc("\u4F8B\u5982: we_mp_rss").addText((text) => text.setValue(this.plugin.settings.dbgptSpaceName).setPlaceholder("we_mp_rss").onChange(async (value) => {
            this.plugin.settings.dbgptSpaceName = value;
            await this.plugin.saveSettings();
          }));
          new import_obsidian.Setting(containerEl).setName("API Key\uFF08\u53EF\u9009\uFF09").setDesc("\u5982\u679C DB-GPT \u914D\u7F6E\u4E86\u8BA4\u8BC1").addText((text) => text.setValue(this.plugin.settings.dbgptApiKey).setPlaceholder("").onChange(async (value) => {
            this.plugin.settings.dbgptApiKey = value;
            await this.plugin.saveSettings();
          }));
        }
      }
    };
  }
});

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => WeMPRSSSyncPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian2 = require("obsidian");
init_Settings();

// src/Database.ts
var import_promise = __toESM(require("mysql2/promise"));
var import_pg = require("pg");
var Database = class {
  constructor(config) {
    this.mysqlPool = null;
    this.pgClient = null;
    this.config = config;
  }
  /**
   * 连接数据库
   */
  async connect() {
    switch (this.config.type) {
      case "mysql":
      case "doris":
        await this.connectMySQL();
        break;
      case "postgresql":
      case "supabase":
        await this.connectPostgreSQL();
        break;
      case "sqlite":
        break;
    }
  }
  /**
   * 关闭连接
   */
  async close() {
    if (this.mysqlPool) {
      await this.mysqlPool.end();
      this.mysqlPool = null;
    }
    if (this.pgClient) {
      await this.pgClient.end();
      this.pgClient = null;
    }
  }
  /**
   * 连接 MySQL/Doris
   */
  async connectMySQL() {
    this.mysqlPool = import_promise.default.createPool({
      host: this.config.host,
      port: this.config.port,
      user: this.config.user,
      password: this.config.password,
      database: this.config.database,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0
    });
    const conn = await this.mysqlPool.getConnection();
    conn.release();
    console.log("[Database] MySQL/Doris \u8FDE\u63A5\u6210\u529F");
  }
  /**
   * 连接 PostgreSQL/Supabase
   */
  async connectPostgreSQL() {
    let connectionString;
    if (this.config.type === "supabase") {
      connectionString = `postgresql://postgres:${this.config.password}@db.${this.config.supabaseProjectRef}.supabase.co:5432/postgres`;
    } else {
      connectionString = `postgresql://${this.config.user}:${this.config.password}@${this.config.host}:${this.config.port}/${this.config.database}`;
    }
    this.pgClient = new import_pg.Client({
      connectionString,
      ssl: this.config.type === "supabase" ? { rejectUnauthorized: false } : void 0
    });
    await this.pgClient.connect();
    console.log("[Database] PostgreSQL/Supabase \u8FDE\u63A5\u6210\u529F");
  }
  /**
   * 执行查询 - MySQL/Doris
   */
  async queryMySQL(sql, params = []) {
    if (!this.mysqlPool) {
      throw new Error("MySQL \u8FDE\u63A5\u672A\u521D\u59CB\u5316");
    }
    const [rows] = await this.mysqlPool.execute(sql, params);
    return rows;
  }
  /**
   * 执行查询 - PostgreSQL/Supabase
   */
  async queryPostgreSQL(sql, params = []) {
    if (!this.pgClient) {
      throw new Error("PostgreSQL \u8FDE\u63A5\u672A\u521D\u59CB\u5316");
    }
    const result = await this.pgClient.query(sql, params);
    return result.rows;
  }
  /**
   * 执行查询 - SQLite (通过 docker exec)
   */
  async querySQLite(sql, params = []) {
    if (!this.config.sqlitePath) {
      throw new Error("SQLite \u8DEF\u5F84\u672A\u914D\u7F6E");
    }
    let formattedSql = sql;
    if (params.length > 0) {
      const paramStr = params.map((p) => {
        if (p === null || p === void 0) return "NULL";
        if (typeof p === "string") return `'${p.replace(/'/g, "''")}'`;
        if (typeof p === "number") return String(p);
        return String(p);
      }).join(", ");
      formattedSql = sql.replace(/\?/g, () => paramStr.shift() || "NULL");
    }
    const escapedSql = formattedSql.replace(/"/g, '\\"').replace(/\n/g, "\\n");
    if (this.config.sqliteUseDocker && this.config.dockerContainer) {
      const cmd = `docker exec ${this.config.dockerContainer} sqlite3 "${this.config.sqlitePath}" -json "${escapedSql}"`;
      const { execSync } = require("child_process");
      const output = execSync(cmd, { encoding: "utf-8" });
      return output.trim() ? JSON.parse(output) : [];
    } else {
      const { execSync } = require("child_process");
      const cmd = `sqlite3 "${this.config.sqlitePath}" -json "${escapedSql}"`;
      const output = execSync(cmd, { encoding: "utf-8" });
      return output.trim() ? JSON.parse(output) : [];
    }
  }
  /**
   * 通用查询接口
   */
  async query(sql, params = []) {
    switch (this.config.type) {
      case "mysql":
      case "doris":
        return this.queryMySQL(sql, params);
      case "postgresql":
      case "supabase":
        return this.queryPostgreSQL(sql, params);
      case "sqlite":
        return this.querySQLite(sql, params);
      default:
        throw new Error(`\u4E0D\u652F\u6301\u7684\u6570\u636E\u5E93\u7C7B\u578B: ${this.config.type}`);
    }
  }
  /**
   * 获取所有公众号（feeds）
   */
  async getAllFeeds() {
    const sql = `SELECT id, mp_name, mp_cover, mp_intro, status FROM feeds WHERE status = 1 ORDER BY mp_name`;
    return await this.query(sql);
  }
  /**
   * 根据 ID 获取公众号
   */
  async getFeedById(feedId) {
    const sql = `SELECT id, mp_name, mp_cover, mp_intro, status FROM feeds WHERE id = ?`;
    const results = await this.query(sql, [feedId]);
    return results.length > 0 ? results[0] : null;
  }
  /**
   * 获取增量更新的文章
   * @param since 上次同步时间（毫秒）
   * @param limit 限制条数
   */
  async getArticlesSince(since, limit = 100) {
    const sql = `
      SELECT a.id, a.mp_id, a.title, a.content, a.content_html, a.url,
             a.description, a.publish_time, a.updated_at_millis, a.status,
             f.mp_name
      FROM articles a
      LEFT JOIN feeds f ON a.mp_id = f.id
      WHERE a.updated_at_millis > ?
        AND a.status = 1
      ORDER BY a.updated_at_millis ASC
      LIMIT ?
    `;
    return await this.query(sql, [since, limit]);
  }
  /**
   * 获取指定公众号的增量文章
   */
  async getArticlesByFeed(feedId, since, limit = 100) {
    const sql = `
      SELECT a.id, a.mp_id, a.title, a.content, a.content_html, a.url,
             a.description, a.publish_time, a.updated_at_millis, a.status,
             f.mp_name
      FROM articles a
      LEFT JOIN feeds f ON a.mp_id = f.id
      WHERE a.mp_id = ?
        AND a.updated_at_millis > ?
        AND a.status = 1
      ORDER BY a.updated_at_millis ASC
      LIMIT ?
    `;
    return await this.query(sql, [feedId, since, limit]);
  }
  /**
   * 获取文章总数
   */
  async getArticleCount(feedId) {
    let sql;
    let params;
    if (feedId) {
      sql = `SELECT COUNT(*) as count FROM articles WHERE mp_id = ? AND status = 1`;
      params = [feedId];
    } else {
      sql = `SELECT COUNT(*) as count FROM articles WHERE status = 1`;
      params = [];
    }
    const results = await this.query(sql, params);
    return results[0]?.count || 0;
  }
  /**
   * 检查数据库连接是否正常
   */
  async healthCheck() {
    try {
      await this.query("SELECT 1", []);
      return true;
    } catch (error) {
      console.error("[Database] \u5065\u5EB7\u68C0\u67E5\u5931\u8D25:", error);
      return false;
    }
  }
};

// src/ObsidianWriter.ts
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
var ObsidianWriter = class {
  constructor(vaultPath) {
    this.vaultPath = vaultPath;
    this.ensureVault();
  }
  /**
   * 确保 vault 目录存在
   */
  ensureVault() {
    if (!fs.existsSync(this.vaultPath)) {
      throw new Error(`Vault \u76EE\u5F55\u4E0D\u5B58\u5728: ${this.vaultPath}`);
    }
  }
  /**
   * 检查文件是否存在
   */
  async exists(filepath) {
    return fs.existsSync(filepath);
  }
  /**
   * 获取文件修改时间（毫秒时间戳）
   */
  async getModTime(filepath) {
    if (!fs.existsSync(filepath)) {
      return 0;
    }
    const stat = fs.statSync(filepath);
    return stat.mtimeMs;
  }
  /**
   * 创建目录
   */
  async ensureDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }
  /**
   * 写入文件
   */
  async write(filepath, content) {
    const dir = path.dirname(filepath);
    await this.ensureDirectory(dir);
    fs.writeFileSync(filepath, content, "utf-8");
  }
  /**
   * 读取文件
   */
  async read(filepath) {
    if (!fs.existsSync(filepath)) {
      return "";
    }
    return fs.readFileSync(filepath, "utf-8");
  }
  /**
   * 删除文件
   */
  async delete(filepath) {
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }
  }
  /**
   * 列出目录下的所有文件
   */
  async listFiles(dirPath, ext = ".md") {
    const files = [];
    if (!fs.existsSync(dirPath)) {
      return files;
    }
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(ext)) {
        files.push(path.join(dirPath, entry.name));
      }
    }
    return files;
  }
  /**
   * 读取目录下的文件并返回文件路径和内容的映射
   */
  async readAllInDir(dirPath) {
    const results = [];
    const files = await this.listFiles(dirPath);
    for (const file of files) {
      results.push({
        path: file,
        content: await this.read(file)
      });
    }
    return results;
  }
  /**
   * 获取 vault 根路径
   */
  getVaultPath() {
    return this.vaultPath;
  }
};

// src/utils.ts
function generateFilename(article) {
  const date = new Date(article.publish_time * 1e3);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const cleanTitle = sanitizeFilename(article.title);
  return `${year}-${month}-${day}-${hours}+${cleanTitle}.md`;
}
function sanitizeFilename(filename) {
  if (!filename || filename.trim() === "") {
    return "untitled";
  }
  const illegalChars = /[<>:"/\\|?*\x00-\x1f]/g;
  let cleaned = filename.replace(illegalChars, "").replace(/\s+/g, "+").replace(/\u3000/g, "+").replace(/\+{2,}/g, "+").replace(/^\+|\+$/g, "").substring(0, 200);
  if (!cleaned || cleaned.trim() === "") {
    return "untitled";
  }
  return cleaned;
}
function formatDate(timestamp, format = "ISO") {
  const date = new Date(timestamp);
  if (format === "ISO") {
    return date.toISOString();
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  if (format === "yyyy-MM-dd") {
    return `${year}-${month}-${day}`;
  }
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

// src/SyncEngine.ts
var SyncEngine = class {
  constructor(settings, dbgptClient) {
    this.db = null;
    this.syncState = {};
    this.intervalId = null;
    this.settings = settings;
    this.dbgptClient = dbgptClient;
    this.writer = new ObsidianWriter(settings.vaultPath);
    this.loadSyncState();
  }
  /**
   * 更新配置
   */
  updateConfig(settings) {
    this.settings = settings;
    this.writer = new ObsidianWriter(settings.vaultPath);
    this.db = null;
  }
  /**
   * 加载同步状态
   */
  loadSyncState() {
    try {
      const statePath = `${this.settings.vaultPath}/.we-mp-rss-sync-state.json`;
      const fs3 = require("fs");
      if (fs3.existsSync(statePath)) {
        this.syncState = JSON.parse(fs3.readFileSync(statePath, "utf-8"));
        console.log("[SyncEngine] \u5DF2\u52A0\u8F7D\u540C\u6B65\u72B6\u6001:", Object.keys(this.syncState).length, "\u4E2A\u516C\u4F17\u53F7");
      }
    } catch (error) {
      console.error("[SyncEngine] \u52A0\u8F7D\u540C\u6B65\u72B6\u6001\u5931\u8D25:", error);
      this.syncState = {};
    }
  }
  /**
   * 保存同步状态
   */
  saveSyncState() {
    try {
      const statePath = `${this.settings.vaultPath}/.we-mp-rss-sync-state.json`;
      const fs3 = require("fs");
      fs3.writeFileSync(statePath, JSON.stringify(this.syncState, null, 2));
    } catch (error) {
      console.error("[SyncEngine] \u4FDD\u5B58\u540C\u6B65\u72B6\u6001\u5931\u8D25:", error);
    }
  }
  /**
   * 创建数据库连接
   */
  async getDatabase() {
    if (!this.db) {
      const dbConfig = {
        type: this.settings.dbType,
        host: this.settings.dbHost,
        port: this.settings.dbPort,
        user: this.settings.dbUser,
        password: this.settings.dbPassword,
        database: this.settings.dbName,
        sqlitePath: this.settings.sqlitePath,
        sqliteUseDocker: this.settings.sqliteUseDocker,
        dockerContainer: this.settings.dockerContainer,
        supabaseProjectRef: this.settings.supabaseProjectRef,
        supabaseApiKey: this.settings.supabaseApiKey
      };
      this.db = new Database(dbConfig);
      await this.db.connect();
    }
    return this.db;
  }
  /**
   * 执行同步
   * @param syncAll 是否同步所有公众号（忽略 feedIds 配置）
   * @param force 是否强制同步（忽略增量状态）
   */
  async sync(syncAll = false, force = false) {
    const startTime = Date.now();
    const result = {
      success: false,
      newArticles: 0,
      updatedArticles: 0,
      errors: [],
      duration: 0
    };
    let db = null;
    try {
      db = await this.getDatabase();
      const healthy = await db.healthCheck();
      if (!healthy) {
        throw new Error("\u6570\u636E\u5E93\u8FDE\u63A5\u5931\u8D25");
      }
      const feeds = await db.getAllFeeds();
      console.log(`[SyncEngine] \u627E\u5230 ${feeds.length} \u4E2A\u516C\u4F17\u53F7`);
      const targetFeeds = syncAll ? feeds : feeds.filter((f) => {
        if (!this.settings.feedIds || this.settings.feedIds.length === 0) return true;
        return this.settings.feedIds.includes(f.id);
      });
      console.log(`[SyncEngine] \u76EE\u6807\u516C\u4F17\u53F7: ${targetFeeds.length}`);
      if (this.settings.dbgptEnabled) {
        await this.dbgptClient.ensureSpace();
      }
      for (const feed of targetFeeds) {
        try {
          const feedResult = await this.syncFeed(db, feed, force);
          result.newArticles += feedResult.newArticles;
          result.updatedArticles += feedResult.updatedArticles;
        } catch (error) {
          result.errors.push(`\u540C\u6B65\u516C\u4F17\u53F7 ${feed.mp_name} \u5931\u8D25: ${error.message}`);
          console.error(`[SyncEngine] \u540C\u6B65\u516C\u4F17\u53F7 ${feed.mp_name} \u5931\u8D25:`, error);
        }
      }
      this.saveSyncState();
      result.success = true;
      result.duration = Date.now() - startTime;
      console.log(`[SyncEngine] \u540C\u6B65\u5B8C\u6210: \u65B0\u589E ${result.newArticles}, \u66F4\u65B0 ${result.updatedArticles}, \u8017\u65F6 ${result.duration}ms`);
    } catch (error) {
      result.errors.push(error.message);
      console.error("[SyncEngine] \u540C\u6B65\u5931\u8D25:", error);
    } finally {
      if (db) {
        await db.close();
      }
    }
    return result;
  }
  /**
   * 同步单个公众号
   */
  async syncFeed(db, feed, force) {
    const result = { newArticles: 0, updatedArticles: 0 };
    const lastState = force ? null : this.syncState[feed.id];
    const since = lastState?.last_updated_at_millis || 0;
    const articles = await db.getArticlesByFeed(feed.id, since, this.settings.batchSize);
    if (articles.length === 0) {
      console.log(`[SyncEngine] \u516C\u4F17\u53F7 ${feed.mp_name} \u65E0\u65B0\u6587\u7AE0`);
      return result;
    }
    console.log(`[SyncEngine] \u516C\u4F17\u53F7 ${feed.mp_name} \u53D1\u73B0 ${articles.length} \u7BC7\u65B0/\u66F4\u65B0\u6587\u7AE0`);
    const baseDir = `${this.settings.vaultPath}/WeChat-Articles/${feed.mp_name}`;
    await this.writer.ensureDirectory(baseDir);
    for (const article of articles) {
      try {
        const filename = generateFilename(article);
        const filepath = `${baseDir}/${filename}`;
        const exists = await this.writer.exists(filepath);
        if (exists && !force) {
          const articleModTime = await this.writer.getModTime(filepath);
          if (article.updated_at_millis <= articleModTime) {
            continue;
          }
        }
        const content = this.generateMarkdown(feed, article);
        await this.writer.write(filepath, content);
        if (this.settings.dbgptEnabled) {
          try {
            await this.dbgptClient.uploadDocument(filepath);
          } catch (error) {
            console.error(`[SyncEngine] \u4E0A\u4F20 DB-GPT \u5931\u8D25: ${filename}`, error);
          }
        }
        if (exists) {
          result.updatedArticles++;
        } else {
          result.newArticles++;
        }
        this.syncState[feed.id] = {
          last_sync: (/* @__PURE__ */ new Date()).toISOString(),
          last_article_id: article.id,
          last_updated_at_millis: article.updated_at_millis
        };
      } catch (error) {
        console.error(`[SyncEngine] \u5904\u7406\u6587\u7AE0\u5931\u8D25: ${article.title}`, error);
      }
    }
    return result;
  }
  /**
   * 生成 Markdown 内容
   */
  generateMarkdown(feed, article) {
    const frontmatter = {
      title: article.title,
      publish_time: formatDate(article.publish_time * 1e3, "ISO"),
      source_url: article.url,
      mp_name: feed.mp_name,
      mp_id: feed.id,
      article_id: article.id,
      synced_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at_millis: article.updated_at_millis
    };
    const fmLines = ["---"];
    for (const [key, value] of Object.entries(frontmatter)) {
      if (value !== void 0 && value !== null) {
        if (typeof value === "string" && (value.includes(":") || value.includes("#") || value.includes('"'))) {
          fmLines.push(`${key}: "${value.replace(/"/g, '\\"')}"`);
        } else {
          fmLines.push(`${key}: ${value}`);
        }
      }
    }
    fmLines.push("---\n");
    let body = article.content || article.description || "";
    if (article.content_html && article.content_html !== article.content) {
      body = body || `\uFF08\u4EE5\u4E0B\u4E3A HTML \u539F\u6587\uFF09

${article.content_html}`;
    }
    const footer = `

---

\u6765\u6E90: [${feed.mp_name}](${article.url})`;
    return fmLines.join("\n") + body + footer;
  }
};

// src/DBGPTClient.ts
var fs2 = __toESM(require("fs"));
var path2 = __toESM(require("path"));
var DBGPTClient = class {
  constructor(config) {
    this.config = config;
  }
  /**
   * 更新配置
   */
  updateConfig(config) {
    this.config = config;
  }
  /**
   * 确保知识库空间存在
   */
  async ensureSpace() {
    try {
      const url = `${this.config.apiUrl}/knowledge/space/add`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...this.config.apiKey && { "Authorization": `Bearer ${this.config.apiKey}` }
        },
        body: JSON.stringify({
          name: this.config.spaceName,
          vector_type: "Chroma",
          desc: "We-MP-RSS \u6587\u7AE0\u77E5\u8BC6\u5E93",
          domain_type: "Normal",
          owner: "we-mp-rss-sync"
        })
      });
      if (response.ok) {
        console.log("[DBGPTClient] \u77E5\u8BC6\u5E93\u7A7A\u95F4\u5DF2\u5C31\u7EEA:", this.config.spaceName);
        return true;
      }
      const data = await response.json();
      if (data.code === "001" || data.message?.includes("already exists")) {
        console.log("[DBGPTClient] \u77E5\u8BC6\u5E93\u7A7A\u95F4\u5DF2\u5B58\u5728:", this.config.spaceName);
        return true;
      }
      console.warn("[DBGPTClient] \u521B\u5EFA\u7A7A\u95F4\u54CD\u5E94:", data);
      return false;
    } catch (error) {
      console.error("[DBGPTClient] \u786E\u4FDD\u7A7A\u95F4\u5931\u8D25:", error);
      return false;
    }
  }
  /**
   * 上传文档到知识库
   */
  async uploadDocument(filePath, documentName) {
    if (!fs2.existsSync(filePath)) {
      console.warn("[DBGPTClient] \u6587\u4EF6\u4E0D\u5B58\u5728:", filePath);
      return false;
    }
    try {
      const fileName = documentName || path2.basename(filePath);
      const fileContent = fs2.readFileSync(filePath);
      const mimeType = this.getMimeType(filePath);
      const formData = new FormData();
      formData.append("file", new Blob([fileContent], { type: mimeType }), fileName);
      const url = `${this.config.apiUrl}/knowledge/${this.config.spaceName}/document/upload`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          ...this.config.apiKey && { "Authorization": `Bearer ${this.config.apiKey}` }
        },
        body: formData
      });
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`DB-GPT upload failed: ${response.status} - ${error}`);
      }
      const result = await response.json();
      console.log(`[DBGPTClient] \u4E0A\u4F20\u6210\u529F: ${fileName}`, result);
      return true;
    } catch (error) {
      console.error("[DBGPTClient] \u4E0A\u4F20\u5931\u8D25:", error);
      throw error;
    }
  }
  /**
   * 列出知识空间中的文档
   */
  async listDocuments() {
    try {
      const url = `${this.config.apiUrl}/knowledge/${this.config.spaceName}/document/list`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...this.config.apiKey && { "Authorization": `Bearer ${this.config.apiKey}` }
        }
      });
      if (!response.ok) {
        throw new Error(`Failed to list documents: ${response.status}`);
      }
      const result = await response.json();
      return result.data || [];
    } catch (error) {
      console.error("[DBGPTClient] \u5217\u51FA\u6587\u6863\u5931\u8D25:", error);
      return [];
    }
  }
  /**
   * 删除文档
   */
  async deleteDocument(docId) {
    try {
      const url = `${this.config.apiUrl}/knowledge/${this.config.spaceName}/document/delete`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...this.config.apiKey && { "Authorization": `Bearer ${this.config.apiKey}` }
        },
        body: JSON.stringify({
          doc_ids: [docId]
        })
      });
      return response.ok;
    } catch (error) {
      console.error("[DBGPTClient] \u5220\u9664\u6587\u6863\u5931\u8D25:", error);
      return false;
    }
  }
  /**
   * 同步文档（触发向量化）
   */
  async syncDocument(docId) {
    try {
      const url = `${this.config.apiUrl}/knowledge/${this.config.spaceName}/document/sync`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...this.config.apiKey && { "Authorization": `Bearer ${this.config.apiKey}` }
        },
        body: JSON.stringify({
          doc_ids: [docId],
          model_name: "text2vec"
        })
      });
      return response.ok;
    } catch (error) {
      console.error("[DBGPTClient] \u540C\u6B65\u6587\u6863\u5931\u8D25:", error);
      return false;
    }
  }
  /**
   * 获取文件 MIME 类型
   */
  getMimeType(filePath) {
    const ext = path2.extname(filePath).toLowerCase();
    const mimeTypes = {
      ".md": "text/markdown",
      ".txt": "text/plain",
      ".pdf": "application/pdf",
      ".doc": "application/msword",
      ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    };
    return mimeTypes[ext] || "text/plain";
  }
  /**
   * 检查 API 连接是否正常
   */
  async healthCheck() {
    try {
      const url = `${this.config.apiUrl}/knowledge/space/list`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...this.config.apiKey && { "Authorization": `Bearer ${this.config.apiKey}` }
        }
      });
      return response.ok;
    } catch {
      return false;
    }
  }
};

// main.ts
var WeMPRSSSyncPlugin = class extends import_obsidian2.Plugin {
  async onload() {
    console.log("[We-MP-RSS Sync] \u63D2\u4EF6\u52A0\u8F7D\u4E2D...");
    await this.loadSettings();
    this.dbgptClient = new DBGPTClient({
      apiUrl: this.settings.dbgptApiUrl,
      spaceName: this.settings.dbgptSpaceName,
      apiKey: this.settings.dbgptApiKey
    });
    this.syncEngine = new SyncEngine(this.settings, this.dbgptClient);
    this.addSettingTab(new (init_Settings(), __toCommonJS(Settings_exports)).WeMPRSSSyncSettingsTab(this.app, this));
    this.addCommand({
      id: "sync-now",
      name: "\u7ACB\u5373\u540C\u6B65\u6587\u7AE0",
      callback: async () => {
        await this.syncNow();
      }
    });
    this.addCommand({
      id: "sync-all-feeds",
      name: "\u540C\u6B65\u6240\u6709\u516C\u4F17\u53F7\u6587\u7AE0",
      callback: async () => {
        await this.syncNow(true);
      }
    });
    this.addCommand({
      id: "force-sync",
      name: "\u5F3A\u5236\u540C\u6B65\u6240\u6709\u6587\u7AE0",
      callback: async () => {
        await this.syncNow(false, true);
      }
    });
    if (this.settings.autoSync && this.settings.syncIntervalMinutes > 0) {
      this.startAutoSync();
    }
    console.log("[We-MP-RSS Sync] \u63D2\u4EF6\u52A0\u8F7D\u5B8C\u6210");
  }
  async onunload() {
    console.log("[We-MP-RSS Sync] \u63D2\u4EF6\u5378\u8F7D");
    if (this.syncEngine?.intervalId) {
      clearInterval(this.syncEngine.intervalId);
    }
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
    if (this.syncEngine) {
      this.syncEngine.updateConfig(this.settings);
    }
    if (this.dbgptClient) {
      this.dbgptClient.updateConfig({
        apiUrl: this.settings.dbgptApiUrl,
        spaceName: this.settings.dbgptSpaceName,
        apiKey: this.settings.dbgptApiKey
      });
    }
    if (this.syncEngine?.intervalId) {
      clearInterval(this.syncEngine.intervalId);
    }
    if (this.settings.autoSync && this.settings.syncIntervalMinutes > 0) {
      this.startAutoSync();
    }
  }
  startAutoSync() {
    const intervalMs = this.settings.syncIntervalMinutes * 60 * 1e3;
    console.log(`[We-MP-RSS Sync] \u542F\u52A8\u81EA\u52A8\u540C\u6B65\uFF0C\u95F4\u9694 ${this.settings.syncIntervalMinutes} \u5206\u949F`);
    this.syncEngine.intervalId = setInterval(async () => {
      try {
        await this.syncNow();
      } catch (error) {
        console.error("[We-MP-RSS Sync] \u81EA\u52A8\u540C\u6B65\u5931\u8D25:", error);
      }
    }, intervalMs);
  }
  async syncNow(syncAll = false, force = false) {
    console.log(`[We-MP-RSS Sync] \u5F00\u59CB\u540C\u6B65... (syncAll=${syncAll}, force=${force})`);
    const statusEl = document.createElement("div");
    statusEl.style.cssText = "position:fixed;bottom:20px;right:20px;background:#4CAF50;color:white;padding:10px 20px;border-radius:5px;z-index:1000;";
    statusEl.textContent = "\u540C\u6B65\u4E2D...";
    document.body.appendChild(statusEl);
    try {
      const result = await this.syncEngine.sync(syncAll, force);
      statusEl.style.background = "#4CAF50";
      statusEl.textContent = `\u540C\u6B65\u5B8C\u6210\uFF01\u65B0\u589E: ${result.newArticles}, \u66F4\u65B0: ${result.updatedArticles}`;
    } catch (error) {
      console.error("[We-MP-RSS Sync] \u540C\u6B65\u5931\u8D25:", error);
      statusEl.style.background = "#f44336";
      statusEl.textContent = `\u540C\u6B65\u5931\u8D25: ${error.message}`;
    } finally {
      setTimeout(() => {
        statusEl.remove();
      }, 3e3);
    }
  }
};
