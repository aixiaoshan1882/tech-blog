"""
数据库迁移管理
"""
import os
import re
from datetime import datetime
from typing import Optional

class Migration:
    """迁移基类"""
    
    def __init__(self):
        self.name = self.__class__.__name__
        # 从类名提取版本号：Migration_001_AddTags
        match = re.search(r'Migration_(\d+)', self.name)
        self.version = int(match.group(1)) if match else 0
    
    def up(self, db) -> None:
        """执行迁移"""
        raise NotImplementedError
    
    def down(self, db) -> None:
        """回滚迁移"""
        raise NotImplementedError


class MigrationManager:
    """迁移管理器"""
    
    def __init__(self, db):
        self.db = db
        self.migrations: list[Migration] = []
        self._ensure_migrations_table()
    
    def _ensure_migrations_table(self) -> None:
        """确保 migrations 表存在"""
        self.db.execute("""
            CREATE TABLE IF NOT EXISTS schema_migrations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                version INTEGER UNIQUE NOT NULL,
                name TEXT NOT NULL,
                applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
    
    def register(self, migration: Migration) -> None:
        """注册迁移"""
        self.migrations.append(migration)
        self.migrations.sort(key=lambda m: m.version)
    
    def get_applied_versions(self) -> set[int]:
        """获取已应用的迁移版本"""
        rows = self.db.select("SELECT version FROM schema_migrations", [])
        return {row["version"] for row in rows}
    
    def get_pending(self) -> list[Migration]:
        """获取待执行的迁移"""
        applied = self.get_applied_versions()
        return [m for m in self.migrations if m.version not in applied]
    
    def up(self) -> list[Migration]:
        """执行所有待应用的迁移"""
        pending = self.get_pending()
        applied = []
        
        for migration in pending:
            try:
                print(f"Applying migration {migration.version}: {migration.name}...")
                migration.up(self.db)
                
                # 记录迁移
                self.db.execute(
                    "INSERT INTO schema_migrations (version, name) VALUES (?, ?)",
                    [migration.version, migration.name]
                )
                
                applied.append(migration)
                print(f"✓ Applied {migration.name}")
                
            except Exception as e:
                print(f"✗ Failed to apply {migration.name}: {e}")
                break
        
        return applied
    
    def down(self, steps: int = 1) -> list[Migration]:
        """回滚迁移"""
        applied = self.get_applied_versions()
        
        # 获取最近的应用迁移
        to_rollback = [
            m for m in self.migrations 
            if m.version in applied
        ]
        to_rollback.sort(key=lambda m: m.version, reverse=True)
        to_rollback = to_rollback[:steps]
        
        rolled_back = []
        for migration in to_rollback:
            try:
                print(f"Rolling back {migration.version}: {migration.name}...")
                migration.down(self.db)
                
                # 删除迁移记录
                self.db.execute(
                    "DELETE FROM schema_migrations WHERE version = ?",
                    [migration.version]
                )
                
                rolled_back.append(migration)
                print(f"✓ Rolled back {migration.name}")
                
            except Exception as e:
                print(f"✗ Failed to rollback {migration.name}: {e}")
                break
        
        return rolled_back
    
    def status(self) -> dict:
        """获取迁移状态"""
        applied = self.get_applied_versions()
        pending = self.get_pending()
        
        return {
            "total": len(self.migrations),
            "applied": len(applied),
            "pending": len(pending),
            "current_version": max(applied) if applied else 0,
        }
