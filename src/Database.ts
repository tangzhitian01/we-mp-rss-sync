import { Notice } from 'obsidian';

export type DbType = 'mysql' | 'postgresql' | 'supabase' | 'doris' | 'sqlite';

export interface Article {
  id: string;
  mp_id: string;
  title: string;
  content: string;
  content_html: string;
  url: string;
  description: string;
  publish_time: number;
  updated_at_millis: number;
  status: number;
}

export interface Feed {
  id: string;
  mp_name: string;
  mp_cover: string;
  mp_intro: string;
  status: number;
}

export interface DatabaseConfig {
  dbType: DbType;
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
}

export class Database {
  private config: DatabaseConfig;
  private sqliteDb: any = null;
  private sqlJs: any = null;

  constructor(config: DatabaseConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (this.config.dbType === 'sqlite') {
      await this.initSqlite();
    }
  }

  private async initSqlite(): Promise<void> {
    try {
      const initSqlJs = (window as any).SqlJs;
      if (!initSqlJs) {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.min.js';
        document.head.appendChild(script);
        await new Promise((resolve, reject) => {
          script.onload = resolve;
          script.onerror = reject;
        });
      }
      this.sqlJs = initSqlJs || (window as any).SqlJs;
      const SQL = await this.sqlJs;

      let dbData: Uint8Array | undefined;

      if (this.config.sqliteUseDocker && this.config.dockerContainer) {
        // Try to fetch from we-mp-rss API which serves as a proxy
        const response = await fetch(`/api/database/sqlite`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            container: this.config.dockerContainer,
            path: this.config.sqlitePath
          })
        });
        if (response.ok) {
          const buffer = await response.arrayBuffer();
          dbData = new Uint8Array(buffer);
        }
      } else if (this.config.sqlitePath) {
        const response = await fetch(this.config.sqlitePath);
        if (response.ok) {
          const buffer = await response.arrayBuffer();
          dbData = new Uint8Array(buffer);
        }
      }

      this.sqliteDb = new SQL.Database(dbData);
    } catch (error) {
      console.error('[We-MP-RSS Sync] Failed to initialize SQLite:', error);
      throw error;
    }
  }

  async getArticlesByFeed(feedId: string, updatedAfterMillis?: number, limit: number = 100): Promise<Article[]> {
    const articles: Article[] = [];

    try {
      if (this.config.dbType === 'supabase') {
        return await this.getArticlesFromSupabase(feedId, updatedAfterMillis, limit);
      }

      if (this.config.dbType === 'sqlite' && this.sqliteDb) {
        return this.getArticlesFromSqlite(feedId, updatedAfterMillis, limit);
      }

      // For MySQL/PostgreSQL/Doris, use the we-mp-rss API proxy
      const response = await fetch(`/api/articles?feed_id=${feedId}&updated_after=${updatedAfterMillis || 0}&limit=${limit}`);
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      const data = await response.json();
      return data.articles || [];
    } catch (error) {
      console.error('[We-MP-RSS Sync] Failed to get articles:', error);
      new Notice(`Failed to get articles: ${error}`);
      return [];
    }
  }

  private async getArticlesFromSupabase(feedId: string, updatedAfterMillis?: number, limit: number): Promise<Article[]> {
    const url = `https://${this.config.supabaseProjectRef}.supabase.co/rest/v1/articles`;
    const params = new URLSearchParams({
      'mp_id': `eq.${feedId}`,
      'status': 'eq.1',
      'select': '*',
      'limit': String(limit),
      'order': 'updated_at_millis.desc'
    });

    if (updatedAfterMillis) {
      params.append('updated_at_millis', `gt.${updatedAfterMillis}`);
    }

    const response = await fetch(`${url}?${params}`, {
      headers: {
        'apikey': this.config.supabaseApiKey,
        'Authorization': `Bearer ${this.config.supabaseApiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Supabase error: ${response.status}`);
    }

    return await response.json();
  }

  private getArticlesFromSqlite(feedId: string, updatedAfterMillis?: number, limit: number): Article[] {
    if (!this.sqliteDb) return [];

    let query = 'SELECT * FROM articles WHERE mp_id = ? AND status = 1';
    const params: any[] = [feedId];

    if (updatedAfterMillis) {
      query += ' AND updated_at_millis > ?';
      params.push(updatedAfterMillis);
    }

    query += ' ORDER BY updated_at_millis DESC LIMIT ?';
    params.push(limit);

    const stmt = this.sqliteDb.prepare(query);
    stmt.bind(params);

    const articles: Article[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      articles.push(row as Article);
    }
    stmt.free();

    return articles;
  }

  async getAllFeeds(): Promise<Feed[]> {
    try {
      if (this.config.dbType === 'supabase') {
        return await this.getFeedsFromSupabase();
      }

      if (this.config.dbType === 'sqlite' && this.sqliteDb) {
        return this.getFeedsFromSqlite();
      }

      // Use API proxy
      const response = await fetch('/api/feeds');
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      const data = await response.json();
      return data.feeds || [];
    } catch (error) {
      console.error('[We-MP-RSS Sync] Failed to get feeds:', error);
      new Notice(`Failed to get feeds: ${error}`);
      return [];
    }
  }

  private async getFeedsFromSupabase(): Promise<Feed[]> {
    const url = `https://${this.config.supabaseProjectRef}.supabase.co/rest/v1/feeds`;
    const params = new URLSearchParams({
      'status': 'eq.1',
      'select': '*'
    });

    const response = await fetch(`${url}?${params}`, {
      headers: {
        'apikey': this.config.supabaseApiKey,
        'Authorization': `Bearer ${this.config.supabaseApiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Supabase error: ${response.status}`);
    }

    return await response.json();
  }

  private getFeedsFromSqlite(): Feed[] {
    if (!this.sqliteDb) return [];

    const stmt = this.sqliteDb.prepare('SELECT * FROM feeds WHERE status = 1');
    const feeds: Feed[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      feeds.push(row as Feed);
    }
    stmt.free();

    return feeds;
  }

  async testConnection(): Promise<boolean> {
    try {
      if (this.config.dbType === 'supabase') {
        const response = await fetch(
          `https://${this.config.supabaseProjectRef}.supabase.co/rest/v1/`,
          {
            headers: {
              'apikey': this.config.supabaseApiKey,
              'Authorization': `Bearer ${this.config.supabaseApiKey}`
            }
          }
        );
        return response.ok;
      }

      if (this.config.dbType === 'sqlite') {
        return this.sqliteDb !== null;
      }

      // Test via API proxy
      const response = await fetch('/api/health');
      return response.ok;
    } catch (error) {
      console.error('[We-MP-RSS Sync] Connection test failed:', error);
      return false;
    }
  }

  close(): void {
    if (this.sqliteDb) {
      this.sqliteDb.close();
      this.sqliteDb = null;
    }
  }
}
