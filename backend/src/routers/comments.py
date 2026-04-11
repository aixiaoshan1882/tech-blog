"""评论路由"""
from fastapi import APIRouter, Request, HTTPException, Query
from ..database import db

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
    post = await db.first("SELECT id FROM posts WHERE slug = ?", [slug])
    if not post:
        raise HTTPException(status_code=404, detail="文章不存在")

    post_id = post["id"]

    body = await request.json()
    nickname = body.get("nickname")
    content = body.get("content")
    parent_id = body.get("parent_id", 0)
    email = body.get("email")

    if not nickname or not content:
        raise HTTPException(status_code=400, detail="缺少必要参数")

    result = await db.execute(
        "INSERT INTO comments (post_id, parent_id, nickname, email, content) VALUES (?, ?, ?, ?, ?)",
        [post_id, parent_id, nickname, email, content],
    )

    return {"code": 200, "msg": "评论成功", "data": {"id": result.get("last_row_id")}}


@router.delete("/{id}")
async def delete_comment(request: Request, id: int) -> dict:
    """删除评论"""
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="未登录")

    await db.execute("DELETE FROM comments WHERE id = ?", [id])

    return {"code": 200, "msg": "删除成功"}