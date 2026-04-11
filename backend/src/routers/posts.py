"""文章路由"""
from fastapi import APIRouter, Request, HTTPException, Query
from typing import Optional
from ..database import db

router = APIRouter(prefix="/posts", tags=["文章"])


@router.get("")
async def get_posts(
    request: Request,
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    category: Optional[str] = None,
    tag: Optional[str] = None,
) -> dict:
    """获取文章列表"""
    offset = (page - 1) * limit

    # 构建查询条件
    where_clauses = ["is_public = 1"]
    params = []

    if category:
        where_clauses.append(
            "EXISTS (SELECT 1 FROM categories c WHERE c.slug = ? AND c.id = posts.category_id)"
        )
        params.append(category)

    where_sql = " AND ".join(where_clauses)

    # 查询总数
    total_result = await db.first(
        f"SELECT COUNT(*) as count FROM posts WHERE {where_sql}",
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

    return {
        "code": 200,
        "data": {
            "items": posts,
            "total": total,
            "page": page,
            "limit": limit,
        },
    }


@router.get("/hot")
async def get_hot_posts(
    limit: int = Query(5, ge=1, le=20),
) -> dict:
    """获取热门文章（按浏览量排序）"""
    posts = await db.select(
        """
        SELECT p.*, c.name as category_name, c.slug as category_slug
        FROM posts p
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.is_public = 1
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
    """获取最新文章"""
    posts = await db.select(
        """
        SELECT p.*, c.name as category_name, c.slug as category_slug
        FROM posts p
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.is_public = 1
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


@router.get("/{slug}")
async def get_post(request: Request, slug: str) -> dict:
    """获取文章详情"""
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

    # 检查权限 - 私密文章需要登录
    if post["is_public"] == 0:
        user_id = getattr(request.state, "user_id", None)
        if not user_id:
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


@router.post("")
async def create_post(request: Request) -> dict:
    """创建文章"""
    # 检查权限
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="未登录")

    body = await request.json()

    # 验证必填字段
    title = body.get("title")
    slug = body.get("slug")
    content = body.get("content")

    if not title or not slug or not content:
        raise HTTPException(status_code=400, detail="缺少必要参数")

    # 检查 slug 唯一
    existing = await db.first("SELECT id FROM posts WHERE slug = ?", [slug])
    if existing:
        raise HTTPException(status_code=400, detail="slug 已存在")

    # 插入文章
    result = await db.execute(
        """
        INSERT INTO posts (title, slug, content, excerpt, cover, category_id, is_public)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        [
            title,
            slug,
            content,
            body.get("excerpt"),
            body.get("cover"),
            body.get("category_id"),
            body.get("is_public", 1),
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

    return {"code": 200, "msg": "创建成功", "data": {"id": post_id}}


@router.put("/{id}")
async def update_post(request: Request, id: int) -> dict:
    """更新文章"""
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="未登录")

    body = await request.json()

    # 构建更新语句
    updates = []
    params = []

    for field in ["title", "slug", "content", "excerpt", "cover", "category_id", "is_public"]:
        if field in body and body[field] is not None:
            updates.append(f"{field} = ?")
            params.append(body[field])

    if not updates:
        raise HTTPException(status_code=400, detail="没有要更新的字段")

    updates.append("updated_at = CURRENT_TIMESTAMP")
    params.append(id)

    await db.execute(f"UPDATE posts SET {', '.join(updates)} WHERE id = ?", params)

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
    """删除文章"""
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="未登录")

    await db.execute("DELETE FROM posts WHERE id = ?", [id])

    return {"code": 200, "msg": "删除成功"}


@router.post("/{id}/like")
async def like_post(request: Request, id: int) -> dict:
    """点赞文章"""
    # 增加点赞数
    await db.execute("UPDATE posts SET like_count = like_count + 1 WHERE id = ?", [id])
    
    # 获取当前点赞数
    post = await db.first("SELECT like_count FROM posts WHERE id = ?", [id])
    like_count = post["like_count"] if post else 0

    return {"code": 200, "msg": "点赞成功", "data": {"like_count": like_count}}
