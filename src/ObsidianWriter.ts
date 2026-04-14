import { App, Notice, TFile, TFolder } from 'obsidian';
import type { Article, Feed } from './Database';

export interface WriteResult {
  success: boolean;
  filePath?: string;
  isNew: boolean;
  updated: boolean;
  error?: string;
}

export class ObsidianWriter {
  private app: App;
  private basePath: string;

  constructor(app: App, basePath: string = 'WeChat-Articles') {
    this.app = app;
    this.basePath = basePath;
  }

  /**
   * Generate safe filename from article title
   */
  private sanitizeFilename(title: string): string {
    // Remove or replace invalid filename characters
    return title
      .replace(/[\\/:*?"<>|]/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
      .substring(0, 200);
  }

  /**
   * Generate article filename: yyyy-mm-dd-hh+title.md
   */
  private generateFilename(article: Article): string {
    const date = new Date(article.publish_time * 1000);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const title = this.sanitizeFilename(article.title);
    return `${yyyy}-${mm}-${dd}-${hh}+${title}.md`;
  }

  /**
   * Ensure the folder exists for a feed, create if needed
   */
  private async ensureFeedFolder(feed: Feed): Promise<TFolder> {
    const folderPath = `${this.basePath}/${feed.mp_name}`;

    let folder = this.app.vault.getAbstractFileByPath(folderPath);
    if (!folder) {
      await this.app.vault.createFolder(folderPath);
      folder = this.app.vault.getAbstractFileByPath(folderPath);
    }

    return folder as TFolder;
  }

  /**
   * Generate YAML frontmatter for an article
   */
  private generateFrontmatter(article: Article, feed: Feed, syncedAt: string): string {
    const publishTime = new Date(article.publish_time * 1000).toISOString();
    const updatedAt = new Date(article.updated_at_millis).toISOString();

    return `---
title: "${this.escapeYamlString(article.title)}"
publish_time: "${publishTime}"
source_url: "${article.url}"
mp_name: "${this.escapeYamlString(feed.mp_name)}"
mp_id: "${feed.id}"
article_id: "${article.id}"
cover_image: "${feed.mp_cover || ''}"
description: "${this.escapeYamlString(article.description || '')}"
synced_at: "${syncedAt}"
updated_at_millis: ${article.updated_at_millis}
---

# ${this.escapeYamlString(article.title)}

`;
  }

  /**
   * Escape special characters in YAML strings
   */
  private escapeYamlString(str: string): string {
    if (!str) return '';
    return str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  }

  /**
   * Check if a file exists and whether it needs updating
   */
  private async getExistingFile(feed: Feed, article: Article): Promise<TFile | null> {
    const folder = await this.ensureFeedFolder(feed);
    const filename = this.generateFilename(article);
    const filePath = `${folder.path}/${filename}`;

    const file = this.app.vault.getAbstractFileByPath(filePath);
    return file instanceof TFile ? file : null;
  }

  /**
   * Write or update an article to the vault
   */
  async writeArticle(article: Article, feed: Feed): Promise<WriteResult> {
    try {
      const syncedAt = new Date().toISOString();
      const folder = await this.ensureFeedFolder(feed);
      const filename = this.generateFilename(article);
      const filePath = `${folder.path}/${filename}`;

      const existingFile = await this.getExistingFile(feed, article);
      const frontmatter = this.generateFrontmatter(article, feed, syncedAt);
      const content = article.content || article.description || '';

      // Format content with source attribution
      const formattedContent = `${frontmatter}${content}

---

来源: [${feed.mp_name}](${article.url})
`;

      if (existingFile) {
        // Check if update is needed by comparing updated_at_millis
        const existingContent = await this.app.vault.read(existingFile);
        const existingMatch = existingContent.match(/updated_at_millis:\s*(\d+)/);

        if (existingMatch) {
          const existingMillis = parseInt(existingMatch[1]);
          if (existingMillis >= article.updated_at_millis) {
            return {
              success: true,
              filePath: existingFile.path,
              isNew: false,
              updated: false
            };
          }
        }

        // Update existing file
        await this.app.vault.modify(existingFile, formattedContent);
        return {
          success: true,
          filePath: existingFile.path,
          isNew: false,
          updated: true
        };
      } else {
        // Create new file
        await this.app.vault.create(filePath, formattedContent);
        return {
          success: true,
          filePath,
          isNew: true,
          updated: false
        };
      }
    } catch (error) {
      console.error('[We-MP-RSS Sync] Failed to write article:', error);
      return {
        success: false,
        error: String(error)
      };
    }
  }

  /**
   * Write multiple articles in batch
   */
  async writeArticles(articles: Article[], feeds: Feed[]): Promise<{ success: number; failed: number; newCount: number; updateCount: number }> {
    const feedMap = new Map(feeds.map(f => [f.id, f]));
    let success = 0;
    let failed = 0;
    let newCount = 0;
    let updateCount = 0;

    for (const article of articles) {
      const feed = feedMap.get(article.mp_id);
      if (!feed) {
        console.warn(`[We-MP-RSS Sync] Feed not found for article: ${article.id}`);
        failed++;
        continue;
      }

      const result = await this.writeArticle(article, feed);
      if (result.success) {
        success++;
        if (result.isNew) newCount++;
        if (result.updated) updateCount++;
      } else {
        failed++;
      }
    }

    return { success, failed, newCount, updateCount };
  }

  /**
   * Get sync state for a feed (latest updated_at_millis written)
   */
  async getFeedSyncState(feedId: string): Promise<number | null> {
    try {
      const folderPath = `${this.basePath}`;
      const folder = this.app.vault.getAbstractFileByPath(folderPath);

      if (!folder || !(folder instanceof TFolder)) {
        return null;
      }

      let latestMillis: number | null = null;

      for (const child of folder.children) {
        if (child instanceof TFolder) {
          // Search recursively in feed folders
          await this.searchFolderForMillis(child, feedId, (millis) => {
            if (latestMillis === null || millis > latestMillis) {
              latestMillis = millis;
            }
          });
        }
      }

      return latestMillis;
    } catch (error) {
      console.error('[We-MP-RSS Sync] Failed to get sync state:', error);
      return null;
    }
  }

  private async searchFolderForMillis(folder: TFolder, feedId: string, callback: (millis: number) => void): Promise<void> {
    for (const child of folder.children) {
      if (child instanceof TFile && child.extension === 'md') {
        try {
          const content = await this.app.vault.read(child);
          const feedIdMatch = content.match(/mp_id:\s*"([^"]+)"/);
          const millisMatch = content.match(/updated_at_millis:\s*(\d+)/);

          if (feedIdMatch && feedIdMatch[1] === feedId && millisMatch) {
            callback(parseInt(millisMatch[1]));
          }
        } catch (error) {
          // Skip files that can't be read
        }
      } else if (child instanceof TFolder) {
        await this.searchFolderForMillis(child, feedId, callback);
      }
    }
  }

  /**
   * Get count of synced articles for a feed
   */
  async getSyncedArticleCount(feedId?: string): Promise<number> {
    let count = 0;
    const folderPath = `${this.basePath}`;
    const folder = this.app.vault.getAbstractFileByPath(folderPath);

    if (!folder || !(folder instanceof TFolder)) {
      return 0;
    }

    count = await this.countFilesInFolder(folder, feedId);
    return count;
  }

  private async countFilesInFolder(folder: TFolder, feedId?: string): Promise<number> {
    let count = 0;

    for (const child of folder.children) {
      if (child instanceof TFile && child.extension === 'md') {
        if (!feedId) {
          count++;
        } else {
          try {
            const content = await this.app.vault.read(child);
            const match = content.match(/mp_id:\s*"([^"]+)"/);
            if (match && match[1] === feedId) {
              count++;
            }
          } catch (error) {
            // Skip
          }
        }
      } else if (child instanceof TFolder) {
        count += await this.countFilesInFolder(child, feedId);
      }
    }

    return count;
  }
}
