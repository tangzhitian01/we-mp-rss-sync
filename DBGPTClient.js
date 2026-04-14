/**
 * We-MP-RSS Sync - DB-GPT 知识库 API 客户端
 */
import * as fs from 'fs';
import * as path from 'path';
export class DBGPTClient {
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
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` })
                },
                body: JSON.stringify({
                    name: this.config.spaceName,
                    vector_type: 'Chroma',
                    desc: 'We-MP-RSS 文章知识库',
                    domain_type: 'Normal',
                    owner: 'we-mp-rss-sync'
                })
            });
            // 200 OK 或空间已存在（code: '001'）都认为是成功
            if (response.ok) {
                console.log('[DBGPTClient] 知识库空间已就绪:', this.config.spaceName);
                return true;
            }
            // 处理已存在的空间
            const data = await response.json();
            if (data.code === '001' || data.message?.includes('already exists')) {
                console.log('[DBGPTClient] 知识库空间已存在:', this.config.spaceName);
                return true;
            }
            console.warn('[DBGPTClient] 创建空间响应:', data);
            return false;
        }
        catch (error) {
            console.error('[DBGPTClient] 确保空间失败:', error);
            // 不阻塞同步流程
            return false;
        }
    }
    /**
     * 上传文档到知识库
     */
    async uploadDocument(filePath, documentName) {
        if (!fs.existsSync(filePath)) {
            console.warn('[DBGPTClient] 文件不存在:', filePath);
            return false;
        }
        try {
            const fileName = documentName || path.basename(filePath);
            const fileContent = fs.readFileSync(filePath);
            const mimeType = this.getMimeType(filePath);
            const formData = new FormData();
            formData.append('file', new Blob([fileContent], { type: mimeType }), fileName);
            const url = `${this.config.apiUrl}/knowledge/${this.config.spaceName}/document/upload`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` })
                },
                body: formData
            });
            if (!response.ok) {
                const error = await response.text();
                throw new Error(`DB-GPT upload failed: ${response.status} - ${error}`);
            }
            const result = await response.json();
            console.log(`[DBGPTClient] 上传成功: ${fileName}`, result);
            return true;
        }
        catch (error) {
            console.error('[DBGPTClient] 上传失败:', error);
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
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` })
                }
            });
            if (!response.ok) {
                throw new Error(`Failed to list documents: ${response.status}`);
            }
            const result = await response.json();
            return result.data || [];
        }
        catch (error) {
            console.error('[DBGPTClient] 列出文档失败:', error);
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
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` })
                },
                body: JSON.stringify({
                    doc_ids: [docId]
                })
            });
            return response.ok;
        }
        catch (error) {
            console.error('[DBGPTClient] 删除文档失败:', error);
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
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` })
                },
                body: JSON.stringify({
                    doc_ids: [docId],
                    model_name: 'text2vec'
                })
            });
            return response.ok;
        }
        catch (error) {
            console.error('[DBGPTClient] 同步文档失败:', error);
            return false;
        }
    }
    /**
     * 获取文件 MIME 类型
     */
    getMimeType(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes = {
            '.md': 'text/markdown',
            '.txt': 'text/plain',
            '.pdf': 'application/pdf',
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        };
        return mimeTypes[ext] || 'text/plain';
    }
    /**
     * 检查 API 连接是否正常
     */
    async healthCheck() {
        try {
            const url = `${this.config.apiUrl}/knowledge/space/list`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` })
                }
            });
            return response.ok;
        }
        catch {
            return false;
        }
    }
}
