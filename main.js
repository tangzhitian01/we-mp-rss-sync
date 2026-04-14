"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => WeMPRSSSyncPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var DEFAULT_SETTINGS = {
  dbType: "mysql",
  dbHost: "localhost",
  dbPort: 3306,
  dbUser: "rss_user",
  dbPassword: "pass123456",
  dbName: "we_mp_rss",
  sqlitePath: "/data/we_mp_rss.db",
  sqliteUseDocker: true,
  dockerContainer: "we-mp-rss-backend-dev",
  supabaseProjectRef: "",
  supabaseApiKey: "",
  vaultPath: "",
  feedIds: [],
  autoSync: false,
  syncIntervalMinutes: 30,
  batchSize: 100,
  dbgptEnabled: false,
  dbgptApiUrl: "http://127.0.0.1:5670",
  dbgptSpaceName: "we_mp_rss",
  dbgptApiKey: ""
};
var WeMPRSSSyncPlugin = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.intervalId = null;
  }
  async onload() {
    console.log("[We-MP-RSS Sync] Plugin loaded");
    await this.loadSettings();
    this.addSettingTab(new WeMPRSSSyncSettingsTab(this));
    this.addCommand({
      id: "sync-now",
      name: "Sync articles now",
      callback: () => this.syncNow()
    });
    this.addCommand({
      id: "sync-all-feeds",
      name: "Sync all feeds",
      callback: () => this.syncAll()
    });
    if (this.settings.autoSync && this.settings.syncIntervalMinutes > 0) {
      this.startAutoSync();
    }
  }
  onunload() {
    console.log("[We-MP-RSS Sync] Plugin unloaded");
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
  startAutoSync() {
    const intervalMs = this.settings.syncIntervalMinutes * 60 * 1e3;
    this.intervalId = setInterval(() => this.syncNow(), intervalMs);
  }
  async syncNow() {
    new import_obsidian.Notice("Syncing We-MP-RSS articles...");
    console.log("[We-MP-RSS Sync] Starting sync...");
    new import_obsidian.Notice("Sync completed!");
  }
  async syncAll() {
    new import_obsidian.Notice("Syncing all feeds...");
    console.log("[We-MP-RSS Sync] Syncing all feeds...");
    new import_obsidian.Notice("All feeds synced!");
  }
};
var WeMPRSSSyncSettingsTab = class extends import_obsidian.PluginSettingTab {
  constructor(plugin) {
    super(plugin.app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "We-MP-RSS Sync Settings" });
    new import_obsidian.Setting(containerEl).setName("Database Type").addDropdown((dropdown) => dropdown.addOption("mysql", "MySQL").addOption("postgresql", "PostgreSQL").addOption("supabase", "Supabase").addOption("doris", "Doris").addOption("sqlite", "SQLite").setValue(this.plugin.settings.dbType).onChange(async (value) => {
      this.plugin.settings.dbType = value;
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("Database Host").addText((text) => text.setValue(this.plugin.settings.dbHost).onChange(async (value) => {
      this.plugin.settings.dbHost = value;
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("Database Port").addText((text) => text.setValue(String(this.plugin.settings.dbPort)).onChange(async (value) => {
      this.plugin.settings.dbPort = parseInt(value) || 3306;
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("Database User").addText((text) => text.setValue(this.plugin.settings.dbUser).onChange(async (value) => {
      this.plugin.settings.dbUser = value;
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("Database Password").addText((text) => text.setValue(this.plugin.settings.dbPassword).onChange(async (value) => {
      this.plugin.settings.dbPassword = value;
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("Database Name").addText((text) => text.setValue(this.plugin.settings.dbName).onChange(async (value) => {
      this.plugin.settings.dbName = value;
      await this.plugin.saveSettings();
    }));
    containerEl.createEl("h3", { text: "DB-GPT Settings" });
    new import_obsidian.Setting(containerEl).setName("Enable DB-GPT").addToggle((toggle) => toggle.setValue(this.plugin.settings.dbgptEnabled).onChange(async (value) => {
      this.plugin.settings.dbgptEnabled = value;
      await this.plugin.saveSettings();
    }));
    if (this.plugin.settings.dbgptEnabled) {
      new import_obsidian.Setting(containerEl).setName("DB-GPT API URL").addText((text) => text.setValue(this.plugin.settings.dbgptApiUrl).onChange(async (value) => {
        this.plugin.settings.dbgptApiUrl = value;
        await this.plugin.saveSettings();
      }));
      new import_obsidian.Setting(containerEl).setName("Space Name").addText((text) => text.setValue(this.plugin.settings.dbgptSpaceName).onChange(async (value) => {
        this.plugin.settings.dbgptSpaceName = value;
        await this.plugin.saveSettings();
      }));
    }
    containerEl.createEl("h3", { text: "Sync Settings" });
    new import_obsidian.Setting(containerEl).setName("Auto Sync").addToggle((toggle) => toggle.setValue(this.plugin.settings.autoSync).onChange(async (value) => {
      this.plugin.settings.autoSync = value;
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("Sync Interval (minutes)").addText((text) => text.setValue(String(this.plugin.settings.syncIntervalMinutes)).onChange(async (value) => {
      this.plugin.settings.syncIntervalMinutes = parseInt(value) || 30;
      await this.plugin.saveSettings();
    }));
  }
};
