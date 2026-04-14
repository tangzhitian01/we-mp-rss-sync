/**
 * We-MP-RSS Sync - Obsidian 文件写入模块
 */
import * as fs from 'fs';
import * as path from 'path';
export class ObsidianWriter {
    constructor(vaultPath) {
        this.vaultPath = vaultPath;
        this.ensureVault();
    }
    /**
     * 确保 vault 目录存在
     */
    ensureVault() {
        if (!fs.existsSync(this.vaultPath)) {
            throw new Error(`Vault 目录不存在: ${this.vaultPath}`);
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
        fs.writeFileSync(filepath, content, 'utf-8');
    }
    /**
     * 读取文件
     */
    async read(filepath) {
        if (!fs.existsSync(filepath)) {
            return '';
        }
        return fs.readFileSync(filepath, 'utf-8');
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
    async listFiles(dirPath, ext = '.md') {
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
}
