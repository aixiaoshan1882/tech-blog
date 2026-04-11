"""
请求日志中间件
记录所有 API 请求和响应
"""
import time
import logging
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """请求日志中间件"""
    
    # 忽略的路径
    IGNORE_PATHS = {"/", "/health", "/favicon.ico", "/feed.xml", "/sitemap.xml"}
    
    async def dispatch(self, request: Request, call_next) -> Response:
        # 忽略健康检查和静态资源
        path = request.url.path
        if path in self.IGNORE_PATHS or path.startswith("/uploads"):
            return await call_next(request)
        
        # 记录开始时间
        start_time = time.time()
        
        # 获取请求信息
        method = request.method
        client_ip = request.client.host if request.client else "unknown"
        
        # 处理请求
        response = await call_next(request)
        
        # 计算耗时
        duration = time.time() - start_time
        
        # 获取响应状态
        status_code = response.status_code
        
        # 格式化日志
        log_data = {
            "method": method,
            "path": path,
            "status": status_code,
            "duration_ms": round(duration * 1000, 2),
            "ip": client_ip,
        }
        
        # 根据状态码使用不同日志级别
        if status_code >= 500:
            logger.error(f"API Error: {log_data}")
        elif status_code >= 400:
            logger.warning(f"API Warning: {log_data}")
        else:
            logger.info(f"API Request: {log_data}")
        
        # 添加自定义响应头
        response.headers["X-Response-Time"] = f"{duration * 1000:.2f}ms"
        
        return response


class AuditLogger:
    """审计日志记录器"""
    
    @staticmethod
    def log_action(
        user_id: int | None,
        action: str,
        resource: str,
        resource_id: int | None = None,
        details: str = None,
        request: Request = None,
    ) -> None:
        """记录用户操作"""
        ip_address = None
        user_agent = None
        
        if request:
            ip_address = request.client.host if request.client else None
            user_agent = request.headers.get("user-agent")
        
        # 这里可以写入数据库的 operation_logs 表
        logger.info(
            f"AUDIT: user={user_id} action={action} "
            f"resource={resource} id={resource_id} "
            f"details={details} ip={ip_address}"
        )
