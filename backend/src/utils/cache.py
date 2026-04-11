"""Redis 缓存工具"""
import os
import json
from typing import Optional, Any

# 尝试导入 Redis，如果不可用则使用内存缓存
try:
    import redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False


class Cache:
    """缓存类 - 支持 Redis 或内存缓存"""
    
    def __init__(self):
        self.redis_client = None
        self.memory_cache = {}  # 内存缓存回退
        
        if REDIS_AVAILABLE:
            redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
            try:
                self.redis_client = redis.from_url(redis_url, decode_responses=True)
                # 测试连接
                self.redis_client.ping()
                print("[缓存] Redis 连接成功")
            except Exception as e:
                print(f"[缓存] Redis 连接失败，使用内存缓存: {e}")
                self.redis_client = None
    
    def get(self, key: str) -> Optional[Any]:
        """获取缓存"""
        if self.redis_client:
            try:
                value = self.redis_client.get(key)
                if value:
                    return json.loads(value)
            except Exception:
                pass
        
        # 内存缓存回退
        return self.memory_cache.get(key)
    
    def set(self, key: str, value: Any, expire: int = 300) -> bool:
        """设置缓存"""
        # 序列化为 JSON
        try:
            serialized = json.dumps(value)
        except (TypeError, ValueError):
            return False
        
        if self.redis_client:
            try:
                self.redis_client.setex(key, expire, serialized)
                return True
            except Exception:
                pass
        
        # 内存缓存回退
        self.memory_cache[key] = value
        return True
    
    def delete(self, key: str) -> bool:
        """删除缓存"""
        if self.redis_client:
            try:
                self.redis_client.delete(key)
                return True
            except Exception:
                pass
        
        # 内存缓存
        if key in self.memory_cache:
            del self.memory_cache[key]
        return True
    
    def clear_pattern(self, pattern: str) -> int:
        """清除匹配的所有缓存"""
        count = 0
        
        if self.redis_client:
            try:
                keys = self.redis_client.keys(pattern)
                if keys:
                    count = len(keys)
                    self.redis_client.delete(*keys)
            except Exception:
                pass
        
        # 清理内存缓存
        keys_to_delete = [k for k in self.memory_cache.keys() if pattern.replace("*", "") in k]
        for k in keys_to_delete:
            del self.memory_cache[k]
            count += 1
        
        return count
    
    def clear_all(self) -> bool:
        """清除所有缓存"""
        if self.redis_client:
            try:
                self.redis_client.flushdb()
                return True
            except Exception:
                pass
        
        self.memory_cache.clear()
        return True


# 全局缓存实例
cache = Cache()


# ============= 缓存装饰器 =============

def cached(expire: int = 300, key_prefix: str = ""):
    """缓存装饰器"""
    def decorator(func):
        async def wrapper(*args, **kwargs):
            # 生成缓存 key
            cache_key = f"{key_prefix}{func.__name__}:{str(args)}:{str(kwargs)}"
            
            # 尝试从缓存获取
            cached_value = cache.get(cache_key)
            if cached_value is not None:
                return cached_value
            
            # 执行函数
            result = await func(*args, **kwargs)
            
            # 存入缓存
            cache.set(cache_key, result, expire)
            
            return result
        return wrapper
    return decorator


# ============= 缓存工具函数 =============

async def get_cached_posts(page: int = 1, limit: int = 10) -> Optional[dict]:
    """获取文章列表缓存"""
    key = f"posts:list:{page}:{limit}"
    return cache.get(key)


async def set_cached_posts(page: int, limit: int, data: dict, expire: int = 60):
    """设置文章列表缓存"""
    key = f"posts:list:{page}:{limit}"
    cache.set(key, data, expire)


async def invalidate_posts_cache():
    """使文章列表缓存失效"""
    cache.clear_pattern("posts:*")


async def get_cached_categories() -> Optional[dict]:
    """获取分类缓存"""
    return cache.get("categories:all")


async def set_cached_categories(data: dict, expire: int = 300):
    """设置分类缓存"""
    cache.set("categories:all", data, expire)


async def invalidate_categories_cache():
    """使分类缓存失效"""
    cache.delete("categories:all")
