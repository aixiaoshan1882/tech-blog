"""评论路由"""
from fastapi import APIRouter, Request, HTTPException, Query
from ..database import db
from ..utils.sanitize import sanitize_html
from .auth import require_admin, get_user_by_id

router = APIRouter(prefix="/comments", tags=["评论"])


@router.get("")
async def get_all_comments(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> dict:
    """获取所有评论（管理后台用）"""
    offset = (page - 1) * page_size
    
    # 查询评论及其关联文章
    comments = await db.select(
        """
        SELECT c.*, p.title as post_title, p.slug as post_slug
        FROM comments c
        LEFT JOIN posts p ON c.post_id = p.id
        ORDER BY c.created_at DESC
        LIMIT ? OFFSET ?
        """,
        [page_size, offset],
    )
    
    # 获取总数
    total_result = await db.first("SELECT COUNT(*) as count FROM comments")
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

    post_id = post["id"]
    post_title = post["title"]
    post_author_id = post.get("user_id")

    body = await request.json()
    nickname = body.get("nickname")
    content = body.get("content")
    parent_id = body.get("parent_id", 0)
    email = body.get("email")

    if not nickname or not content:
        raise HTTPException(status_code=400, detail="缺少必要参数")

    # XSS 防护 - 清理用户输入
    nickname = sanitize_html(nickname)[:50]
    content = sanitize_html(content)[:2000]
    email = sanitize_html(email)[:100] if email else None

    result = await db.execute(
        "INSERT INTO comments (post_id, parent_id, nickname, email, content) VALUES (?, ?, ?, ?, ?)",
        [post_id, parent_id, nickname, email, content],
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
