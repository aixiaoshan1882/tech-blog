"""认证工具"""
import os
from datetime import datetime, timedelta
from typing import Optional
import jwt
from passlib.context import CryptContext
from ..config import config

# 密码加密上下文
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """加密密码"""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """验证密码"""
    return pwd_context.verify(plain_password, hashed_password)


def create_token(user_id: int) -> str:
    """创建 JWT Token"""
    expire = datetime.utcnow() + timedelta(days=config.JWT_EXPIRE_DAYS)
    payload = {"user_id": user_id, "exp": expire}
    return jwt.encode(payload, config.JWT_SECRET, algorithm=config.JWT_ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    """解码 JWT Token"""
    try:
        payload = jwt.decode(token, config.JWT_SECRET, algorithms=[config.JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def get_user_id_from_token(token: str) -> Optional[int]:
    """从 Token 获取用户 ID"""
    payload = decode_token(token)
    if payload:
        return payload.get("user_id")
    return None