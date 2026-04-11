"""
标准化 API 响应
"""
from typing import Any, Optional, Generic, TypeVar
from pydantic import BaseModel

T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    """标准 API 响应格式"""
    code: int = 200
    msg: str = "操作成功"
    data: Optional[T] = None


class PaginatedData(BaseModel, Generic[T]):
    """分页数据"""
    items: list[T]
    total: int
    page: int
    page_size: int
    has_more: bool


def success(data: Any = None, msg: str = "操作成功") -> dict:
    """成功响应"""
    return {
        "code": 200,
        "msg": msg,
        "data": data,
    }


def error(msg: str = "操作失败", code: int = 400) -> dict:
    """错误响应"""
    return {
        "code": code,
        "msg": msg,
        "data": None,
    }


def paginated(
    items: list,
    total: int,
    page: int,
    page_size: int
) -> dict:
    """分页响应"""
    return {
        "code": 200,
        "msg": "操作成功",
        "data": {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "has_more": len(items) == page_size,
        },
    }


def created(data: Any = None, msg: str = "创建成功") -> dict:
    """创建成功响应"""
    return {
        "code": 201,
        "msg": msg,
        "data": data,
    }


def not_found(msg: str = "资源不存在") -> dict:
    """404 响应"""
    return {
        "code": 404,
        "msg": msg,
        "data": None,
    }


def unauthorized(msg: str = "未授权") -> dict:
    """401 响应"""
    return {
        "code": 401,
        "msg": msg,
        "data": None,
    }


def forbidden(msg: str = "权限不足") -> dict:
    """403 响应"""
    return {
        "code": 403,
        "msg": msg,
        "data": None,
    }


def validation_error(msg: str = "参数验证失败") -> dict:
    """参数验证错误"""
    return {
        "code": 422,
        "msg": msg,
        "data": None,
    }


def server_error(msg: str = "服务器内部错误") -> dict:
    """500 错误响应"""
    return {
        "code": 500,
        "msg": msg,
        "data": None,
    }
