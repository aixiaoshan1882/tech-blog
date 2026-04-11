"""文件上传路由"""
import os
import uuid
import time
from pathlib import Path
from fastapi import APIRouter, Request, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from ..config import config
from .auth import require_admin

router = APIRouter(prefix="/api/upload", tags=["上传"])

# 允许的文件类型
ALLOWED_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/svg+xml": ".svg",
}

# 最大文件大小 5MB
MAX_FILE_SIZE = 5 * 1024 * 1024


def get_upload_dir() -> Path:
    """获取上传目录"""
    upload_dir = Path(config.get("UPLOAD_DIR", "uploads"))
    upload_dir.mkdir(parents=True, exist_ok=True)
    return upload_dir


def get_image_dir() -> Path:
    """获取图片目录"""
    image_dir = get_upload_dir() / "images"
    image_dir.mkdir(parents=True, exist_ok=True)
    return image_dir


@router.post("/image")
async def upload_image(
    request: Request,
    file: UploadFile = File(...)
) -> dict:
    """上传图片"""
    # 验证管理员权限
    await require_admin(request)

    # 验证文件类型
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"不支持的文件类型: {file.content_type}，支持的类型: {', '.join(ALLOWED_IMAGE_TYPES.keys())}"
        )

    # 读取文件内容
    content = await file.read()

    # 验证文件大小
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"文件大小超过限制，最大 {MAX_FILE_SIZE // (1024 * 1024)}MB"
        )

    # 生成唯一文件名
    ext = ALLOWED_IMAGE_TYPES[file.content_type]
    filename = f"{int(time.time())}_{uuid.uuid4().hex[:8]}{ext}"
    
    # 按年月分目录存储
    date_dir = time.strftime("%Y/%m")
    full_dir = get_image_dir() / date_dir
    full_dir.mkdir(parents=True, exist_ok=True)
    
    file_path = full_dir / filename

    # 写入文件
    with open(file_path, "wb") as f:
        f.write(content)

    # 返回访问 URL
    base_url = str(request.base_url).rstrip("/")
    url = f"{base_url}/uploads/images/{date_dir}/{filename}"

    return {
        "code": 200,
        "msg": "上传成功",
        "data": {
            "url": url,
            "filename": filename,
            "size": len(content),
            "content_type": file.content_type,
        }
    }


@router.post("/images")
async def upload_multiple_images(
    request: Request,
    files: list[UploadFile] = File(...)
) -> dict:
    """批量上传图片"""
    # 验证管理员权限
    await require_admin(request)

    if len(files) > 10:
        raise HTTPException(status_code=400, detail="一次最多上传 10 个文件")

    results = []
    errors = []

    for i, file in enumerate(files):
        try:
            # 验证文件类型
            if file.content_type not in ALLOWED_IMAGE_TYPES:
                errors.append({"index": i, "filename": file.filename, "error": "不支持的文件类型"})
                continue

            # 读取文件内容
            content = await file.read()

            # 验证文件大小
            if len(content) > MAX_FILE_SIZE:
                errors.append({"index": i, "filename": file.filename, "error": "文件过大"})
                continue

            # 生成唯一文件名
            ext = ALLOWED_IMAGE_TYPES[file.content_type]
            filename = f"{int(time.time())}_{uuid.uuid4().hex[:8]}{ext}"
            
            # 按年月分目录存储
            date_dir = time.strftime("%Y/%m")
            full_dir = get_image_dir() / date_dir
            full_dir.mkdir(parents=True, exist_ok=True)
            
            file_path = full_dir / filename

            # 写入文件
            with open(file_path, "wb") as f:
                f.write(content)

            # 返回访问 URL
            base_url = str(request.base_url).rstrip("/")
            url = f"{base_url}/uploads/images/{date_dir}/{filename}"

            results.append({
                "url": url,
                "filename": filename,
                "size": len(content),
            })
        except Exception as e:
            errors.append({"index": i, "filename": file.filename, "error": str(e)})

    return {
        "code": 200,
        "msg": f"成功 {len(results)} 个，失败 {len(errors)} 个",
        "data": {
            "success": results,
            "errors": errors,
        }
    }


@router.get("/images/{year}/{month}/{filename}")
async def get_image(year: str, month: str, filename: str) -> FileResponse:
    """获取上传的图片"""
    # 安全检查：防止路径遍历
    if ".." in year or ".." in month or ".." in filename:
        raise HTTPException(status_code=403, detail="非法路径")

    file_path = get_image_dir() / year / month / filename

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="文件不存在")

    # 根据扩展名确定 content-type
    content_types = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".svg": "image/svg+xml",
    }
    ext = Path(filename).suffix.lower()
    content_type = content_types.get(ext, "application/octet-stream")

    return FileResponse(
        path=file_path,
        media_type=content_type,
        headers={"Cache-Control": "public, max-age=31536000"}
    )


@router.delete("/image")
async def delete_image(
    request: Request,
    url: str = Form(...)
) -> dict:
    """删除图片"""
    # 验证管理员权限
    await require_admin(request)

    # 解析 URL 获取文件路径
    try:
        # url 格式: /uploads/images/2024/01/filename.jpg
        parts = url.split("/uploads/images/")
        if len(parts) != 2:
            raise HTTPException(status_code=400, detail="无效的图片URL")

        file_rel_path = parts[1]
        file_path = get_image_dir() / file_rel_path

        # 安全检查
        if ".." in file_rel_path:
            raise HTTPException(status_code=403, detail="非法路径")

        if not file_path.exists():
            raise HTTPException(status_code=404, detail="文件不存在")

        # 删除文件
        file_path.unlink()

        return {"code": 200, "msg": "删除成功"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"删除失败: {str(e)}")
