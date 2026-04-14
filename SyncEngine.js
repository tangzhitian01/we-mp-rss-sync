/**
 * We-MP-RSS Sync - 增量同步引擎
 */
import { Database } from './Database';
import { ObsidianWriter } from './ObsidianWriter';
import { generateFilename, formatDate } from './utils';
export class SyncEngine {
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
        this.db = null; // 重置连接，下次sync时重新创建
    }
    /**
     * 加载同步状态
     */
    loadSyncState() {
        try {
            const statePath = `${this.settings.vaultPath}/.we-mp-rss-sync-state.json`;
            const fs = require('fs');
            if (fs.existsSync(statePath)) {
                this.syncState = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
                console.log('[SyncEngine] 已加载同步状态:', Object.keys(this.syncState).length, '个公众号');
            }
        }
        catch (error) {
            console.error('[SyncEngine] 加载同步状态失败:', error);
            this.syncState = {};
        }
    }
    /**
     * 保存同步状态
     */
    saveSyncState() {
        try {
            const statePath = `${this.settings.vaultPath}/.we-mp-rss-sync-state.json`;
            const fs = require('fs');
            fs.writeFileSync(statePath, JSON.stringify(this.syncState, null, 2));
        }
        catch (error) {
            console.error('[SyncEngine] 保存同步状态失败:', error);
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
            // 获取数据库连接
            db = await this.getDatabase();
            // 健康检查
            const healthy = await db.healthCheck();
            if (!healthy) {
                throw new Error('数据库连接失败');
            }
            // 获取需要同步的公众号列表
            const feeds = await db.getAllFeeds();
            console.log(`[SyncEngine] 找到 ${feeds.length} 个公众号`);
            // 过滤公众号
            const targetFeeds = syncAll
                ? feeds
                : feeds.filter(f => {
                    if (!this.settings.feedIds || this.settings.feedIds.length === 0)
                        return true;
                    return this.settings.feedIds.includes(f.id);
                });
            console.log(`[SyncEngine] 目标公众号: ${targetFeeds.length}`);
            // 确保 DB-GPT 空间存在
            if (this.settings.dbgptEnabled) {
                await this.dbgptClient.ensureSpace();
            }
            // 同步每个公众号的文章
            for (const feed of targetFeeds) {
                try {
                    const feedResult = await this.syncFeed(db, feed, force);
                    result.newArticles += feedResult.newArticles;
                    result.updatedArticles += feedResult.updatedArticles;
                }
                catch (error) {
                    result.errors.push(`同步公众号 ${feed.mp_name} 失败: ${error.message}`);
                    console.error(`[SyncEngine] 同步公众号 ${feed.mp_name} 失败:`, error);
                }
            }
            // 保存同步状态
            this.saveSyncState();
            result.success = true;
            result.duration = Date.now() - startTime;
            console.log(`[SyncEngine] 同步完成: 新增 ${result.newArticles}, 更新 ${result.updatedArticles}, 耗时 ${result.duration}ms`);
        }
        catch (error) {
            result.errors.push(error.message);
            console.error('[SyncEngine] 同步失败:', error);
        }
        finally {
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
        // 获取增量起点
        const lastState = force ? null : this.syncState[feed.id];
        const since = lastState?.last_updated_at_millis || 0;
        // 查询增量文章
        const articles = await db.getArticlesByFeed(feed.id, since, this.settings.batchSize);
        if (articles.length === 0) {
            console.log(`[SyncEngine] 公众号 ${feed.mp_name} 无新文章`);
            return result;
        }
        console.log(`[SyncEngine] 公众号 ${feed.mp_name} 发现 ${articles.length} 篇新/更新文章`);
        // 创建公众号目录
        const baseDir = `${this.settings.vaultPath}/WeChat-Articles/${feed.mp_name}`;
        await this.writer.ensureDirectory(baseDir);
        // 写入每篇文章
        for (const article of articles) {
            try {
                const filename = generateFilename(article);
                const filepath = `${baseDir}/${filename}`;
                const exists = await this.writer.exists(filepath);
                if (exists && !force) {
                    // 检查是否需要更新
                    const articleModTime = await this.writer.getModTime(filepath);
                    if (article.updated_at_millis <= articleModTime) {
                        continue; // 无需更新
                    }
                }
                // 生成 Markdown 内容
                const content = this.generateMarkdown(feed, article);
                // 写入文件
                await this.writer.write(filepath, content);
                // 上传到 DB-GPT
                if (this.settings.dbgptEnabled) {
                    try {
                        await this.dbgptClient.uploadDocument(filepath);
                    }
                    catch (error) {
                        console.error(`[SyncEngine] 上传 DB-GPT 失败: ${filename}`, error);
                    }
                }
                // 更新统计
                if (exists) {
                    result.updatedArticles++;
                }
                else {
                    result.newArticles++;
                }
                // 更新同步状态
                this.syncState[feed.id] = {
                    last_sync: new Date().toISOString(),
                    last_article_id: article.id,
                    last_updated_at_millis: article.updated_at_millis
                };
            }
            catch (error) {
                console.error(`[SyncEngine] 处理文章失败: ${article.title}`, error);
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
            publish_time: formatDate(article.publish_time * 1000, 'ISO'),
            source_url: article.url,
            mp_name: feed.mp_name,
            mp_id: feed.id,
            article_id: article.id,
            synced_at: new Date().toISOString(),
            updated_at_millis: article.updated_at_millis
        };
        // 构建 YAML frontmatter
        const fmLines = ['---'];
        for (const [key, value] of Object.entries(frontmatter)) {
            if (value !== undefined && value !== null) {
                if (typeof value === 'string' && (value.includes(':') || value.includes('#') || value.includes('"'))) {
                    fmLines.push(`${key}: "${value.replace(/"/g, '\\"')}"`);
                }
                else {
                    fmLines.push(`${key}: ${value}`);
                }
            }
        }
        fmLines.push('---\n');
        // 构建正文
        let body = article.content || article.description || '';
        // 如果有 HTML 内容，保留原始格式说明
        if (article.content_html && article.content_html !== article.content) {
            body = body || `（以下为 HTML 原文）\n\n${article.content_html}`;
        }
        // 添加来源信息
        const footer = `\n\n---\n\n来源: [${feed.mp_name}](${article.url})`;
        return fmLines.join('\n') + body + footer;
    }
}
