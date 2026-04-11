"""分类路由"""
from fastapi import APIRouter, Request, HTTPException, Query
from ..database import db

router = APIRouter(prefix="/categories", tags=["分类"])


@router.get("")
async def get_categories() -> dict:
    """获取分类列表"""
    categories = await db.select("SELECT * FROM categories ORDER BY id")

    # 构建树形结构
    category_map = {c["id"]: {**c, "children": []} for c in categories}
    roots = []

    for cat in categories:
        if cat["parent_id"] == 0:
            roots.append(category_map[cat["id"]])
        elif cat["parent_id"] in category_map:
            category_map[cat["parent_id"]]["children"].append(category_map[cat["id"]])

    return {"code": 200, "data": roots}


@router.post("")
async def create_category(request: Request) -> dict:
    """创建分类"""
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="未登录")

    body = await request.json()
    name = body.get("name")
    slug = body.get("slug")
    parent_id = body.get("parent_id", 0)

    if not name or not slug:
        raise HTTPException(status_code=400, detail="缺少必要参数")

    # 检查 slug 唯一
    existing = await db.first("SELECT id FROM categories WHERE slug = ?", [slug])
    if existing:
        raise HTTPException(status_code=400, detail="slug 已存在")

    result = await db.execute(
        "INSERT INTO categories (name, slug, parent_id) VALUES (?, ?, ?)",
        [name, slug, parent_id],
    )

    return {"code": 200, "msg": "创建成功", "data": {"id": result.get("last_row_id")}}


@router.delete("/{id}")
async def delete_category(request: Request, id: int) -> dict:
    """删除分类"""
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="未登录")

    # 检查是否有文章
    count = await db.first("SELECT COUNT(*) as count FROM posts WHERE category_id = ?", [id])
    if count and count["count"] > 0:
        raise HTTPException(status_code=400, detail="分类下有文章，无法删除")

    await db.execute("DELETE FROM categories WHERE id = ?", [id])

    return {"code": 200, "msg": "删除成功"}