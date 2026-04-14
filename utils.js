/**
 * We-MP-RSS Sync - 工具函数
 */
/**
 * 生成文件名
 * 格式: yyyy-mm-dd-hh+文章标题.md
 * 示例: 2026-04-14-10+Claude-Code新功能解析.md
 */
export function generateFilename(article) {
    const date = new Date(article.publish_time * 1000);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const cleanTitle = sanitizeFilename(article.title);
    return `${year}-${month}-${day}-${hours}+${cleanTitle}.md`;
}
/**
 * 清理文件名中的非法字符
 */
export function sanitizeFilename(filename) {
    if (!filename || filename.trim() === '') {
        return 'untitled';
    }
    // Windows/macOS/Linux 通用的非法字符
    const illegalChars = /[<>:"/\\|?*\x00-\x1f]/g;
    let cleaned = filename
        // 替换非法字符
        .replace(illegalChars, '')
        // 空格替换为 +
        .replace(/\s+/g, '+')
        // 全角空格
        .replace(/\u3000/g, '+')
        // 多个 + 合并为一个
        .replace(/\+{2,}/g, '+')
        // 移除首尾的 +
        .replace(/^\+|\+$/g, '')
        // 限制长度
        .substring(0, 200);
    // 如果清理后为空，返回默认值
    if (!cleaned || cleaned.trim() === '') {
        return 'untitled';
    }
    return cleaned;
}
/**
 * 格式化日期
 * @param timestamp 毫秒时间戳
 * @param format 格式类型: 'ISO' | 'yyyy-MM-dd' | 'yyyy-MM-dd HH:mm'
 */
export function formatDate(timestamp, format = 'ISO') {
    const date = new Date(timestamp);
    if (format === 'ISO') {
        return date.toISOString();
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    if (format === 'yyyy-MM-dd') {
        return `${year}-${month}-${day}`;
    }
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
}
/**
 * 从文件名解析文章信息
 * 格式: yyyy-mm-dd-hh+文章标题.md
 */
export function parseFilename(filename) {
    // 匹配格式: 2026-04-14-10+标题.md
    const match = filename.match(/^(\d{4})-(\d{2})-(\d{2})-(\d{2})\+(.*)\.md$/);
    if (!match) {
        return null;
    }
    const [, year, month, day, hour, title] = match;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), 0, 0, 0);
    return {
        date,
        title: decodeURIComponent(title) || title
    };
}
/**
 * 安全地解码 URI 组件（处理失败时返回原值）
 */
export function safeDecodeURI(str) {
    try {
        return decodeURIComponent(str);
    }
    catch {
        return str;
    }
}
/**
 * 生成 frontmatter 安全的字符串
 */
export function safeFrontmatterValue(value) {
    if (value === null || value === undefined) {
        return '';
    }
    const str = String(value);
    // 如果包含特殊字符，用双引号包裹
    if (str.includes(':') || str.includes('#') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`;
    }
    return str;
}
/**
 * 从 URL 提取域名
 */
export function extractDomain(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname;
    }
    catch {
        return url;
    }
}
/**
 * 截断字符串（保留首尾）
 */
export function truncate(str, maxLength, ellipsis = '...') {
    if (str.length <= maxLength) {
        return str;
    }
    const ellipsisLength = ellipsis.length;
    if (maxLength <= ellipsisLength) {
        return ellipsis.substring(0, maxLength);
    }
    const contentLength = maxLength - ellipsisLength;
    const startLength = Math.floor(contentLength / 2);
    const endLength = contentLength - startLength;
    return str.substring(0, startLength) + ellipsis + str.substring(str.length - endLength);
}
/**
 * 清理 Markdown 内容中的特殊标记
 */
export function cleanMarkdownContent(content) {
    if (!content) {
        return '';
    }
    return content
        // 移除多余的空白行
        .replace(/\n{3,}/g, '\n\n')
        // 移除行首尾的空白
        .split('\n')
        .map(line => line.trim())
        .join('\n')
        // 移除 Unicode BOM
        .replace(/\uFEFF/g, '');
}
