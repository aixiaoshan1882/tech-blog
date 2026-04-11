"""
迁移 002: 增强功能表
"""
from migrations import Migration


class Migration_002_EnhancedFeatures(Migration):
    
    def up(self, db) -> None:
        # 用户收藏表
        db.execute("""
            CREATE TABLE IF NOT EXISTS user_favorites (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                post_id INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, post_id),
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (post_id) REFERENCES posts(id)
            )
        """)
        
        # 用户点赞表
        db.execute("""
            CREATE TABLE IF NOT EXISTS user_likes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                post_id INTEGER,
                comment_id INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (post_id) REFERENCES posts(id),
                FOREIGN KEY (comment_id) REFERENCES comments(id)
            )
        """)
        
        # 评论点赞表
        db.execute("""
            CREATE TABLE IF NOT EXISTS comment_likes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                comment_id INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, comment_id),
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (comment_id) REFERENCES comments(id)
            )
        """)
        
        # 文章统计表
        db.execute("""
            CREATE TABLE IF NOT EXISTS post_stats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                post_id INTEGER UNIQUE NOT NULL,
                view_count INTEGER DEFAULT 0,
                like_count INTEGER DEFAULT 0,
                comment_count INTEGER DEFAULT 0,
                favorite_count INTEGER DEFAULT 0,
                last_viewed_at DATETIME,
                FOREIGN KEY (post_id) REFERENCES posts(id)
            )
        """)
        
        # 操作日志表
        db.execute("""
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
            )
        """)
        
        # 系统公告表
        db.execute("""
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
            )
        """)
        
        # 密码重置表
        db.execute("""
            CREATE TABLE IF NOT EXISTS password_reset_tokens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                token TEXT UNIQUE NOT NULL,
                expires_at DATETIME NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)
        
        # API Keys 表
        db.execute("""
            CREATE TABLE IF NOT EXISTS api_keys (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                key TEXT UNIQUE NOT NULL,
                secret_hash TEXT NOT NULL,
                is_active INTEGER DEFAULT 1,
                last_used_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME
            )
        """)
        
        # 添加索引
        db.execute("CREATE INDEX IF NOT EXISTS idx_favorites_user ON user_favorites(user_id)")
        db.execute("CREATE INDEX IF NOT EXISTS idx_likes_user ON user_likes(user_id)")
        db.execute("CREATE INDEX IF NOT EXISTS idx_logs_user ON operation_logs(user_id)")
        db.execute("CREATE INDEX IF NOT EXISTS idx_logs_action ON operation_logs(action)")
        db.execute("CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(is_active)")
    
    def down(self, db) -> None:
        db.execute("DROP TABLE IF EXISTS api_keys")
        db.execute("DROP TABLE IF EXISTS password_reset_tokens")
        db.execute("DROP TABLE IF EXISTS announcements")
        db.execute("DROP TABLE IF EXISTS operation_logs")
        db.execute("DROP TABLE IF EXISTS post_stats")
        db.execute("DROP TABLE IF EXISTS comment_likes")
        db.execute("DROP TABLE IF EXISTS user_likes")
        db.execute("DROP TABLE IF EXISTS user_favorites")
