"""
PostgreSQL 数据库连接
当环境变量 DATABASE_URL 设置时使用
"""

import os
import psycopg2
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager
from typing import Optional

class PostgresDB:
    """PostgreSQL 数据库包装类"""
    
    def __init__(self, connection_string: str = None):
        self.connection_string = connection_string or os.getenv("DATABASE_URL")
        if not self.connection_string:
            raise ValueError("DATABASE_URL environment variable is required for PostgreSQL")
        
        self._conn = None
    
    def _get_connection(self):
        """获取数据库连接"""
        if self._conn is None or self._conn.closed:
            self._conn = psycopg2.connect(
                self.connection_string,
                cursor_factory=RealDictCursor
            )
        return self._conn
    
    @contextmanager
    def _cursor(self):
        """数据库游标上下文管理器"""
        conn = self._get_connection()
        cursor = conn.cursor()
        try:
            yield cursor
            conn.commit()
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
    
    def execute(self, query: str, params: list = None) -> int:
        """执行 INSERT/UPDATE/DELETE"""
        with self._cursor() as cursor:
            cursor.execute(query, params or [])
            return cursor.rowcount
    
    def first(self, query: str, params: list = None) -> Optional[dict]:
        """查询单条记录"""
        with self._cursor() as cursor:
            cursor.execute(query, params or [])
            result = cursor.fetchone()
            return dict(result) if result else None
    
    def select(self, query: str, params: list = None) -> list:
        """查询多条记录"""
        with self._cursor() as cursor:
            cursor.execute(query, params or [])
            return [dict(row) for row in cursor.fetchall()]
    
    def close(self):
        """关闭连接"""
        if self._conn and not self._conn.closed:
            self._conn.close()
            self._conn = None


# 根据环境自动选择数据库类型
def create_db():
    """创建数据库实例"""
    database_url = os.getenv("DATABASE_URL")
    
    if database_url and database_url.startswith("postgresql"):
        print("Using PostgreSQL database")
        return PostgresDB(database_url)
    else:
        print("Using SQLite database")
        from .database import db
        return db


# 导出单一实例
db = create_db()
