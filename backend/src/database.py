"""数据库连接模块"""
import os
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

        self.ensure_schema()

    def ensure_schema(self):
        """补齐本地 SQLite 运行所需的增强字段和表。"""
        if self._is_d1:
            return

        schema_path = os.path.join(
            os.path.dirname(__file__), "..", "..", "database", "schema.sql"
        )

        with self._connect() as conn:
            cursor = conn.cursor()
            if os.path.exists(schema_path):
                with open(schema_path, "r") as f:
                    conn.executescript(f.read())

            def columns(table: str) -> set[str]:
                cursor.execute(f"PRAGMA table_info({table})")
                return {row["name"] for row in cursor.fetchall()}

            def add_column(table: str, name: str, definition: str) -> None:
                if name not in columns(table):
                    cursor.execute(f"ALTER TABLE {table} ADD COLUMN {name} {definition}")

            add_column("users", "password", "TEXT")
            if "password_hash" in columns("users"):
                cursor.execute("UPDATE users SET password = COALESCE(password, password_hash)")
            add_column("users", "role", "TEXT DEFAULT 'reader'")
            add_column("users", "avatar", "TEXT DEFAULT NULL")
            add_column("users", "bio", "TEXT DEFAULT NULL")
            add_column("users", "updated_at", "DATETIME")
            cursor.execute("UPDATE users SET updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)")

            add_column("categories", "description", "TEXT")
            add_column("categories", "sort_order", "INTEGER DEFAULT 0")
            add_column("categories", "updated_at", "DATETIME")
            cursor.execute(
                "UPDATE categories SET updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)"
            )

            add_column("tags", "color", "TEXT")
            add_column("tags", "created_at", "DATETIME")
            add_column("tags", "updated_at", "DATETIME")
            cursor.execute("UPDATE tags SET created_at = COALESCE(created_at, CURRENT_TIMESTAMP)")
            cursor.execute("UPDATE tags SET updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)")

            add_column("posts", "user_id", "INTEGER")
            add_column("posts", "like_count", "INTEGER DEFAULT 0")
            add_column("posts", "deleted_at", "DATETIME DEFAULT NULL")
            add_column("posts", "scheduled_at", "DATETIME DEFAULT NULL")

            add_column("comments", "like_count", "INTEGER DEFAULT 0")
            add_column("comments", "is_approved", "INTEGER DEFAULT 1")
            add_column("comments", "updated_at", "DATETIME")
            cursor.execute(
                "UPDATE comments SET updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)"
            )

            cursor.executescript(
                """
                CREATE TABLE IF NOT EXISTS notifications (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    type TEXT NOT NULL,
                    title TEXT NOT NULL,
                    content TEXT,
                    is_read INTEGER DEFAULT 0,
                    related_id INTEGER,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                );

                CREATE TABLE IF NOT EXISTS user_favorites (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    post_id INTEGER NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(user_id, post_id),
                    FOREIGN KEY (user_id) REFERENCES users(id),
                    FOREIGN KEY (post_id) REFERENCES posts(id)
                );

                CREATE TABLE IF NOT EXISTS user_likes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    post_id INTEGER,
                    comment_id INTEGER,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id),
                    FOREIGN KEY (post_id) REFERENCES posts(id),
                    FOREIGN KEY (comment_id) REFERENCES comments(id)
                );

                CREATE TABLE IF NOT EXISTS comment_likes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    comment_id INTEGER NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(user_id, comment_id),
                    FOREIGN KEY (user_id) REFERENCES users(id),
                    FOREIGN KEY (comment_id) REFERENCES comments(id)
                );

                CREATE TABLE IF NOT EXISTS post_stats (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    post_id INTEGER UNIQUE NOT NULL,
                    view_count INTEGER DEFAULT 0,
                    like_count INTEGER DEFAULT 0,
                    comment_count INTEGER DEFAULT 0,
                    favorite_count INTEGER DEFAULT 0,
                    last_viewed_at DATETIME,
                    FOREIGN KEY (post_id) REFERENCES posts(id)
                );

                CREATE TABLE IF NOT EXISTS operation_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    action TEXT NOT NULL,
                    resource TEXT,
                    resource_id INTEGER,
                    details TEXT,
                    ip_address TEXT,
                    user_agent TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                );

                CREATE TABLE IF NOT EXISTS announcements (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    content TEXT NOT NULL,
                    type TEXT DEFAULT 'info',
                    priority INTEGER DEFAULT 0,
                    is_pinned INTEGER DEFAULT 0,
                    is_active INTEGER DEFAULT 1,
                    start_time DATETIME,
                    end_time DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS password_reset_tokens (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    token TEXT UNIQUE NOT NULL,
                    expires_at DATETIME NOT NULL,
                    used INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                );

                CREATE TABLE IF NOT EXISTS api_keys (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    key TEXT UNIQUE NOT NULL,
                    secret_hash TEXT NOT NULL,
                    is_active INTEGER DEFAULT 1,
                    last_used_at DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    expires_at DATETIME
                );

                CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
                CREATE INDEX IF NOT EXISTS idx_favorites_user ON user_favorites(user_id);
                CREATE INDEX IF NOT EXISTS idx_likes_user ON user_likes(user_id);
                CREATE INDEX IF NOT EXISTS idx_logs_user ON operation_logs(user_id);
                CREATE INDEX IF NOT EXISTS idx_logs_action ON operation_logs(action);
                CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(is_active);
                """
            )

            add_column("notifications", "related_id", "INTEGER")
            add_column("password_reset_tokens", "used", "INTEGER DEFAULT 0")

            conn.commit()


# 全局数据库实例
db = Database()
