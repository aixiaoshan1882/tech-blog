"""分类路由"""
from fastapi import APIRouter, Request, HTTPException, Query
from ..database import db
from .auth import require_admin
from ..utils.sanitize import sanitize_html

router = APIRouter(prefix="/categories", tags=["分类"])


@router.get("")
async def get_categories() -> dict:
    """获取分类列表"""
    categories = await db.select(
        """
        SELECT c.*, COUNT(p.id) as post_count
        FROM categories c
        LEFT JOIN posts p ON p.category_id = c.id AND p.is_public = 1 AND p.deleted_at IS NULL
        GROUP BY c.id
        ORDER BY c.id
        """
    )

    # 构建树形结构
    category_map = {c["id"]: {**c, "children": []} for c in categories}
    roots = []

    for cat in categories:
        if cat["parent_id"] == 0:
            roots.append(category_map[cat["id"]])
        elif cat["parent_id"] in category_map:
            category_map[cat["parent_id"]]["children"].append(category_map[cat["id"]])

    return {"code": 200, "data": roots}


@router.get("/{slug_or_id}")
async def get_category(slug_or_id: str) -> dict:
    """获取单个分类"""
    if slug_or_id.isdigit():
        where = "c.id = ?"
        params = [int(slug_or_id)]
    else:
        where = "c.slug = ?"
        params = [slug_or_id]

    category = await db.first(
        f"""
        SELECT c.*, COUNT(p.id) as post_count
        FROM categories c
        LEFT JOIN posts p ON p.category_id = c.id AND p.is_public = 1 AND p.deleted_at IS NULL
        WHERE {where}
        GROUP BY c.id
        """,
        params,
    )
    if not category:
        raise HTTPException(status_code=404, detail="分类不存在")

    return {"code": 200, "data": category}


@router.post("")
async def create_category(request: Request) -> dict:
    """创建分类"""
    await require_admin(request)

    body = await request.json()
    name = body.get("name")
    slug = body.get("slug")
    description = body.get("description")
    parent_id = body.get("parent_id", 0)

    if not name or not slug:
        raise HTTPException(status_code=400, detail="缺少必要参数")

    name = sanitize_html(str(name).strip())[:100]
    slug = sanitize_html(str(slug).strip())[:100]
    description = sanitize_html(str(description).strip())[:500] if description else None

    # 检查 slug 唯一
    existing = await db.first("SELECT id FROM categories WHERE slug = ?", [slug])
    if existing:
        raise HTTPException(status_code=400, detail="slug 已存在")

    result = await db.execute(
        "INSERT INTO categories (name, slug, description, parent_id) VALUES (?, ?, ?, ?)",
        [name, slug, description, parent_id],
    )

    return {"code": 200, "msg": "创建成功", "data": {"id": result.get("last_row_id")}}


@router.put("/{id}")
async def update_category(request: Request, id: int) -> dict:
    """更新分类"""
    await require_admin(request)

    body = await request.json()
    name = body.get("name")
    slug = body.get("slug")
    description = body.get("description")
    parent_id = body.get("parent_id", 0)

    if not name or not slug:
        raise HTTPException(status_code=400, detail="缺少必要参数")

    if parent_id == id:
        raise HTTPException(status_code=400, detail="父分类不能是自身")

    existing_category = await db.first("SELECT id FROM categories WHERE id = ?", [id])
    if not existing_category:
        raise HTTPException(status_code=404, detail="分类不存在")

    name = sanitize_html(str(name).strip())[:100]
    slug = sanitize_html(str(slug).strip())[:100]
    description = sanitize_html(str(description).strip())[:500] if description else None

    existing_slug = await db.first(
        "SELECT id FROM categories WHERE slug = ? AND id != ?",
        [slug, id],
    )
    if existing_slug:
        raise HTTPException(status_code=400, detail="slug 已存在")

    await db.execute(
        """
        UPDATE categories
        SET name = ?, slug = ?, description = ?, parent_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        """,
        [name, slug, description, parent_id, id],
    )

    return {"code": 200, "msg": "更新成功"}


@router.delete("/{id}")
async def delete_category(request: Request, id: int) -> dict:
    """删除分类"""
    await require_admin(request)

    # 检查是否有文章
    count = await db.first("SELECT COUNT(*) as count FROM posts WHERE category_id = ?", [id])
    if count and count["count"] > 0:
        raise HTTPException(status_code=400, detail="分类下有文章，无法删除")

    await db.execute("DELETE FROM categories WHERE id = ?", [id])

    return {"code": 200, "msg": "删除成功"}
