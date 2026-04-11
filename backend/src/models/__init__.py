from dataclasses import dataclass
from typing import Optional


@dataclass
class User:
    id: int
    email: str
    password: str
    nickname: str
    created_at: str = ""


@dataclass
class Post:
    id: int
    title: str
    slug: str
    content: str
    excerpt: Optional[str] = None
    cover: Optional[str] = None
    category_id: Optional[int] = None
    is_public: int = 1
    view_count: int = 0
    created_at: str = ""
    updated_at: str = ""


@dataclass
class Category:
    id: int
    name: str
    slug: str
    parent_id: int = 0
    created_at: str = ""


@dataclass
class Tag:
    id: int
    name: str
    slug: str


@dataclass
class Comment:
    id: int
    post_id: int
    parent_id: int = 0
    nickname: str = ""
    email: str = ""
    content: str = ""
    created_at: str = ""