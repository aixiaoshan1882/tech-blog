"""应用配置"""
import os
import secrets


class Config:
    """应用配置"""

    # 数据库 - 本地开发使用 SQLite，生产使用 D1
    DB_PATH = os.getenv("DB_PATH", "./tech-blog.db")

    # JWT 配置 - 生产环境必须设置强密钥
    _default_secret = secrets.token_urlsafe(32)
    JWT_SECRET = os.getenv("JWT_SECRET", _default_secret)
    JWT_ALGORITHM = "HS256"
    JWT_EXPIRE_DAYS = int(os.getenv("JWT_EXPIRE_DAYS", "7"))

    # CORS 允许的来源 - 支持多个环境
    @property
    def CORS_ORIGINS(self):
        origins = os.getenv(
            "CORS_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000",
        )
        return [o.strip() for o in origins.split(",")]


config = Config()
