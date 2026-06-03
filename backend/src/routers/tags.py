"""标签路由"""
from fastapi import APIRouter, Request, HTTPException
from ..database import db

router = APIRouter(prefix="/tags", tags=["标签"])


@router.get("")
async def get_tags() -> dict:
    """获取标签列表"""
    tags = await db.select(
        """
        SELECT t.*, COUNT(p.id) as post_count
        FROM tags t
        LEFT JOIN post_tags pt ON pt.tag_id = t.id
        LEFT JOIN posts p ON p.id = pt.post_id AND p.is_public = 1 AND p.deleted_at IS NULL
        GROUP BY t.id
        ORDER BY t.id
        """
    )
    return {"code": 200, "data": tags}


@router.post("")
async def create_tag(request: Request) -> dict:
    """创建标签"""
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="未登录")

    body = await request.json()
    name = body.get("name")
    slug = body.get("slug")

    if not name or not slug:
        raise HTTPException(status_code=400, detail="缺少必要参数")

    # 检查 name/slug 唯一
    existing = await db.first(
        "SELECT id FROM tags WHERE name = ? OR slug = ?", [name, slug]
    )
    if existing:
        raise HTTPException(status_code=400, detail="名称或slug已存在")

    result = await db.execute(
        "INSERT INTO tags (name, slug) VALUES (?, ?)",
        [name, slug],
    )

    return {"code": 200, "msg": "创建成功", "data": {"id": result.get("last_row_id")}}


@router.get("/hot")
async def get_hot_tags(limit: int = 10) -> dict:
    """获取热门标签（按文章数量排序）"""
    tags = await db.select(
        """
        SELECT t.*, COUNT(pt.post_id) as post_count
        FROM tags t
        LEFT JOIN post_tags pt ON pt.tag_id = t.id
        LEFT JOIN posts p ON p.id = pt.post_id AND p.is_public = 1
        GROUP BY t.id
        ORDER BY post_count DESC, t.id
        LIMIT ?
        """,
        [limit],
    )
    return {"code": 200, "data": tags}


@router.get("/{slug_or_id}")
async def get_tag(slug_or_id: str) -> dict:
    """获取单个标签"""
    if slug_or_id.isdigit():
        where = "t.id = ?"
        params = [int(slug_or_id)]
    else:
        where = "t.slug = ?"
        params = [slug_or_id]

    tag = await db.first(
        f"""
        SELECT t.*, COUNT(p.id) as post_count
        FROM tags t
        LEFT JOIN post_tags pt ON pt.tag_id = t.id
        LEFT JOIN posts p ON p.id = pt.post_id AND p.is_public = 1 AND p.deleted_at IS NULL
        WHERE {where}
        GROUP BY t.id
        """,
        params,
    )
    if not tag:
        raise HTTPException(status_code=404, detail="标签不存在")

    return {"code": 200, "data": tag}
