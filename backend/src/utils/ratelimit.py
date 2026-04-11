"""速率限制工具"""
import time
from collections import defaultdict
from typing import Dict, Tuple


class RateLimiter:
    """简单的内存速率限制器"""
    
    def __init__(self, max_requests: int = 5, window_seconds: int = 60):
        self.max_requests = max_requests  # 时间窗口内最大请求数
        self.window_seconds = window_seconds  # 时间窗口（秒）
        self.requests: Dict[str, list] = defaultdict(list)  # IP -> 请求时间列表
    
    def is_allowed(self, identifier: str) -> Tuple[bool, int]:
        """
        检查是否允许请求
        返回: (是否允许, 剩余可用请求数)
        """
        now = time.time()
        window_start = now - self.window_seconds
        
        # 清理过期的请求记录
        self.requests[identifier] = [
            t for t in self.requests[identifier] 
            if t > window_start
        ]
        
        # 检查是否超限
        if len(self.requests[identifier]) >= self.max_requests:
            return False, 0
        
        # 记录本次请求
        self.requests[identifier].append(now)
        remaining = self.max_requests - len(self.requests[identifier])
        return True, remaining
    
    def get_retry_after(self, identifier: str) -> int:
        """获取需要等待的秒数"""
        if not self.requests[identifier]:
            return 0
        
        oldest = min(self.requests[identifier])
        elapsed = time.time() - oldest
        return max(0, int(self.window_seconds - elapsed))


# 全局限流器实例
# 登录: 60秒内最多5次
login_limiter = RateLimiter(max_requests=5, window_seconds=60)

# API: 60秒内最多100次
api_limiter = RateLimiter(max_requests=100, window_seconds=60)

# 注册: 5分钟内最多3次
register_limiter = RateLimiter(max_requests=3, window_seconds=300)

# 搜索: 60秒内最多30次
search_limiter = RateLimiter(max_requests=30, window_seconds=60)

# 评论: 60秒内最多10次
comment_limiter = RateLimiter(max_requests=10, window_seconds=60)
