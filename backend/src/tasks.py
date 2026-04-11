"""定时任务 - 处理定时发布的文章"""
import asyncio
import datetime
from .database import db
from .utils.cache import cache


async def process_scheduled_posts():
    """
    处理定时发布的文章
    将到达定时时间的文章自动发布
    """
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    # 查询需要发布的文章
    posts = await db.select(
        """
        SELECT id, title, slug, scheduled_at
        FROM posts
        WHERE scheduled_at IS NOT NULL
          AND is_public = 0
          AND deleted_at IS NULL
          AND datetime(scheduled_at) <= datetime(?)
        """,
        [now]
    )
    
    published_count = 0
    
    for post in posts:
        # 发布文章
        await db.execute(
            """
            UPDATE posts 
            SET is_public = 1, scheduled_at = NULL, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            [post["id"]]
        )
        published_count += 1
        print(f"[定时任务] 已发布文章: {post['title']} (ID: {post['id']})")
    
    # 清除缓存
    if published_count > 0:
        cache.clear_pattern("posts:*")
    
    return published_count


async def cleanup_old_notifications():
    """
    清理旧的已读通知 (保留30天)
    """
    result = await db.execute(
        """
        DELETE FROM notifications
        WHERE is_read = 1
          AND datetime(created_at) < datetime('now', '-30 days')
        """
    )
    
    deleted = result.get("rowcount", 0) if hasattr(result, 'get') else 0
    if deleted > 0:
        print(f"[定时任务] 清理了 {deleted} 条旧通知")
    
    return deleted


async def run_scheduled_tasks():
    """运行所有定时任务"""
    print(f"[定时任务] 开始执行 ({datetime.datetime.now()})")
    
    # 处理定时发布的文章
    published = await process_scheduled_posts()
    
    # 清理旧通知
    cleaned = await cleanup_old_notifications()
    
    print(f"[定时任务] 完成 - 发布文章: {published}, 清理通知: {cleaned}")


# 如果直接运行，执行任务
if __name__ == "__main__":
    asyncio.run(run_scheduled_tasks())
