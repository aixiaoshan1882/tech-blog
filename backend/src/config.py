"""应用配置"""
import os


class Config:
    """应用配置"""

    # 数据库 - 本地开发使用 SQLite，生产使用 D1
    DB_PATH = os.getenv("DB_PATH", "./tech-blog.db")

    # JWT 配置
    JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-key-change-in-production")
    JWT_ALGORITHM = "HS256"
    JWT_EXPIRE_DAYS = int(os.getenv("JWT_EXPIRE_DAYS", "7"))

    # CORS 允许的来源
    CORS_ORIGINS = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
    ]


config = Config()