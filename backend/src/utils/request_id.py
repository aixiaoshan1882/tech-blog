"""
请求 ID 中间件
为每个请求生成唯一 ID，便于追踪
"""
import uuid
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

REQUEST_ID_HEADER = "X-Request-ID"


class RequestIDMiddleware(BaseHTTPMiddleware):
    """请求 ID 中间件"""
    
    async def dispatch(self, request: Request, call_next) -> Response:
        # 检查请求头是否有自定义 ID
        request_id = request.headers.get(REQUEST_ID_HEADER)
        
        # 如果没有，生成一个新的
        if not request_id:
            request_id = str(uuid.uuid4())
        
        # 存储到请求状态
        request.state.request_id = request_id
        
        # 处理请求
        response = await call_next(request)
        
        # 在响应头中添加 Request ID
        response.headers[REQUEST_ID_HEADER] = request_id
        
        return response


def get_request_id(request: Request) -> str:
    """获取当前请求的 ID"""
    return getattr(request.state, "request_id", "unknown")
