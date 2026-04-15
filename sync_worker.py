#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
微信公众号文章同步工具
功能：
  1. 增量同步文章到 Obsidian 本地（每个公众号一个文件夹）
  2. 增量同步文章到 DB-GPT 知识库
  3. 支持 MySQL / PostgreSQL / Supabase / Doris

依赖：
    pip install sqlalchemy pymysql psycopg2-binary markdownify pyyaml
"""

from __future__ import annotations

import json
import os
import re
import sys
import time
import logging
import argparse
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
)
logger = logging.getLogger("sync_worker")


# ------------------------------------------------------------------
# 数据库抽象层
# ------------------------------------------------------------------

def _engine_from_url(url: str):
    from sqlalchemy import create_engine
    from sqlalchemy.pool import QueuePool
    return create_engine(
        url,
        poolclass=QueuePool,
        pool_size=2,
        max_overflow=10,
        pool_recycle=3600,
        echo=False,
    )


class DBConfig:
    def __init__(self, config_path: str = "config.yaml"):
        import yaml
        self.config_path = config_path
        self._cfg = {}
        self._load()

    def _replace_env(self, data):
        if isinstance(data, dict):
            return {k: self._replace_env(v) for k, v in data.items()}
        elif isinstance(data, list):
            return [self._replace_env(i) for i in data]
        elif isinstance(data, str):
            pattern = re.compile(r"\$\{([^}:]+)(?::-([^}]*))?\}")
            def repl(m):
                val = os.getenv(m.group(1), m.group(2) or "") or m.group(2) or ""
                return val
            return pattern.sub(repl, data)
        return data

    def _load(self):
        try:
            with open(self.config_path, "r", encoding="utf-8") as f:
                self._cfg = self._replace_env(yaml.safe_load(f) or {})
        except FileNotFoundError:
            self._cfg = {}

    def get(self, key: str, default=None):
        keys = key.split(".") if isinstance(key, str) else [key]
        val = self._cfg
        for k in keys:
            if isinstance(val, dict):
                val = val.get(k)
            else:
                return default
            if val is None:
                return default
        return val

    def get_db_url(self) -> str:
        raw = os.environ.get("DB") or self.get("db") or self.get("database.url")
        if raw:
            return raw
        scheme = self.get("db.scheme", "mysql")
        host = self.get("db.host", "localhost")
        port = int(self.get("db.port", 3306))
        user = self.get("db.user", "rss_user")
        password = self.get("db.password", "pass123456")
        database = self.get("db.name", "we_mp_rss")
        if scheme in ("mysql", "mariadb"):
            return (f"mysql+pymysql://{user}:{password}@{host}:{port}"
                    f"/{database}?charset=utf8mb4")
        elif scheme in ("postgresql", "postgres", "pg"):
            return (f"postgresql+psycopg2://{user}:{password}@{host}:{port}"
                    f"/{database}")
        elif scheme in ("druid", "doris"):
            return (f"mysql+pymysql://{user}:{password}@{host}:{port}"
                    f"/{database}?charset=utf8mb4")
        return f"mysql+pymysql://{user}:{password}@{host}:{port}/{database}?charset=utf8mb4"


import yaml


# ------------------------------------------------------------------
# 工具函数
# ------------------------------------------------------------------

def parse_timestamp(ts: Optional[int]) -> Optional[datetime]:
    if ts is None:
        return None
    try:
        if ts > 10**12:
            return datetime.fromtimestamp(ts / 1000, tz=timezone(timedelta(hours=8)))
        else:
            return datetime.fromtimestamp(ts, tz=timezone(timedelta(hours=8)))
    except Exception:
        return None


def safe_filename(name: str) -> str:
    return re.sub(r'[\\/:*?"<>|]', "_", name or "未知").strip()


def html_to_markdown(html_str: str) -> str:
    try:
        from markdownify import markdownify as md
        return md(html_str)
    except ImportError:
        text = re.sub(r"<br\s*/?>", "\n", html_str or "")
        text = re.sub(r"<[^>]+>", "", text)
        return text.strip()


# ------------------------------------------------------------------
# Obsidian 同步器
# ------------------------------------------------------------------

class ObsidianSync:
    FILENAME_TEMPLATE = "{date_prefix}+{title}.md"

    def __init__(self, vault_path: str, we_mp_rss_config: str = "config.yaml"):
        self.vault_path = Path(vault_path).resolve()
        self.db_config = DBConfig(we_mp_rss_config)
        self._engine = None

    def _connect(self):
        if self._engine is None:
            url = self.db_config.get_db_url()
            scheme_label = url.split("://")[0] if "://" in url else "?"
            logger.info(f"[Obsidian] 数据库连接: {scheme_label}")
            self._engine = _engine_from_url(url)
        from sqlalchemy.orm import sessionmaker
        return sessionmaker(bind=self._engine)()

    def _fetch_articles(self, session, since_ts: int = 0, limit: int = 500):
        from sqlalchemy import text
        query = text("""
            SELECT a.id, a.mp_id, a.title, a.url, a.description,
                   a.content, a.content_html, a.publish_time, a.status,
                   f.mp_name
            FROM articles a
            LEFT JOIN feeds f ON a.mp_id = f.id
            WHERE a.publish_time > :since
              AND a.status != 4
              AND (a.content IS NOT NULL AND a.content != '')
            ORDER BY a.publish_time ASC
            LIMIT :limit
        """)
        rows = session.execute(query, {"since": since_ts, "limit": limit})
        return [dict(row._mapping) for row in rows]

    def _write_article(self, article: dict) -> tuple:
        mp_name = article.get("mp_name") or "未知公众号"
        mp_folder = self.vault_path / safe_filename(mp_name)
        mp_folder.mkdir(parents=True, exist_ok=True)

        publish_time = parse_timestamp(article.get("publish_time"))
        date_prefix = (publish_time.strftime("%Y-%m-%d-%H")
                      if publish_time else "unknown")
        title = safe_filename(article.get("title") or "无标题")[:100]
        filename = self.FILENAME_TEMPLATE.format(date_prefix=date_prefix, title=title)
        filepath = mp_folder / filename

        raw_html = article.get("content_html") or article.get("content") or ""
        body_md = html_to_markdown(raw_html)
        if not body_md:
            body_md = article.get("description") or ""
        time_str = (publish_time.strftime("%Y-%m-%d %H:%M:%S")
                   if publish_time else "未知时间")
        frontmatter = (
            f"---\n"
            f'uid: "{article.get("id", "")}"\n'
            f'mp_id: "{article.get("mp_id", "")}"\n'
            f'mp_name: "{article.get("mp_name", "")}"\n'
            f"publish_time: {time_str}\n"
            f'url: "{article.get("url", "")}"\n'
            f'description: "{article.get("description", "")}"\n'
            f"tags: [微信文章]\n"
            f"created_at: {datetime.now().astimezone().isoformat()}\n"
            f"---\n\n"
        )
        content = (f"{frontmatter}"
                   f"# {article.get('title', '无标题')}\n\n"
                   f"**公众号：** {article.get('mp_name', '')}  \n"
                   f"**发布时间：** {time_str}  \n"
                   f"**原文链接：** [{article.get('url', '')}]({article.get('url', '')})  \n\n"
                   f"---\n\n{body_md}\n")
        is_new = not filepath.exists()
        filepath.write_text(content, encoding="utf-8")
        return str(filepath), is_new

    def sync(self, dry_run: bool = False, since_hours: int = 24) -> dict:
        since_ts = int(time.time() - since_hours * 3600)
        session = self._connect()
        new_files, updated_files, errors = [], [], []

        try:
            articles = self._fetch_articles(session, since_ts=since_ts)
            logger.info(f"[Obsidian] 发现 {len(articles)} 篇待同步文章")
            for art in articles:
                try:
                    path, is_new = self._write_article(art)
                    if dry_run:
                        logger.info(f"[DryRun] 将写入: {path}")
                    else:
                        (new_files if is_new else updated_files).append(path)
                        logger.info(f"  {'新建' if is_new else '更新'}: {path}")
                except Exception as e:
                    errors.append({"id": art.get("id"), "error": str(e)})
                    logger.error(f"  写入失败 {art.get('id')}: {e}")
        finally:
            session.close()

        return {
            "target": str(self.vault_path),
            "new": new_files,
            "updated": updated_files,
            "total": len(new_files) + len(updated_files),
            "errors": errors,
        }


# ------------------------------------------------------------------
# DB-GPT 同步器
# ------------------------------------------------------------------

class DBGPTSync:
    def __init__(
        self,
        dbgpt_base_url: str = "http://localhost:5670",
        space_name: str = "we_mp_rss_articles",
        api_key: Optional[str] = None,
        we_mp_rss_config: str = "config.yaml",
    ):
        self.base_url = dbgpt_base_url.rstrip("/")
        self.space_name = space_name
        self.api_key = api_key or os.environ.get("DBGPT_API_KEY", "")
        self.db_config = DBConfig(we_mp_rss_config)
        self._engine = None

    def _connect(self):
        if self._engine is None:
            url = self.db_config.get_db_url()
            logger.info(f"[DB-GPT] 数据库连接: {url.split('://')[0]}***")
            self._engine = _engine_from_url(url)
        from sqlalchemy.orm import sessionmaker
        return sessionmaker(bind=self._engine)()

    def _fetch_articles(self, session, since_ts: int = 0, limit: int = 500):
        from sqlalchemy import text
        query = text("""
            SELECT a.id, a.mp_id, a.title, a.url, a.description,
                   a.content, a.content_html, a.publish_time, a.status,
                   f.mp_name
            FROM articles a
            LEFT JOIN feeds f ON a.mp_id = f.id
            WHERE a.publish_time > :since
              AND a.status != 4
              AND (a.content IS NOT NULL AND a.content != '')
            ORDER BY a.publish_time ASC
            LIMIT :limit
        """)
        rows = session.execute(query, {"since": since_ts, "limit": limit})
        return [dict(row._mapping) for row in rows]

    def _call_api(self, method: str, path: str,
                  json_data: Optional[dict] = None) -> dict:
        import urllib.request
        url = f"{self.base_url}{path}"
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        body = json.dumps(json_data).encode("utf-8") if json_data else None
        req = urllib.request.Request(url, data=body, headers=headers, method=method)
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode("utf-8"))

    def _ensure_space(self) -> bool:
        try:
            res = self._call_api("POST", "/knowledge/space/list",
                                  {"name": self.space_name})
            if res.get("success") or res.get("code") == "0":
                items = res.get("data", [])
                if any(s.get("name") == self.space_name for s in items):
                    logger.info(f"[DB-GPT] 空间 '{self.space_name}' 已存在")
                    return True
            self._call_api("POST", "/knowledge/space/add", {
                "name": self.space_name,
                "desc": "微信公众号文章知识库（自动同步）",
                "type": "1",
                "owner": "system",
            })
            logger.info(f"[DB-GPT] 空间 '{self.space_name}' 已创建")
            return True
        except Exception as e:
            logger.error(f"[DB-GPT] 创建知识库空间失败: {e}")
            return False

    def _upload_document(self, article: dict) -> dict:
        import urllib.request
        url = f"{self.base_url}/knowledge/{self.space_name}/document/add"
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        raw_html = article.get("content_html") or article.get("content") or ""
        body_md = html_to_markdown(raw_html)
        if not body_md:
            body_md = article.get("description") or ""
        publish_time = parse_timestamp(article.get("publish_time"))
        time_str = (publish_time.strftime("%Y-%m-%d %H:%M:%S")
                   if publish_time else "未知时间")

        doc_payload = {
            "doc_name": (f"{article.get('id')}_"
                         f"{safe_filename(article.get('title') or '无标题')[:60]}.md"),
            "doc_type": "Text",
            "content": body_md,
            "metadata": {
                "mp_id": article.get("mp_id", ""),
                "mp_name": article.get("mp_name", ""),
                "publish_time": time_str,
                "url": article.get("url", ""),
                "description": article.get("description", ""),
            },
        }
        body = json.dumps(doc_payload).encode("utf-8")
        req = urllib.request.Request(url, data=body, headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode("utf-8"))

    def sync(self, dry_run: bool = False, since_hours: int = 24) -> dict:
        if not self._ensure_space():
            return {"error": "无法创建知识库空间，请检查 DB-GPT 是否运行"}
        since_ts = int(time.time() - since_hours * 3600)
        session = self._connect()
        synced, errors = [], []

        try:
            articles = self._fetch_articles(session, since_ts=since_ts)
            logger.info(f"[DB-GPT] 发现 {len(articles)} 篇待同步文章")
            for art in articles:
                try:
                    if dry_run:
                        logger.info(f"[DryRun] 将上传: {art.get('title')}")
                        continue
                    res = self._upload_document(art)
                    if res.get("success") or res.get("code") in (None, "0"):
                        synced.append(art.get("id"))
                        logger.info(f"  上传成功: {art.get('title')}")
                    else:
                        errors.append({"id": art.get("id"), "response": res})
                        logger.warning(f"  上传失败: {art.get('title')}")
                except Exception as e:
                    errors.append({"id": art.get("id"), "error": str(e)})
                    logger.error(f"  上传异常: {e}")
        finally:
            session.close()

        return {
            "base_url": self.base_url,
            "space_name": self.space_name,
            "synced": synced,
            "total": len(synced),
            "errors": errors,
        }


# ------------------------------------------------------------------
# GitHub 推送
# ------------------------------------------------------------------

def push_to_github(
    repo_path: str,
    message: str = "chore: sync we-mp-rss articles",
    branch: str = "main",
) -> dict:
    import subprocess

    def run(cmd):
        r = subprocess.run(cmd, capture_output=True, text=True)
        return r.returncode, r.stdout, r.stderr

    os.chdir(repo_path)
    rc, _, err = run(["git", "add", "-A"])
    if rc != 0:
        return {"success": False, "error": f"git add 失败: {err}"}

    rc, out, _ = run(["git", "status", "--porcelain"])
    if not out.strip():
        return {"success": True, "message": "无新变动，无需推送"}

    rc, _, err = run(["git", "config", "user.email"])
    if rc != 0:
        return {"success": False, "error": "当前目录不是 Git 仓库"}

    rc, _, err = run(["git", "commit", "-m", message])
    if rc != 0:
        return {"success": False, "error": f"git commit 失败: {err}"}

    rc, _, err = run(["git", "push", "origin", branch])
    if rc != 0:
        return {"success": False, "error": f"git push 失败: {err}"}

    return {"success": True, "message": f"已推送到 {branch} 分支"}


# ------------------------------------------------------------------
# CLI 入口
# ------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="we-mp-rss 文章同步工具")
    parser.add_argument("action", nargs="+",
                        choices=["obsidian", "dbgpt", "all"],
                        help="obsidian=同步到Obsidian | dbgpt=同步到DB-GPT | all=两者")
    parser.add_argument("--dry-run", action="store_true", help="仅预览，不写入")
    parser.add_argument("--config", default="config.yaml",
                        help="we-mp-rss 配置文件路径")
    parser.add_argument("--vault", default=os.environ.get("OBSIDIAN_VAULT", ""),
                        help="Obsidian 保管库路径")
    parser.add_argument("--dbgpt-url",
                        default=os.environ.get("DBGPT_URL", "http://localhost:5670"),
                        help="DB-GPT 服务地址")
    parser.add_argument("--dbgpt-space",
                        default=os.environ.get("DBGPT_SPACE", "we_mp_rss_articles"),
                        help="DB-GPT 知识库空间名")
    parser.add_argument("--since-hours", type=int, default=24,
                        help="同步最近 N 小时内的文章（默认24）")
    parser.add_argument("--push", action="store_true", help="同步后自动推送到 GitHub")
    parser.add_argument("--push-message",
                        default="chore: sync we-mp-rss articles",
                        help="Git 提交信息")
    parser.add_argument("--verbose", action="store_true", help="显示详细日志")
    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    results = {}

    if "obsidian" in args.action:
        if not args.vault:
            logger.error("请指定 --vault 或设置 OBSIDIAN_VAULT 环境变量")
            sys.exit(1)
        syncer = ObsidianSync(vault_path=args.vault,
                              we_mp_rss_config=args.config)
        results["obsidian"] = syncer.sync(dry_run=args.dry_run,
                                          since_hours=args.since_hours)

    if "dbgpt" in args.action:
        syncer = DBGPTSync(
            dbgpt_base_url=args.dbgpt_url,
            space_name=args.dbgpt_space,
            we_mp_rss_config=args.config,
        )
        results["dbgpt"] = syncer.sync(dry_run=args.dry_run,
                                        since_hours=args.since_hours)

    if args.push:
        plugin_root = os.path.dirname(os.path.abspath(__file__))
        push_result = push_to_github(repo_path=plugin_root,
                                      message=args.push_message)
        results["github"] = push_result
        if push_result["success"]:
            logger.info(f"[GitHub] {push_result['message']}")
        else:
            logger.error(f"[GitHub] {push_result.get('error')}")

    print("\n" + "=" * 60)
    print("同步报告")
    print("=" * 60)
    for target, res in results.items():
        print(f"\n【{target.upper()}】")
        for k, v in res.items():
            print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
