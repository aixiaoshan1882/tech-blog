"""认证路由"""
from typing import Optional
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import JSONResponse
from ..database import db
from ..schemas import UserCreate, UserLogin, UserResponse
from ..utils.auth import hash_password, verify_password, create_token
from ..utils.sanitize import validate_email, validate_password
from ..utils.ratelimit import login_limiter

router = APIRouter(prefix="/auth", tags=["认证"])


def get_client_ip(request: Request) -> str:
    """获取客户端 IP"""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@router.post("/register")
async def register(request: Request) -> dict:
    """用户注册"""
    body = await request.json()
    email = body.get("email")
    password = body.get("password")
    nickname = body.get("nickname")

    # 验证必填字段
    if not email or not password or not nickname:
        raise HTTPException(status_code=400, detail="缺少必要参数")

    # 验证邮箱格式
    if not validate_email(email):
        raise HTTPException(status_code=400, detail="邮箱格式不正确")

    # 验证密码强度
    valid, msg = validate_password(password)
    if not valid:
        raise HTTPException(status_code=400, detail=msg)

    # 检查邮箱是否已注册
    existing = await db.first("SELECT id FROM users WHERE email = ?", [email])
    if existing:
        raise HTTPException(status_code=400, detail="邮箱已被注册")

    # 加密密码
    hashed = hash_password(password)

    # 创建用户
    result = await db.execute(
        "INSERT INTO users (email, password, nickname) VALUES (?, ?, ?)",
        [email, hashed, nickname]
    )

    # 检查是否为第一个用户(管理员)
    user_count = await db.first("SELECT COUNT(*) as count FROM users")
    is_admin = user_count["count"] == 1 if user_count else False

    return {
        "code": 200,
        "msg": "注册成功",
        "data": {"is_admin": is_admin},
    }


@router.post("/login")
async def login(request: Request) -> dict:
    """用户登录"""
    client_ip = get_client_ip(request)
    
    # 速率限制检查
    allowed, remaining = login_limiter.is_allowed(client_ip)
    if not allowed:
        retry_after = login_limiter.get_retry_after(client_ip)
        return JSONResponse(
            status_code=429,
            content={"detail": f"请求过于频繁，请 {retry_after} 秒后重试"},
            headers={"Retry-After": str(retry_after)}
        )
    
    body = await request.json()
    email = body.get("email")
    password = body.get("password")

    # 验证必填字段
    if not email or not password:
        raise HTTPException(status_code=400, detail="缺少必要参数")

    # 查询用户
    user = await db.first("SELECT * FROM users WHERE email = ?", [email])
    if not user:
        raise HTTPException(status_code=401, detail="邮箱或密码错误")

    # 验证密码
    if not verify_password(password, user["password"]):
        raise HTTPException(status_code=401, detail="邮箱或密码错误")

    # 生成 Token
    token = create_token(user["id"])

    return {
        "code": 200,
        "msg": "登录成功",
        "data": {
            "token": token,
            "user": {
                "id": user["id"],
                "email": user["email"],
                "nickname": user["nickname"],
            },
        },
    }


@router.get("/me")
async def get_current_user(request: Request) -> dict:
    """获取当前用户"""
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="未登录")

    user = await db.first(
        "SELECT id, email, nickname, created_at FROM users WHERE id = ?",
        [user_id]
    )
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    return {"code": 200, "data": user}


@router.post("/logout")
async def logout() -> dict:
    """用户登出"""
    return {"code": 200, "msg": "登出成功"}