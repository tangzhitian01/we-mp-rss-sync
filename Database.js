/**
 * We-MP-RSS Sync - 数据库连接模块
 * 支持 MySQL, PostgreSQL, Supabase, Doris, SQLite
 */
import mysql from 'mysql2/promise';
import { Client as PgClient } from 'pg';
export class Database {
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
            case 'mysql':
            case 'doris':
                await this.connectMySQL();
                break;
            case 'postgresql':
            case 'supabase':
                await this.connectPostgreSQL();
                break;
            case 'sqlite':
                // SQLite 通过 execSync 查询，无需持久连接
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
        this.mysqlPool = mysql.createPool({
            host: this.config.host,
            port: this.config.port,
            user: this.config.user,
            password: this.config.password,
            database: this.config.database,
            waitForConnections: true,
            connectionLimit: 5,
            queueLimit: 0
        });
        // 测试连接
        const conn = await this.mysqlPool.getConnection();
        conn.release();
        console.log('[Database] MySQL/Doris 连接成功');
    }
    /**
     * 连接 PostgreSQL/Supabase
     */
    async connectPostgreSQL() {
        let connectionString;
        if (this.config.type === 'supabase') {
            // Supabase 使用项目引用构造连接字符串
            connectionString = `postgresql://postgres:${this.config.password}@db.${this.config.supabaseProjectRef}.supabase.co:5432/postgres`;
        }
        else {
            connectionString = `postgresql://${this.config.user}:${this.config.password}@${this.config.host}:${this.config.port}/${this.config.database}`;
        }
        this.pgClient = new PgClient({
            connectionString,
            ssl: this.config.type === 'supabase' ? { rejectUnauthorized: false } : undefined
        });
        await this.pgClient.connect();
        console.log('[Database] PostgreSQL/Supabase 连接成功');
    }
    /**
     * 执行查询 - MySQL/Doris
     */
    async queryMySQL(sql, params = []) {
        if (!this.mysqlPool) {
            throw new Error('MySQL 连接未初始化');
        }
        const [rows] = await this.mysqlPool.execute(sql, params);
        return rows;
    }
    /**
     * 执行查询 - PostgreSQL/Supabase
     */
    async queryPostgreSQL(sql, params = []) {
        if (!this.pgClient) {
            throw new Error('PostgreSQL 连接未初始化');
        }
        const result = await this.pgClient.query(sql, params);
        return result.rows;
    }
    /**
     * 执行查询 - SQLite (通过 docker exec)
     */
    async querySQLite(sql, params = []) {
        if (!this.config.sqlitePath) {
            throw new Error('SQLite 路径未配置');
        }
        // 构造参数化查询的替换值
        let formattedSql = sql;
        if (params.length > 0) {
            const paramStr = params.map(p => {
                if (p === null || p === undefined)
                    return 'NULL';
                if (typeof p === 'string')
                    return `'${p.replace(/'/g, "''")}'`;
                if (typeof p === 'number')
                    return String(p);
                return String(p);
            }).join(', ');
            formattedSql = sql.replace(/\?/g, () => paramStr.shift() || 'NULL');
        }
        const escapedSql = formattedSql.replace(/"/g, '\\"').replace(/\n/g, '\\n');
        if (this.config.sqliteUseDocker && this.config.dockerContainer) {
            // 通过 docker exec 执行
            const cmd = `docker exec ${this.config.dockerContainer} sqlite3 "${this.config.sqlitePath}" -json "${escapedSql}"`;
            const { execSync } = require('child_process');
            const output = execSync(cmd, { encoding: 'utf-8' });
            return output.trim() ? JSON.parse(output) : [];
        }
        else {
            // 直接文件访问
            const { execSync } = require('child_process');
            const cmd = `sqlite3 "${this.config.sqlitePath}" -json "${escapedSql}"`;
            const output = execSync(cmd, { encoding: 'utf-8' });
            return output.trim() ? JSON.parse(output) : [];
        }
    }
    /**
     * 通用查询接口
     */
    async query(sql, params = []) {
        switch (this.config.type) {
            case 'mysql':
            case 'doris':
                return this.queryMySQL(sql, params);
            case 'postgresql':
            case 'supabase':
                return this.queryPostgreSQL(sql, params);
            case 'sqlite':
                return this.querySQLite(sql, params);
            default:
                throw new Error(`不支持的数据库类型: ${this.config.type}`);
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
        }
        else {
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
            await this.query('SELECT 1', []);
            return true;
        }
        catch (error) {
            console.error('[Database] 健康检查失败:', error);
            return false;
        }
    }
}
/**
 * 数据库工厂类
 */
export class DatabaseFactory {
    static create(config) {
        return new Database(config);
    }
}
