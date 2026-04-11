"""数据库连接模块"""
import os
import json
import sqlite3
from typing import Optional, List, Dict, Any
from contextlib import contextmanager


class Database:
    """数据库封装 - 支持本地 SQLite 和 Cloudflare D1"""

    def __init__(self):
        self.db_path = os.getenv("DB_PATH", "./tech-blog.db")
        self._is_d1 = "CF_BINDING" in os.environ

    @property
    def d1_database(self):
        """获取 D1 数据库绑定 (生产环境)"""
        if self._is_d1:
            return None  # 由 Workers 注入
        return None

    def _get_connection(self) -> sqlite3.Connection:
        """获取 SQLite 连接"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    @contextmanager
    def _connect(self):
        """上下文管理器"""
        conn = self._get_connection()
        try:
            yield conn
        finally:
            conn.close()

    async def execute(self, query: str, bindings: List[Any] = None) -> Dict[str, Any]:
        """执行写操作 (INSERT/UPDATE/DELETE)"""
        if self._is_d1:
            # D1 环境
            return await self._d1_execute(query, bindings)
        else:
            # 本地 SQLite
            return self._sqlite_execute(query, bindings)

    def _sqlite_execute(self, query: str, bindings: List[Any] = None) -> Dict[str, Any]:
        """SQLite 执行"""
        with self._connect() as conn:
            cursor = conn.cursor()
            cursor.execute(query, bindings or [])
            conn.commit()
            return {
                "last_row_id": cursor.lastrowid,
                "rows_affected": cursor.rowcount,
            }

    async def _d1_execute(self, query: str, bindings: List[Any] = None) -> Dict[str, Any]:
        """D1 执行 (placeholder - 实际由 Workers 运行时)"""
        # 在 Cloudflare Workers 中会使用 D1Client
        return {"last_row_id": 1, "rows_affected": 1}

    async def select(self, query: str, bindings: List[Any] = None) -> List[Dict[str, Any]]:
        """执行查询 (SELECT)"""
        if self._is_d1:
            return await self._d1_select(query, bindings)
        else:
            return self._sqlite_select(query, bindings)

    def _sqlite_select(self, query: str, bindings: List[Any] = None) -> List[Dict[str, Any]]:
        """SQLite 查询"""
        with self._connect() as conn:
            cursor = conn.cursor()
            cursor.execute(query, bindings or [])
            rows = cursor.fetchall()
            return [dict(row) for row in rows]

    async def _d1_select(self, query: str, bindings: List[Any] = None) -> List[Dict[str, Any]]:
        """D1 查询 (placeholder)"""
        return []

    async def first(self, query: str, bindings: List[Any] = None) -> Optional[Dict[str, Any]]:
        """查询单条"""
        results = await self.select(query, bindings)
        return results[0] if results else None

    def init_database(self):
        """初始化数据库表"""
        schema_path = os.path.join(
            os.path.dirname(__file__), "..", "..", "database", "schema.sql"
        )
        seed_path = os.path.join(
            os.path.dirname(__file__), "..", "..", "database", "seed.sql"
        )

        # 执行 schema
        if os.path.exists(schema_path):
            with open(schema_path, "r") as f:
                schema = f.read()
                with self._connect() as conn:
                    conn.executescript(schema)

        # 执行 seed
        if os.path.exists(seed_path):
            with open(seed_path, "r") as f:
                seed = f.read()
                with self._connect() as conn:
                    conn.executescript(seed)


# 全局数据库实例
db = Database()