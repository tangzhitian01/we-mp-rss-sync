import { Notice, App, TFile } from 'obsidian';
import { Database, Article, Feed, DatabaseConfig } from './Database';
import { ObsidianWriter } from './ObsidianWriter';
import { DBGPTClient, DBGPTConfig } from './DBGPTClient';

export interface SyncState {
  lastSyncTime: string;
  feedSyncStates: Record<string, number>; // feedId -> last synced updated_at_millis
}

export interface SyncResult {
  success: boolean;
  totalArticles: number;
  newArticles: number;
  updatedArticles: number;
  failedArticles: number;
  dbgptUploaded: number;
  error?: string;
}

export class SyncEngine {
  private app: App;
  private database: Database;
  private writer: ObsidianWriter;
  private dbgptClient: DBGPTClient;
  private syncState: SyncState;
  private stateFilePath: string = '.we-mp-rss-sync-state.json';

  constructor(
    app: App,
    dbConfig: DatabaseConfig,
    dbgptConfig: DBGPTConfig,
    vaultPath: string
  ) {
    this.app = app;
    this.database = new Database(dbConfig);
    this.writer = new ObsidianWriter(app, vaultPath);
    this.dbgptClient = new DBGPTClient(dbgptConfig);
    this.syncState = this.loadSyncState();
  }

  /**
   * Load sync state from file
   */
  private loadSyncState(): SyncState {
    try {
      const stateFile = this.app.vault.getAbstractFileByPath(this.stateFilePath);
      if (stateFile && stateFile instanceof require('obsidian').TFile) {
        const content = require('obsidian').require(this.app.vault.adapter).read(stateFile.path);
        return JSON.parse(content);
      }
    } catch (error) {
      console.log('[We-MP-RSS Sync] No existing sync state found, starting fresh');
    }
    return {
      lastSyncTime: '',
      feedSyncStates: {}
    };
  }

  /**
   * Save sync state to file
   */
  private async saveSyncState(): Promise<void> {
    try {
      const content = JSON.stringify(this.syncState, null, 2);
      const stateFile = this.app.vault.getAbstractFileByPath(this.stateFilePath);

      if (stateFile && stateFile instanceof TFile) {
        await this.app.vault.modify(stateFile, content);
      } else {
        await this.app.vault.create(this.stateFilePath, content);
      }
    } catch (error) {
      console.error('[We-MP-RSS Sync] Failed to save sync state:', error);
    }
  }

  /**
   * Update sync state after successful sync
   */
  private updateSyncState(feedId: string, latestMillis: number): void {
    this.syncState.lastSyncTime = new Date().toISOString();
    this.syncState.feedSyncStates[feedId] = latestMillis;
  }

  /**
   * Sync articles for a specific feed
   */
  async syncFeed(feedId: string, forceFullSync: boolean = false): Promise<SyncResult> {
    const result: SyncResult = {
      success: false,
      totalArticles: 0,
      newArticles: 0,
      updatedArticles: 0,
      failedArticles: 0,
      dbgptUploaded: 0
    };

    try {
      // Initialize database if needed
      await this.database.initialize();

      // Get feed info
      const feeds = await this.database.getAllFeeds();
      const feed = feeds.find(f => f.id === feedId);
      if (!feed) {
        result.error = `Feed not found: ${feedId}`;
        return result;
      }

      // Determine sync point
      let updatedAfterMillis: number | undefined;
      if (!forceFullSync && this.syncState.feedSyncStates[feedId]) {
        updatedAfterMillis = this.syncState.feedSyncStates[feedId];
      }

      // Fetch articles
      const articles = await this.database.getArticlesByFeed(feedId, updatedAfterMillis);
      result.totalArticles = articles.length;

      if (articles.length === 0) {
        result.success = true;
        return result;
      }

      // Write to Obsidian
      const writeResult = await this.writer.writeArticles(articles, [feed]);
      result.newArticles = writeResult.newCount;
      result.updatedArticles = writeResult.updateCount;
      result.failedArticles = writeResult.failed;

      // Upload to DB-GPT if enabled
      if (this.dbgptClient && this.dbgptClient) {
        const dbgptEnabled = (this.dbgptClient as any).config?.enabled;
        if (dbgptEnabled) {
          for (const article of articles) {
            try {
              const content = this.formatForDBGPT(article, feed);
              const uploadResult = await this.dbgptClient.uploadDocument(
                content,
                `${article.id}.md`,
                {
                  mp_name: feed.mp_name,
                  publish_time: new Date(article.publish_time * 1000).toISOString()
                }
              );
              if (uploadResult.success) {
                result.dbgptUploaded++;
              }
            } catch (error) {
              console.error(`[We-MP-RSS Sync] DB-GPT upload failed for ${article.id}:`, error);
            }
          }
        }
      }

      // Update sync state with latest article timestamp
      const latestArticle = articles.reduce((latest, article) =>
        article.updated_at_millis > latest.updated_at_millis ? article : latest
      , articles[0]);

      this.updateSyncState(feedId, latestArticle.updated_at_millis);
      await this.saveSyncState();

      result.success = true;
      new Notice(`[We-MP-RSS Sync] Synced ${articles.length} articles for ${feed.mp_name}`);

    } catch (error) {
      console.error('[We-MP-RSS Sync] Sync failed:', error);
      result.error = String(error);
      new Notice(`Sync failed: ${error}`);
    }

    return result;
  }

  /**
   * Sync all configured feeds
   */
  async syncAllFeeds(feedIds: string[], forceFullSync: boolean = false): Promise<SyncResult> {
    const totalResult: SyncResult = {
      success: true,
      totalArticles: 0,
      newArticles: 0,
      updatedArticles: 0,
      failedArticles: 0,
      dbgptUploaded: 0
    };

    try {
      await this.database.initialize();

      // If no feeds specified, get all feeds
      let feedsToSync = feedIds;
      if (feedsToSync.length === 0) {
        const allFeeds = await this.database.getAllFeeds();
        feedsToSync = allFeeds.map(f => f.id);
      }

      for (const feedId of feedsToSync) {
        const result = await this.syncFeed(feedId, forceFullSync);
        totalResult.totalArticles += result.totalArticles;
        totalResult.newArticles += result.newArticles;
        totalResult.updatedArticles += result.updatedArticles;
        totalResult.failedArticles += result.failedArticles;
        totalResult.dbgptUploaded += result.dbgptUploaded;

        if (!result.success) {
          totalResult.success = false;
          totalResult.error = result.error;
        }
      }

      new Notice(
        `[We-MP-RSS Sync] Sync complete: ${totalResult.newArticles} new, ${totalResult.updatedArticles} updated, ${totalResult.failedArticles} failed`
      );

    } catch (error) {
      console.error('[We-MP-RSS Sync] Sync all failed:', error);
      totalResult.success = false;
      totalResult.error = String(error);
    }

    return totalResult;
  }

  /**
   * Format article content for DB-GPT upload
   */
  private formatForDBGPT(article: Article, feed: Feed): string {
    return `# ${article.title}

**来源**: ${feed.mp_name}
**发布时间**: ${new Date(article.publish_time * 1000).toISOString()}
**链接**: ${article.url}

---

${article.content || article.description || ''}

---
原文链接: ${article.url}
`;
  }

  /**
   * Test database connection
   */
  async testDatabaseConnection(): Promise<boolean> {
    try {
      await this.database.initialize();
      return await this.database.testConnection();
    } catch (error) {
      console.error('[We-MP-RSS Sync] Database connection test failed:', error);
      return false;
    }
  }

  /**
   * Get current sync state
   */
  getSyncState(): SyncState {
    return { ...this.syncState };
  }

  /**
   * Get feeds with sync status
   */
  async getFeedsWithSyncStatus(): Promise<Array<{ feed: Feed; lastSynced?: number; articleCount: number }>> {
    try {
      await this.database.initialize();
      const feeds = await this.database.getAllFeeds();
      const result: Array<{ feed: Feed; lastSynced?: number; articleCount: number }> = [];

      for (const feed of feeds) {
        const lastSynced = this.syncState.feedSyncStates[feed.id];
        const articleCount = await this.writer.getSyncedArticleCount(feed.id);
        result.push({ feed, lastSynced, articleCount });
      }

      return result;
    } catch (error) {
      console.error('[We-MP-RSS Sync] Failed to get feeds with sync status:', error);
      return [];
    }
  }

  /**
   * Close resources
   */
  close(): void {
    this.database.close();
  }
}
