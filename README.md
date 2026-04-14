# We-MP-RSS Obsidian 数据同步插件

## 概述

此插件用于从 We-MP-RSS 数据库增量同步微信公众号文章到 Obsidian 知识库，并可选地添加到 DB-GPT 知识库。

## 数据库表结构

### articles 表（文章）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | VARCHAR(255) | 主键，格式 `{mp_id}-{app_message_id}` |
| mp_id | VARCHAR(255) | 公众号ID，外键关联 feeds.id |
| title | VARCHAR(1000) | 文章标题 |
| content | TEXT | 文章正文（纯文本） |
| content_html | TEXT | HTML 格式内容 |
| url | VARCHAR(500) | 文章永久链接 |
| description | TEXT | 文章摘要 |
| publish_time | INT | 发布时间（Unix 时间戳，秒） |
| updated_at_millis | BIGINT | 更新时间（毫秒）- 用于增量同步 |
| status | INT | 状态：1=正常，1000=已删除 |

### feeds 表（公众号）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | VARCHAR(255) | 主键，公众号ID |
| mp_name | VARCHAR(255) | 公众号名称 |
| mp_cover | VARCHAR(255) | 封面图片URL |
| mp_intro | VARCHAR(255) | 公众号简介 |
| status | INT | 状态：1=正常 |

## 插件架构

```
.obsidian/plugins/we-mp-rss-sync/
├── manifest.json          # 插件元数据
├── main.js                # 编译后的插件入口
├── main.ts                # 插件入口源码
├── package.json           # npm 包配置
├── tsconfig.json          # TypeScript 配置
├── styles.css             # 样式文件
└── src/
    ├── Database.ts        # 数据库连接（支持 MySQL/PostgreSQL/Supabase/Doris/SQLite）
    ├── SyncEngine.ts      # 增量同步引擎
    ├── ObsidianWriter.ts  # Obsidian 文件写入
    ├── DBGPTClient.ts     # DB-GPT API 客户端
    ├── Settings.ts        # 设置界面
    └── utils.ts           # 工具函数
```

## 文件命名格式

文章文件遵循以下命名格式：
```
yyyy-mm-dd-hh+文章标题.md
```

示例：
```
2026-04-14-10+Claude-Code新功能解析.md
2026-04-13-15+微信公众平台运营技巧.md
```

## 目录结构

```
ObsidianVault/
└── WeChat-Articles/           # 文章根目录
    ├── 公众号A/
    │   ├── 2026-04-14-10+文章标题A.md
    │   └── 2026-04-13-15+文章标题B.md
    ├── 公众号B/
    │   └── 2026-04-12-09+文章标题C.md
    └── ...
```

## Markdown 格式

同步的文章包含 YAML frontmatter：

```yaml
---
title: "文章标题"
publish_time: "2026-04-14T10:30:00.000Z"
source_url: "https://mp.weixin.qq.com/s/..."
mp_name: "公众号名称"
mp_id: "MP_WXS_xxx"
article_id: "MP_WXS_xxx-app_message_id"
synced_at: "2026-04-14T19:00:00.000Z"
updated_at_millis: 1713096000000
---

文章正文内容...

---

来源: [公众号名称](永久链接)
```

## 支持的数据库

| 数据库类型 | 连接方式 | 配置参数 |
|-----------|---------|---------|
| MySQL | TCP 直接连接 | host, port, user, password, database |
| PostgreSQL | TCP 直接连接 | host, port, user, password, database |
| Supabase | PostgreSQL 兼容 | supabaseProjectRef, supabaseApiKey |
| Doris | MySQL 协议兼容 | host, port, user, password, database |
| SQLite | 文件或 docker exec | sqlitePath, sqliteUseDocker, dockerContainer |

## 使用方法

### 1. 安装插件

1. 将插件文件夹复制到 Obsidian 的 `.obsidian/plugins/` 目录下
2. 在 Obsidian 设置中启用插件
3. 重启 Obsidian

### 2. 配置插件

在 Obsidian 设置中找到 **We-MP-RSS Sync** 设置标签页：

#### 数据库配置
- 选择数据库类型（MySQL/PostgreSQL/Supabase/Doris/SQLite）
- 填写连接信息（主机、端口、用户名、密码、数据库名）

#### 同步配置
- **Vault 路径**：Obsidian 仓库路径
- **自动同步**：启用后按间隔自动同步
- **同步间隔**：自动同步的间隔（分钟）
- **批量大小**：每次同步的最大文章数

#### DB-GPT 配置
- **启用 DB-GPT 集成**：同步后自动上传到 DB-GPT
- **API 地址**：DB-GPT 服务地址（默认 http://127.0.0.1:5670）
- **空间名称**：知识库空间名称（默认 we_mp_rss）

### 3. 使用命令

在 Obsidian 命令面板中：

- **We-MP-RSS Sync: 立即同步文章** - 同步新文章
- **We-MP-RSS Sync: 同步所有公众号文章** - 同步所有公众号
- **We-MP-RSS Sync: 强制同步所有文章** - 忽略增量状态，强制同步所有

## 增量同步机制

插件使用 `updated_at_millis` 字段实现增量同步：

1. 记录每个公众号上次同步的时间戳
2. 查询比上次同步时间更新的文章
3. 检查本地文件是否存在且是否需要更新
4. 仅同步新增或更新的文章

同步状态保存在 `.we-mp-rss-sync-state.json` 文件中。

## 数据库连接配置示例

### MySQL（本地）

```
类型: MySQL
主机: localhost
端口: 3306
用户名: rss_user
密码: pass123456
数据库: we_mp_rss
```

### MySQL（Docker 容器）

```
类型: MySQL
主机: localhost
端口: 3306
用户名: rss_user
密码: pass123456
数据库: we_mp_rss
```

从 Docker 容器外部访问：`docker port db-mp 3306`

### Supabase

```
类型: Supabase
项目引用: xxxxxx
API Key: your-anon-key
数据库: postgres
```

### SQLite（通过 docker exec）

```
类型: SQLite
文件路径: /data/we_mp_rss.db
使用 Docker Exec: true
Docker 容器: we-mp-rss-backend-dev
```

## 故障排除

### 数据库连接失败

1. 检查数据库服务是否运行
2. 验证防火墙设置
3. 确认用户名/密码正确
4. 对于 Docker 容器，确认端口映射正确

### 同步无反应

1. 检查 Vault 路径是否正确
2. 确认数据库中有文章数据
3. 查看 Obsidian 控制台错误信息（Settings > Community Plugins > We-MP-RSS Sync > Show Debug Info）

### DB-GPT 上传失败

1. 确认 DB-GPT 服务正在运行
2. 检查 API 地址是否正确
3. 验证知识库空间是否存在