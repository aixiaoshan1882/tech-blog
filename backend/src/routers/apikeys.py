"""API Key 管理路由"""
from fastapi import APIRouter, Request, HTTPException
from ..database import db
from .auth import require_admin
from ..utils.apikey import create_api_key, revoke_api_key, list_api_keys, generate_api_key, hash_secret

router = APIRouter(prefix="/api/apikeys", tags=["API Keys"])


@router.get("")
async def get_api_keys(request: Request) -> dict:
    """获取所有 API Keys"""
    await require_admin(request)
    keys = await list_api_keys()
    return {"code": 200, "data": keys}


@router.post("")
async def new_api_key(request: Request) -> dict:
    """创建新的 API Key"""
    await require_admin(request)
    
    body = await request.json()
    name = body.get("name")
    expires_days = body.get("expires_days")  # None 表示永不过期

    if not name:
        raise HTTPException(status_code=400, detail="请提供 Key 名称")

    import secrets
    from datetime import datetime, timedelta
    
    # 生成新的 key 和 secret
    key = f"tk_{secrets.token_hex(16)}"
    secret_plain = secrets.token_hex(32)
    secret_hash = hash_secret(secret_plain)

    expires_at = None
    if expires_days:
        expires_at = (datetime.now() + timedelta(days=expires_days)).isoformat()

    await db.execute(
        """
        INSERT INTO api_keys (name, key, secret_hash, expires_at)
        VALUES (?, ?, ?, ?)
        """,
        [name, key, secret_hash, expires_at]
    )

    return {
        "code": 200,
        "msg": "请妥善保存以下密钥，刷新后将不再显示",
        "data": {
            "name": name,
            "key": key,
            "secret": secret_plain,
            "expires_at": expires_at,
        }
    }


@router.delete("/{key}")
async def delete_api_key(request: Request, key: str) -> dict:
    """删除 API Key"""
    await require_admin(request)
    
    success = await revoke_api_key(key)
    if not success:
        raise HTTPException(status_code=404, detail="API Key 不存在")
    
    return {"code": 200, "msg": "API Key 已撤销"}


@router.post("/verify")
async def verify_key(request: Request) -> dict:
    """验证 API Key 是否有效"""
    from ..utils.apikey import verify_api_key
    
    body = await request.json()
    key = body.get("key")
    secret = body.get("secret")

    if not key or not secret:
        raise HTTPException(status_code=400, detail="缺少 key 或 secret")

    valid = await verify_api_key(key, secret)
    
    if valid:
        return {"code": 200, "msg": "API Key 有效", "data": {"valid": True}}
    else:
        return {"code": 200, "msg": "API Key 无效", "data": {"valid": False}}
