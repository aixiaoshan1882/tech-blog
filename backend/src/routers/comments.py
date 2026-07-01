"""评论路由"""
from fastapi import APIRouter, Request, HTTPException, Query
from fastapi.responses import JSONResponse
from ..database import db
from ..utils.sanitize import sanitize_html
from ..utils.ratelimit import comment_limiter
from .auth import require_admin, get_user_by_id

# 评论配置
COMMENT_MAX_LENGTH = 2000  # 评论最大字符数
COMMENT_MIN_LENGTH = 2     # 评论最小字符数
NICKNAME_MAX_LENGTH = 50   # 昵称最大字符数

router = APIRouter(prefix="/comments", tags=["评论"])


@router.get("")
async def get_all_comments(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    postId: int = None,
    status: str = None,
) -> dict:
    """获取所有评论（管理后台用）"""
    offset = (page - 1) * page_size
    where_clauses = []
    params = []

    if postId:
        where_clauses.append("c.post_id = ?")
        params.append(postId)

    if status == "approved":
        where_clauses.append("c.is_approved = 1")
    elif status in {"pending", "spam"}:
        where_clauses.append("c.is_approved = 0")

    where_sql = " AND ".join(where_clauses) if where_clauses else "1=1"
    
    # 查询评论及其关联文章
    comments = await db.select(
        f"""
        SELECT c.*, p.title as post_title, p.slug as post_slug
        FROM comments c
        LEFT JOIN posts p ON c.post_id = p.id
        WHERE {where_sql}
        ORDER BY c.created_at DESC
        LIMIT ? OFFSET ?
        """,
        params + [page_size, offset],
    )
    
    # 获取总数
    total_result = await db.first(
        f"SELECT COUNT(*) as count FROM comments c WHERE {where_sql}",
        params,
    )
    total = total_result["count"] if total_result else 0
    
    return {
        "code": 200,
        "data": {
            "items": comments,
            "total": total,
            "page": page,
            "pageSize": page_size,
            "hasMore": offset + len(comments) < total,
        },
    }


@router.get("/post/{slug}")
async def get_comments(request: Request, slug: str) -> dict:
    """获取文章评论"""
    # 获取文章ID
    post = await db.first("SELECT id FROM posts WHERE slug = ?", [slug])
    if not post:
        raise HTTPException(status_code=404, detail="文章不存在")

    post_id = post["id"]

    # 查询所有评论
    comments = await db.select(
        "SELECT * FROM comments WHERE post_id = ? ORDER BY created_at",
        [post_id],
    )

    # 构建树形结构
    comment_map = {c["id"]: {**c, "children": []} for c in comments}
    roots = []

    for comment in comments:
        if comment["parent_id"] == 0:
            roots.append(comment_map[comment["id"]])
        elif comment["parent_id"] in comment_map:
            comment_map[comment["parent_id"]]["children"].append(comment_map[comment["id"]])

    return {"code": 200, "data": roots}


@router.post("/post/{slug}")
async def create_comment(request: Request, slug: str) -> dict:
    """发表评论"""
    # 获取文章ID
    post = await db.first("SELECT id, title, user_id FROM posts WHERE slug = ?", [slug])
    if not post:
        raise HTTPException(status_code=404, detail="文章不存在")

    body = await request.json()
    return await _create_comment_for_post(request, post, body)


@router.post("")
async def create_comment_by_post_id(request: Request) -> dict:
    """按文章 ID 发表评论"""
    body = await request.json()
    post_id = body.get("post_id")
    if not post_id:
        raise HTTPException(status_code=400, detail="缺少文章ID")

    post = await db.first("SELECT id, title, user_id FROM posts WHERE id = ?", [post_id])
    if not post:
        raise HTTPException(status_code=404, detail="文章不存在")

    return await _create_comment_for_post(request, post, body)


async def _create_comment_for_post(request: Request, post: dict, body: dict) -> dict:
    client_ip = request.client.host if request.client else "unknown"

    # 评论速率限制
    allowed, _ = comment_limiter.is_allowed(client_ip)
    if not allowed:
        retry_after = comment_limiter.get_retry_after(client_ip)
        return JSONResponse(
            status_code=429,
            content={"detail": f"评论过于频繁，请 {retry_after} 秒后重试"},
            headers={"Retry-After": str(retry_after)}
        )

    post_id = post["id"]
    post_title = post["title"]
    post_author_id = post.get("user_id")
    user_id = getattr(request.state, "user_id", None)
    user = await get_user_by_id(user_id) if user_id else None

    nickname = body.get("nickname")
    content = body.get("content")
    parent_id = body.get("parent_id", 0)
    email = body.get("email")
    if user:
        nickname = nickname or user.get("nickname")
        email = email or user.get("email")

    # 验证必填字段
    if not nickname or not content:
        raise HTTPException(status_code=400, detail="缺少必要参数")
    
    # 验证内容长度（ sanitization 之前）
    content = str(content).strip()
    if len(content) < COMMENT_MIN_LENGTH:
        raise HTTPException(status_code=400, detail=f"评论内容至少{COMMENT_MIN_LENGTH}个字符")
    if len(content) > COMMENT_MAX_LENGTH:
        raise HTTPException(status_code=400, detail=f"评论内容不能超过{COMMENT_MAX_LENGTH}个字符")
    
    # 验证昵称长度
    nickname = str(nickname).strip()
    if len(nickname) < 2:
        raise HTTPException(status_code=400, detail="昵称至少2个字符")
    if len(nickname) > NICKNAME_MAX_LENGTH:
        raise HTTPException(status_code=400, detail=f"昵称不能超过{NICKNAME_MAX_LENGTH}个字符")

    # XSS 防护 - 清理用户输入（限制长度）
    nickname = sanitize_html(nickname)[:NICKNAME_MAX_LENGTH]
    content = sanitize_html(content)[:COMMENT_MAX_LENGTH]
    email = sanitize_html(email)[:100] if email else None

    result = await db.execute(
        "INSERT INTO comments (post_id, user_id, parent_id, nickname, email, content) VALUES (?, ?, ?, ?, ?, ?)",
        [post_id, user_id, parent_id, nickname, email, content],
    )
    
    comment_id = result.get("last_row_id")

    # 创建通知
    await _create_comment_notification(
        post_id=post_id,
        post_title=post_title,
        post_author_id=post_author_id,
        comment_id=comment_id,
        parent_id=parent_id,
        commenter_nickname=nickname,
        content=content[:100]
    )

    return {"code": 200, "msg": "评论成功", "data": {"id": comment_id}}


async def _create_comment_notification(
    post_id: int,
    post_title: str,
    post_author_id: int,
    comment_id: int,
    parent_id: int,
    commenter_nickname: str,
    content: str
):
    """创建评论通知"""
    # 如果是回复评论，通知被回复的人
    if parent_id > 0:
        parent_comment = await db.first(
            "SELECT * FROM comments WHERE id = ?",
            [parent_id]
        )
        if parent_comment and parent_comment.get("email"):
            # 找到被回复的评论作者（通过 email）
            parent_author = await db.first(
                "SELECT id FROM users WHERE email = ?",
                [parent_comment["email"]]
            )
            if parent_author and parent_author["id"] != post_author_id:
                await db.execute(
                    """
                    INSERT INTO notifications (user_id, type, title, content, related_id)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    [
                        parent_author["id"],
                        "comment_reply",
                        f"{commenter_nickname} 回复了你的评论",
                        content[:100],
                        comment_id
                    ]
                )
    
    # 通知文章作者有新评论
    if post_author_id:
        # 检查是否已经通知过（避免重复通知）
        existing = await db.first(
            """
            SELECT id FROM notifications 
            WHERE user_id = ? AND type = 'new_comment' 
            AND related_id = ? AND created_at > datetime('now', '-1 minute')
            """,
            [post_author_id, comment_id]
        )
        if not existing:
            await db.execute(
                """
                INSERT INTO notifications (user_id, type, title, content, related_id)
                VALUES (?, ?, ?, ?, ?)
                """,
                [
                    post_author_id,
                    "new_comment",
                    f"{commenter_nickname} 评论了你的文章",
                    f"《{post_title}》",
                    comment_id
                ]
            )


@router.delete("/{id}")
async def delete_comment(request: Request, id: int) -> dict:
    """删除评论"""
    await require_admin(request)

    await db.execute("DELETE FROM comments WHERE id = ?", [id])

    return {"code": 200, "msg": "删除成功"}


@router.post("/{id}/like")
async def like_comment(request: Request, id: int) -> dict:
    """点赞评论"""
    user_id = getattr(request.state, "user_id", None)
    
    # 检查评论是否存在
    comment = await db.first("SELECT * FROM comments WHERE id = ?", [id])
    if not comment:
        raise HTTPException(status_code=404, detail="评论不存在")
    
    # 如果已登录，检查是否已经点赞
    if user_id:
        existing = await db.first(
            "SELECT id FROM comment_likes WHERE user_id = ? AND comment_id = ?",
            [user_id, id]
        )
        if existing:
            raise HTTPException(status_code=400, detail="已经点赞过了")
        
        # 记录点赞
        await db.execute(
            "INSERT INTO comment_likes (user_id, comment_id) VALUES (?, ?)",
            [user_id, id]
        )
    
    # 增加点赞数
    await db.execute("UPDATE comments SET like_count = like_count + 1 WHERE id = ?", [id])
    
    # 获取当前点赞数
    comment = await db.first("SELECT like_count FROM comments WHERE id = ?", [id])
    like_count = comment["like_count"] if comment else 0

    return {"code": 200, "msg": "点赞成功", "data": {"like_count": like_count}}


@router.delete("/{id}/like")
async def unlike_comment(request: Request, id: int) -> dict:
    """取消点赞评论"""
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="请先登录")
    
    existing = await db.first(
        "SELECT id FROM comment_likes WHERE user_id = ? AND comment_id = ?",
        [user_id, id]
    )
    if not existing:
        raise HTTPException(status_code=400, detail="还没有点赞")
    
    await db.execute(
        "DELETE FROM comment_likes WHERE user_id = ? AND comment_id = ?",
        [user_id, id]
    )
    
    await db.execute(
        "UPDATE comments SET like_count = MAX(0, like_count - 1) WHERE id = ?",
        [id]
    )
    
    comment = await db.first("SELECT like_count FROM comments WHERE id = ?", [id])
    like_count = comment["like_count"] if comment else 0

    return {"code": 200, "msg": "取消点赞成功", "data": {"like_count": like_count}}
