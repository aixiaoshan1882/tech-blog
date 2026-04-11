"""数据验证模型"""
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime


# ============ 用户 Schema ============


class UserCreate(BaseModel):
    """用户注册请求"""
    email: EmailStr
    password: str = Field(..., min_length=6)
    nickname: str = Field(..., min_length=2, max_length=20)


class UserLogin(BaseModel):
    """用户登录请求"""
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    """用户响应"""
    id: int
    email: str
    nickname: str
    created_at: str

    model_config = {'from_attributes': True}
# ============ 文章 Schema ============


class PostCreate(BaseModel):
    """创建文章请求"""
    title: str = Field(..., min_length=1)
    slug: str = Field(..., min_length=1)
    content: str = Field(..., min_length=1)
    excerpt: Optional[str] = None
    cover: Optional[str] = None
    category_id: Optional[int] = None
    tag_ids: Optional[List[int]] = None
    is_public: int = 1


class PostUpdate(BaseModel):
    """更新文章请求"""
    title: Optional[str] = None
    slug: Optional[str] = None
    content: Optional[str] = None
    excerpt: Optional[str] = None
    cover: Optional[str] = None
    category_id: Optional[int] = None
    tag_ids: Optional[List[int]] = None
    is_public: Optional[int] = None


class PostResponse(BaseModel):
    """文章响应"""
    id: int
    title: str
    slug: str
    content: str
    excerpt: Optional[str]
    cover: Optional[str]
    category_id: Optional[int]
    is_public: int
    view_count: int
    created_at: str
    updated_at: str
    category_name: Optional[str] = None
    category_slug: Optional[str] = None
    tags: List[dict] = []

    model_config = {'from_attributes': True}
class PostListResponse(BaseModel):
    """文章列表响应"""
    items: List[PostResponse]
    total: int
    page: int
    limit: int


# ============ 分类 Schema ============


class CategoryCreate(BaseModel):
    """创建分类请求"""
    name: str = Field(..., min_length=1)
    slug: str = Field(..., min_length=1)
    parent_id: int = 0


class CategoryResponse(BaseModel):
    """分类响应"""
    id: int
    name: str
    slug: str
    parent_id: int
    created_at: str
    children: List["CategoryResponse"] = []

    model_config = {'from_attributes': True}
# 更新前向引用
CategoryResponse.model_rebuild()


# ============ 标签 Schema ============


class TagCreate(BaseModel):
    """创建标签请求"""
    name: str = Field(..., min_length=1)
    slug: str = Field(..., min_length=1)


class TagResponse(BaseModel):
    """标签响应"""
    id: int
    name: str
    slug: str

    model_config = {'from_attributes': True}
# ============ 评论 Schema ============


class CommentCreate(BaseModel):
    """发表评论请求"""
    nickname: str = Field(..., min_length=1)
    email: Optional[EmailStr] = None
    content: str = Field(..., min_length=1)
    parent_id: int = 0


class CommentResponse(BaseModel):
    """评论响应"""
    id: int
    post_id: int
    parent_id: int
    nickname: str
    email: Optional[str]
    content: str
    created_at: str
    children: List["CommentResponse"] = []

    model_config = {'from_attributes': True}
CommentResponse.model_rebuild()


# ============ 通用响应 ============


class ApiResponse(BaseModel):
    """通用响应"""
    code: int = 200
    msg: str = "success"
    data: Optional[dict] = None


class PaginatedResponse(BaseModel):
    """分页响应"""
    items: List
    total: int
    page: int
    limit: int