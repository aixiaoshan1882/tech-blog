"""文章路由"""
from fastapi import APIRouter, Request, HTTPException, Query
from typing import Optional
from ..database import db
from .auth import require_admin, get_user_by_id
from ..utils.sanitize import sanitize_html
from ..utils.cache import cache

router = APIRouter(prefix="/posts", tags=["文章"])


@router.get("")
async def get_posts(
    request: Request,
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    category: Optional[str] = None,
    tag: Optional[str] = None,
) -> dict:
    """获取文章列表 (带缓存)"""
    # 生成缓存 key (基于查询参数)
    cache_key = f"posts:page:{page}:limit:{limit}:cat:{category or ''}:tag:{tag or ''}"
    
    # 尝试从缓存获取 (仅对非管理员公开列表)
    user_id = getattr(request.state, "user_id", None)
    is_admin = False
    if user_id:
        user = await get_user_by_id(user_id)
        is_admin = user and user.get("role") == "admin"
    
    # 非管理员使用缓存
    if not is_admin:
        cached_data = cache.get(cache_key)
        if cached_data:
            return cached_data
    
    # 无缓存，执行数据库查询
    offset = (page - 1) * limit

    # 构建查询条件
    where_clauses = ["p.deleted_at IS NULL"]
    params = []
    
    # 非管理员只能看公开文章
    if not is_admin:
        where_clauses.append("p.is_public = 1")

    if category:
        where_clauses.append(
            "EXISTS (SELECT 1 FROM categories c WHERE c.slug = ? AND c.id = p.category_id)"
        )
        params.append(category)

    where_sql = " AND ".join(where_clauses) if where_clauses else "1=1"

    # 查询总数
    total_result = await db.first(
        f"SELECT COUNT(*) as count FROM posts p WHERE {where_sql}",
        params
    )
    total = total_result["count"] if total_result else 0

    # 查询列表
    query = f"""
        SELECT p.*, c.name as category_name, c.slug as category_slug
        FROM posts p
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE {where_sql}
        ORDER BY p.created_at DESC
        LIMIT ? OFFSET ?
    """
    posts = await db.select(query, params + [limit, offset])

    # 获取标签
    for post in posts:
        tags = await db.select(
            "SELECT t.* FROM tags t JOIN post_tags pt ON pt.tag_id = t.id WHERE pt.post_id = ?",
            [post["id"]],
        )
        post["tags"] = tags

    result = {
        "code": 200,
        "data": {
            "items": posts,
            "total": total,
            "page": page,
            "limit": limit,
        },
    }
    
    # 缓存结果 (非管理员公开列表缓存 60 秒)
    if not is_admin:
        cache.set(cache_key, result, expire=60)
    
    return result


@router.get("/hot")
async def get_hot_posts(
    limit: int = Query(5, ge=1, le=20),
) -> dict:
    """获取热门文章（按浏览量排序，只显示公开文章）"""
    posts = await db.select(
        """
        SELECT p.*, c.name as category_name, c.slug as category_slug
        FROM posts p
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.is_public = 1 AND p.deleted_at IS NULL
        ORDER BY p.view_count DESC, p.created_at DESC
        LIMIT ?
        """,
        [limit],
    )
    
    for post in posts:
        tags = await db.select(
            "SELECT t.* FROM tags t JOIN post_tags pt ON pt.tag_id = t.id WHERE pt.post_id = ?",
            [post["id"]],
        )
        post["tags"] = tags

    return {"code": 200, "data": posts}


@router.get("/latest")
async def get_latest_posts(
    limit: int = Query(5, ge=1, le=20),
) -> dict:
    """获取最新文章（只显示公开文章）"""
    posts = await db.select(
        """
        SELECT p.*, c.name as category_name, c.slug as category_slug
        FROM posts p
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.is_public = 1 AND p.deleted_at IS NULL
        ORDER BY p.created_at DESC
        LIMIT ?
        """,
        [limit],
    )
    
    for post in posts:
        tags = await db.select(
            "SELECT t.* FROM tags t JOIN post_tags pt ON pt.tag_id = t.id WHERE pt.post_id = ?",
            [post["id"]],
        )
        post["tags"] = tags

    return {"code": 200, "data": posts}


@router.get("/my")
async def get_my_posts(
    request: Request,
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
) -> dict:
    """获取当前用户的私有文章（管理员专用）"""
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="未登录")
    
    # 检查管理员权限
    user = await get_user_by_id(user_id)
    if not user or user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="需要管理员权限")
    
    offset = (page - 1) * limit
    
    # 查询该管理员的私有文章（排除已删除的）
    total_result = await db.first(
        "SELECT COUNT(*) as count FROM posts WHERE user_id = ? AND is_public = 0 AND deleted_at IS NULL",
        [user_id]
    )
    total = total_result["count"] if total_result else 0
    
    posts = await db.select(
        """
        SELECT p.*, c.name as category_name, c.slug as category_slug
        FROM posts p
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.user_id = ? AND p.is_public = 0 AND p.deleted_at IS NULL
        ORDER BY p.created_at DESC
        LIMIT ? OFFSET ?
        """,
        [user_id, limit, offset]
    )
    
    for post in posts:
        tags = await db.select(
            "SELECT t.* FROM tags t JOIN post_tags pt ON pt.tag_id = t.id WHERE pt.post_id = ?",
            [post["id"]],
        )
        post["tags"] = tags
    
    return {
        "code": 200,
        "data": {
            "items": posts,
            "total": total,
            "page": page,
            "limit": limit,
        },
    }


@router.get("/{slug}")
async def get_post(request: Request, slug: str) -> dict:
    """获取文章详情"""
    user_id = getattr(request.state, "user_id", None)
    
    # 检查是否为管理员
    is_admin = False
    if user_id:
        user = await get_user_by_id(user_id)
        is_admin = user and user.get("role") == "admin"
    
    # 查询文章
    post = await db.first(
        """
        SELECT p.*, c.name as category_name, c.slug as category_slug
        FROM posts p
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.slug = ?
        """,
        [slug],
    )

    if not post:
        raise HTTPException(status_code=404, detail="文章不存在")

    # 检查访问权限
    # 公开文章：所有人都可以访问
    # 私密文章：只有作者本人可以访问
    if post["is_public"] == 0:
        if not user_id:
            raise HTTPException(status_code=403, detail="无权访问")
        # 非作者且非管理员无权访问
        if post["user_id"] != user_id and not is_admin:
            raise HTTPException(status_code=403, detail="无权访问")

    # 增加浏览量
    await db.execute("UPDATE posts SET view_count = view_count + 1 WHERE id = ?", [post["id"]])

    # 获取标签
    tags = await db.select(
        "SELECT t.* FROM tags t JOIN post_tags pt ON pt.tag_id = t.id WHERE pt.post_id = ?",
        [post["id"]],
    )
    post["tags"] = tags

    return {"code": 200, "data": post}


@router.get("/{slug}/related")
async def get_related_posts(
    request: Request,
    slug: str,
    limit: int = Query(5, ge=1, le=10),
) -> dict:
    """获取相关文章推荐（基于相同分类或标签）"""
    # 获取当前文章
    current_post = await db.first(
        "SELECT id, category_id FROM posts WHERE slug = ? AND deleted_at IS NULL",
        [slug]
    )
    if not current_post:
        raise HTTPException(status_code=404, detail="文章不存在")
    
    # 获取当前文章的标签
    current_tags = await db.select(
        "SELECT tag_id FROM post_tags WHERE post_id = ?",
        [current_post["id"]]
    )
    current_tag_ids = [t["tag_id"] for t in current_tags]
    
    # 构建查询：基于相同分类或标签的文章
    if current_tag_ids:
        # 有标签：优先匹配标签，其次匹配分类
        posts = await db.select(
            """
            SELECT p.*, c.name as category_name, c.slug as category_slug,
                   COUNT(DISTINCT pt.tag_id) as matching_tags
            FROM posts p
            LEFT JOIN categories c ON c.id = p.category_id
            LEFT JOIN post_tags pt ON pt.post_id = p.id AND pt.tag_id IN (
                SELECT tag_id FROM post_tags WHERE post_id = ?
            )
            WHERE p.id != ? AND p.is_public = 1 AND p.deleted_at IS NULL
            GROUP BY p.id
            ORDER BY matching_tags DESC, p.view_count DESC, p.created_at DESC
            LIMIT ?
            """,
            [current_post["id"], current_post["id"], limit]
        )
    elif current_post["category_id"]:
        # 无标签但有分类：匹配分类
        posts = await db.select(
            """
            SELECT p.*, c.name as category_name, c.slug as category_slug
            FROM posts p
            LEFT JOIN categories c ON c.id = p.category_id
            WHERE p.id != ? AND p.category_id = ? AND p.is_public = 1 AND p.deleted_at IS NULL
            ORDER BY p.view_count DESC, p.created_at DESC
            LIMIT ?
            """,
            [current_post["id"], current_post["category_id"], limit]
        )
    else:
        # 无标签无分类：返回热门文章
        posts = await db.select(
            """
            SELECT p.*, c.name as category_name, c.slug as category_slug
            FROM posts p
            LEFT JOIN categories c ON c.id = p.category_id
            WHERE p.id != ? AND p.is_public = 1 AND p.deleted_at IS NULL
            ORDER BY p.view_count DESC, p.created_at DESC
            LIMIT ?
            """,
            [current_post["id"], limit]
        )
    
    # 获取每篇文章的标签
    for post in posts:
        tags = await db.select(
            "SELECT t.* FROM tags t JOIN post_tags pt ON pt.tag_id = t.id WHERE pt.post_id = ?",
            [post["id"]],
        )
        post["tags"] = tags
    
    return {"code": 200, "data": posts}


@router.post("")
async def create_post(request: Request) -> dict:
    """创建文章"""
    # 检查管理员权限
    user = await require_admin(request)
    user_id = user["id"]

    body = await request.json()

    # 验证必填字段
    title = body.get("title")
    slug = body.get("slug")
    content = body.get("content")

    if not title or not slug or not content:
        raise HTTPException(status_code=400, detail="缺少必要参数")

    # XSS 防护 - 转义 HTML
    title = sanitize_html(title)[:200]
    slug = sanitize_html(slug)[:100]
    content = sanitize_html(content)[:50000]

    # 检查 slug 唯一
    existing = await db.first("SELECT id FROM posts WHERE slug = ?", [slug])
    if existing:
        raise HTTPException(status_code=400, detail="slug 已存在")

    # 获取 is_public 设置（默认公开）
    is_public = body.get("is_public", 1)
    
    # 确保 is_public 是 0 或 1
    is_public = 1 if is_public else 0

    # 插入文章，关联当前管理员
    result = await db.execute(
        """
        INSERT INTO posts (title, slug, content, excerpt, cover, category_id, user_id, is_public)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            title,
            slug,
            content,
            sanitize_html(body.get("excerpt", ""))[:500],
            body.get("cover"),
            body.get("category_id"),
            user_id,
            is_public,
        ],
    )

    post_id = result.get("last_row_id", 1)

    # 处理标签
    tag_ids = body.get("tag_ids", [])
    for tag_id in tag_ids:
        await db.execute(
            "INSERT INTO post_tags (post_id, tag_id) VALUES (?, ?)",
            [post_id, tag_id],
        )
    
    # 清除文章列表缓存
    cache.clear_pattern("posts:*")

    return {"code": 200, "msg": "创建成功", "data": {"id": post_id, "is_public": is_public}}


@router.put("/{id}")
async def update_post(request: Request, id: int) -> dict:
    """更新文章"""
    user = await require_admin(request)
    user_id = user["id"]

    body = await request.json()

    # 构建更新语句
    updates = []
    params = []

    for field in ["title", "slug", "content", "excerpt", "cover", "category_id"]:
        if field in body and body[field] is not None:
            # XSS 防护
            value = sanitize_html(body[field])
            if field in ["title"]:
                value = value[:200]
            elif field == "slug":
                value = value[:100]
            elif field == "content":
                value = value[:50000]
            elif field == "excerpt":
                value = value[:500]
            
            updates.append(f"{field} = ?")
            params.append(value)
    
    # is_public 单独处理（整数类型）
    if "is_public" in body and body["is_public"] is not None:
        value = 1 if body["is_public"] else 0
        updates.append("is_public = ?")
        params.append(value)

    if not updates:
        raise HTTPException(status_code=400, detail="没有要更新的字段")

    updates.append("updated_at = CURRENT_TIMESTAMP")
    params.append(id)

    await db.execute(f"UPDATE posts SET {', '.join(updates)} WHERE id = ?", params)

    # 清除文章列表缓存
    cache.clear_pattern("posts:*")

    # 更新标签
    if "tag_ids" in body:
        await db.execute("DELETE FROM post_tags WHERE post_id = ?", [id])
        for tag_id in body["tag_ids"]:
            await db.execute(
                "INSERT INTO post_tags (post_id, tag_id) VALUES (?, ?)",
                [id, tag_id],
            )

    return {"code": 200, "msg": "更新成功"}


@router.delete("/{id}")
async def delete_post(request: Request, id: int) -> dict:
    """删除文章 (移入回收站)"""
    # 检查管理员权限
    await require_admin(request)

    # 软删除：设置 deleted_at 时间戳
    await db.execute(
        "UPDATE posts SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL",
        [id]
    )
    
    # 清除文章列表缓存
    cache.clear_pattern("posts:*")

    return {"code": 200, "msg": "文章已移入回收站"}


@router.get("/trash/list")
async def get_trash_posts(
    request: Request,
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
) -> dict:
    """获取回收站文章列表 (管理员专用)"""
    # 检查管理员权限
    await require_admin(request)
    
    offset = (page - 1) * limit
    
    # 查询回收站文章
    total_result = await db.first(
        "SELECT COUNT(*) as count FROM posts WHERE deleted_at IS NOT NULL"
    )
    total = total_result["count"] if total_result else 0
    
    posts = await db.select(
        """
        SELECT p.*, c.name as category_name
        FROM posts p
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.deleted_at IS NOT NULL
        ORDER BY p.deleted_at DESC
        LIMIT ? OFFSET ?
        """,
        [limit, offset]
    )
    
    return {
        "code": 200,
        "data": {
            "items": posts,
            "total": total,
            "page": page,
            "limit": limit,
        },
    }


@router.post("/{id}/restore")
async def restore_post(request: Request, id: int) -> dict:
    """恢复已删除的文章 (管理员专用)"""
    # 检查管理员权限
    await require_admin(request)
    
    # 检查文章是否存在且已删除
    post = await db.first(
        "SELECT * FROM posts WHERE id = ? AND deleted_at IS NOT NULL",
        [id]
    )
    if not post:
        raise HTTPException(status_code=404, detail="文章不存在或未删除")
    
    # 恢复文章
    await db.execute(
        "UPDATE posts SET deleted_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [id]
    )
    
    # 清除文章列表缓存
    cache.clear_pattern("posts:*")
    
    return {"code": 200, "msg": "文章已恢复"}


@router.delete("/{id}/permanent")
async def permanent_delete_post(request: Request, id: int) -> dict:
    """永久删除文章 (管理员专用)"""
    # 检查管理员权限
    await require_admin(request)
    
    # 检查文章是否存在
    post = await db.first("SELECT * FROM posts WHERE id = ?", [id])
    if not post:
        raise HTTPException(status_code=404, detail="文章不存在")
    
    # 先删除关联的标签
    await db.execute("DELETE FROM post_tags WHERE post_id = ?", [id])
    
    # 永久删除
    await db.execute("DELETE FROM posts WHERE id = ?", [id])
    
    # 清除文章列表缓存
    cache.clear_pattern("posts:*")
    
    return {"code": 200, "msg": "文章已永久删除"}


@router.post("/{id}/like")
async def like_post(request: Request, id: int) -> dict:
    """点赞文章"""
    user_id = getattr(request.state, "user_id", None)
    
    # 检查文章是否存在且未删除
    post = await db.first(
        "SELECT id, title, user_id FROM posts WHERE id = ? AND deleted_at IS NULL",
        [id]
    )
    if not post:
        raise HTTPException(status_code=404, detail="文章不存在")
    
    # 如果已登录，检查是否已经点赞
    if user_id:
        existing = await db.first(
            "SELECT id FROM user_likes WHERE user_id = ? AND post_id = ?",
            [user_id, id]
        )
        if existing:
            raise HTTPException(status_code=400, detail="已经点赞过了")
        
        # 记录点赞
        await db.execute(
            "INSERT INTO user_likes (user_id, post_id) VALUES (?, ?)",
            [user_id, id]
        )
        
        # 发送通知给文章作者
        if post["user_id"] and post["user_id"] != user_id:
            liker = await db.first("SELECT nickname FROM users WHERE id = ?", [user_id])
            liker_name = liker["nickname"] if liker else "某用户"
            await db.execute(
                """
                INSERT INTO notifications (user_id, type, title, content, related_id)
                VALUES (?, ?, ?, ?, ?)
                """,
                [
                    post["user_id"],
                    "post_like",
                    f"{liker_name} 点赞了你的文章",
                    f"《{post['title'][:20]}...》",
                    id
                ]
            )
    
    # 增加点赞数
    await db.execute("UPDATE posts SET like_count = like_count + 1 WHERE id = ?", [id])
    
    # 获取当前点赞数
    post = await db.first("SELECT like_count FROM posts WHERE id = ?", [id])
    like_count = post["like_count"] if post else 0

    return {"code": 200, "msg": "点赞成功", "data": {"like_count": like_count}}


@router.delete("/{id}/like")
async def unlike_post(request: Request, id: int) -> dict:
    """取消点赞"""
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="请先登录")
    
    # 检查是否已经点赞
    existing = await db.first(
        "SELECT id FROM user_likes WHERE user_id = ? AND post_id = ?",
        [user_id, id]
    )
    if not existing:
        raise HTTPException(status_code=400, detail="还没有点赞")
    
    # 删除点赞记录
    await db.execute(
        "DELETE FROM user_likes WHERE user_id = ? AND post_id = ?",
        [user_id, id]
    )
    
    # 减少点赞数
    await db.execute(
        "UPDATE posts SET like_count = MAX(0, like_count - 1) WHERE id = ?",
        [id]
    )
    
    # 获取当前点赞数
    post = await db.first("SELECT like_count FROM posts WHERE id = ?", [id])
    like_count = post["like_count"] if post else 0

    return {"code": 200, "msg": "取消点赞成功", "data": {"like_count": like_count}}


@router.get("/{id}/like/status")
async def get_like_status(request: Request, id: int) -> dict:
    """获取点赞状态"""
    user_id = getattr(request.state, "user_id", None)
    
    liked = False
    if user_id:
        existing = await db.first(
            "SELECT id FROM user_likes WHERE user_id = ? AND post_id = ?",
            [user_id, id]
        )
        liked = existing is not None
    
    post = await db.first("SELECT like_count FROM posts WHERE id = ?", [id])
    like_count = post["like_count"] if post else 0
    
    return {
        "code": 200,
        "data": {
            "liked": liked,
            "like_count": like_count
        }
    }


@router.get("/{id}/stats")
async def get_post_stats(request: Request, id: int) -> dict:
    """获取文章详细统计"""
    # 检查文章是否存在
    post = await db.first("SELECT * FROM posts WHERE id = ?", [id])
    if not post:
        raise HTTPException(status_code=404, detail="文章不存在")
    
    # 获取文章统计
    stats = await db.first(
        "SELECT * FROM post_stats WHERE post_id = ?",
        [id]
    )
    
    # 获取评论数
    comment_count = await db.first(
        "SELECT COUNT(*) as count FROM comments WHERE post_id = ?",
        [id]
    )
    
    return {
        "code": 200,
        "data": {
            "post_id": id,
            "title": post["title"],
            "view_count": post["view_count"],
            "like_count": post["like_count"],
            "comment_count": comment_count["count"] if comment_count else 0,
            "unique_views": stats["unique_views"] if stats else 0,
            "avg_read_time": stats["avg_read_time"] if stats else 0,
            "share_count": stats["share_count"] if stats else 0,
        }
    }


@router.get("/rankings")
async def get_post_rankings(request: Request) -> dict:
    """获取文章排行榜"""
    # 获取热门文章（按浏览量）
    hot_posts = await db.select(
        """
        SELECT p.id, p.title, p.slug, p.view_count, p.like_count,
               c.name as category_name
        FROM posts p
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.is_public = 1 AND p.deleted_at IS NULL
        ORDER BY p.view_count DESC
        LIMIT 10
        """
    )
    
    # 获取最受点赞文章
    most_liked = await db.select(
        """
        SELECT p.id, p.title, p.slug, p.like_count,
               c.name as category_name
        FROM posts p
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.is_public = 1 AND p.deleted_at IS NULL
        ORDER BY p.like_count DESC
        LIMIT 10
        """
    )
    
    # 获取最新文章
    latest_posts = await db.select(
        """
        SELECT p.id, p.title, p.slug, p.created_at,
               c.name as category_name
        FROM posts p
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.is_public = 1 AND p.deleted_at IS NULL
        ORDER BY p.created_at DESC
        LIMIT 10
        """
    )
    
    return {
        "code": 200,
        "data": {
            "hot": hot_posts,
            "most_liked": most_liked,
            "latest": latest_posts,
        }
    }


# ============= 收藏功能 =============

@router.post("/{id}/favorite")
async def add_favorite(request: Request, id: int) -> dict:
    """收藏文章"""
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="请先登录")
    
    # 检查文章是否存在
    post = await db.first(
        "SELECT id, title, user_id FROM posts WHERE id = ? AND deleted_at IS NULL",
        [id]
    )
    if not post:
        raise HTTPException(status_code=404, detail="文章不存在")
    
    # 检查是否已经收藏
    existing = await db.first(
        "SELECT id FROM user_favorites WHERE user_id = ? AND post_id = ?",
        [user_id, id]
    )
    if existing:
        raise HTTPException(status_code=400, detail="已经收藏过了")
    
    # 添加收藏
    await db.execute(
        "INSERT INTO user_favorites (user_id, post_id) VALUES (?, ?)",
        [user_id, id]
    )
    
    return {"code": 200, "msg": "收藏成功"}


@router.delete("/{id}/favorite")
async def remove_favorite(request: Request, id: int) -> dict:
    """取消收藏"""
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="请先登录")
    
    await db.execute(
        "DELETE FROM user_favorites WHERE user_id = ? AND post_id = ?",
        [user_id, id]
    )
    
    return {"code": 200, "msg": "取消收藏成功"}


@router.get("/favorites/mine")
async def get_my_favorites(
    request: Request,
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=50),
) -> dict:
    """获取我的收藏列表"""
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="请先登录")
    
    offset = (page - 1) * limit
    
    favorites = await db.select(
        """
        SELECT p.*, c.name as category_name, c.slug as category_slug,
               uf.created_at as favorited_at
        FROM user_favorites uf
        JOIN posts p ON p.id = uf.post_id
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE uf.user_id = ? AND p.deleted_at IS NULL
        ORDER BY uf.created_at DESC
        LIMIT ? OFFSET ?
        """,
        [user_id, limit, offset]
    )
    
    # 获取总数
    total_result = await db.first(
        "SELECT COUNT(*) as count FROM user_favorites uf JOIN posts p ON p.id = uf.post_id WHERE uf.user_id = ? AND p.deleted_at IS NULL",
        [user_id]
    )
    total = total_result["count"] if total_result else 0
    
    # 获取每篇文章的标签
    for fav in favorites:
        tags = await db.select(
            "SELECT t.* FROM tags t JOIN post_tags pt ON pt.tag_id = t.id WHERE pt.post_id = ?",
            [fav["id"]],
        )
        fav["tags"] = tags
    
    return {
        "code": 200,
        "data": {
            "items": favorites,
            "total": total,
            "page": page,
            "limit": limit,
        },
    }


@router.get("/{id}/favorite/status")
async def get_favorite_status(request: Request, id: int) -> dict:
    """获取收藏状态"""
    user_id = getattr(request.state, "user_id", None)
    
    favorited = False
    if user_id:
        existing = await db.first(
            "SELECT id FROM user_favorites WHERE user_id = ? AND post_id = ?",
            [user_id, id]
        )
        favorited = existing is not None
    
    return {
        "code": 200,
        "data": {"favorited": favorited}
    }
