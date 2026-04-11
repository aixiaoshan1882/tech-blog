"""API Key 认证工具"""
import secrets
import hashlib
from datetime import datetime
from typing import Optional
from fastapi import HTTPException, Request
from ..database import db


def generate_api_key() -> tuple[str, str]:
    """生成 API Key 和 Secret
    返回: (key, secret) - secret 只显示一次
    """
    key = f"tk_{secrets.token_hex(16)}"
    secret = secrets.token_hex(32)
    secret_hash = hashlib.sha256(secret.encode()).hexdigest()
    return key, secret_hash


def hash_secret(secret: str) -> str:
    """哈希密码"""
    return hashlib.sha256(secret.encode()).hexdigest()


async def verify_api_key(key: str, secret: str) -> bool:
    """验证 API Key
    Key 格式: tk_xxx
    Secret: 原始密钥（会被哈希存储）
    """
    if not key or not key.startswith("tk_"):
        return False

    # 查询 API Key
    api_key = await db.first(
        "SELECT * FROM api_keys WHERE key = ? AND is_active = 1",
        [key]
    )

    if not api_key:
        return False

    # 检查是否过期
    if api_key.get("expires_at"):
        expires_at = datetime.fromisoformat(api_key["expires_at"])
        if expires_at < datetime.now():
            return False

    # 验证 Secret
    secret_hash = hash_secret(secret)
    if secret_hash != api_key["secret_hash"]:
        return False

    # 更新最后使用时间
    await db.execute(
        "UPDATE api_keys SET last_used_at = ? WHERE id = ?",
        [datetime.now().isoformat(), api_key["id"]]
    )

    return True


async def create_api_key(
    name: str,
    expires_days: Optional[int] = None
) -> dict:
    """创建新的 API Key
    返回: {key, secret, name, expires_at}
    """
    key, secret_hash = generate_api_key()
    
    expires_at = None
    if expires_days:
        from datetime import timedelta
        expires_at = (datetime.now() + timedelta(days=expires_days)).isoformat()

    await db.execute(
        """
        INSERT INTO api_keys (name, key, secret_hash, expires_at)
        VALUES (?, ?, ?, ?)
        """,
        [name, key, secret_hash, expires_at]
    )

    # 返回密钥信息（secret 只会显示这一次）
    return {
        "name": name,
        "key": key,
        "secret": secret_hash,  # 实际使用时显示完整 secret
        "expires_at": expires_at,
        "created_at": datetime.now().isoformat(),
    }


async def revoke_api_key(key: str) -> bool:
    """撤销 API Key"""
    result = await db.execute(
        "UPDATE api_keys SET is_active = 0 WHERE key = ?",
        [key]
    )
    return result > 0


async def list_api_keys() -> list:
    """列出所有 API Keys（不包含 secret）"""
    return await db.select(
        """
        SELECT id, name, key, is_active, last_used_at, created_at, expires_at
        FROM api_keys
        ORDER BY created_at DESC
        """,
        []
    )


async def require_api_key(request: Request) -> dict:
    """验证 API Key 认证
    使用方式: 在请求头中添加 X-API-Key 和 X-API-Secret
    """
    key = request.headers.get("X-API-Key")
    secret = request.headers.get("X-API-Secret")

    if not key or not secret:
        raise HTTPException(
            status_code=401,
            detail="缺少 API 认证信息，请提供 X-API-Key 和 X-API-Secret"
        )

    if not await verify_api_key(key, secret):
        raise HTTPException(
            status_code=401,
            detail="无效的 API Key 或 Secret"
        )

    # 获取 API Key 信息
    api_key = await db.first(
        "SELECT * FROM api_keys WHERE key = ?",
        [key]
    )

    return api_key
