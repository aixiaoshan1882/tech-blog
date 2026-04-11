"""RSS Feed 路由"""
from fastapi import APIRouter, Request
from fastapi.responses import Response
from ..database import db
from datetime import datetime

router = APIRouter(tags=["Feed"])


def escape_xml(text: str) -> str:
    """转义 XML 特殊字符"""
    if not text:
        return ""
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&apos;")
    )


@router.get("/feed.xml")
async def get_rss_feed(request: Request) -> Response:
    """获取 RSS 2.0 订阅源"""
    # 获取最新文章
    posts = await db.select(
        """
        SELECT p.*, c.name as category_name
        FROM posts p
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.is_public = 1 AND p.deleted_at IS NULL
        ORDER BY p.created_at DESC
        LIMIT 20
        """,
        [],
    )

    # 获取网站信息
    site_url = str(request.base_url).rstrip("/")
    blog_title = "技术笔记博客"
    blog_description = "分享技术心得与实战经验"

    # 生成 RSS XML
    items_xml = ""
    for post in posts:
        post_url = f"{site_url}/post/{post['slug']}"
        pub_date = datetime.fromisoformat(post["created_at"]).strftime("%a, %d %b %Y %H:%M:%S GMT")
        
        # 处理内容（截取摘要）
        content = post.get("excerpt") or post.get("content", "")[:200]
        if len(content) < len(post.get("content", "")):
            content += "..."
        
        items_xml += f"""
        <item>
            <title>{escape_xml(post['title'])}</title>
            <link>{post_url}</link>
            <guid isPermaLink="true">{post_url}</guid>
            <description>{escape_xml(content)}</description>
            <pubDate>{pub_date}</pubDate>
            <category>{escape_xml(post.get('category_name') or '未分类')}</category>
            <author>admin@example.com ({escape_xml(post.get('author_nickname') or 'Admin')})</author>
        </item>"""

    rss_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
    <channel>
        <title>{escape_xml(blog_title)}</title>
        <link>{site_url}</link>
        <description>{escape_xml(blog_description)}</description>
        <language>zh-CN</language>
        <lastBuildDate>{datetime.now().strftime("%a, %d %b %Y %H:%M:%S GMT")}</lastBuildDate>
        <atom:link href="{site_url}/feed.xml" rel="self" type="application/rss+xml"/>
        <generator>TechBlog RSS Generator</generator>
        {items_xml}
    </channel>
</rss>"""

    return Response(
        content=rss_xml,
        media_type="application/xml; charset=utf-8",
        headers={"Cache-Control": "max-age=3600"},
    )


@router.get("/atom.xml")
async def get_atom_feed(request: Request) -> Response:
    """获取 Atom 1.0 订阅源"""
    posts = await db.select(
        """
        SELECT p.*, c.name as category_name
        FROM posts p
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.is_public = 1 AND p.deleted_at IS NULL
        ORDER BY p.created_at DESC
        LIMIT 20
        """,
        [],
    )

    site_url = str(request.base_url).rstrip("/")
    blog_title = "技术笔记博客"
    blog_description = "分享技术心得与实战经验"
    updated = datetime.now().strftime("%Y-%m-%dT%H:%M:%S+08:00")

    entries_xml = ""
    for post in posts:
        post_url = f"{site_url}/post/{post['slug']}"
        pub_date = datetime.fromisoformat(post["created_at"]).strftime("%Y-%m-%dT%H:%M:%S+08:00")
        
        content = post.get("excerpt") or post.get("content", "")[:200]
        
        entries_xml += f"""
        <entry>
            <title>{escape_xml(post['title'])}</title>
            <link href="{post_url}" rel="alternate"/>
            <id>{post_url}</id>
            <updated>{pub_date}</updated>
            <summary>{escape_xml(content)}</summary>
            <category term="{escape_xml(post.get('category_name') or '未分类')}"/>
        </entry>"""

    atom_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
    <title>{escape_xml(blog_title)}</title>
    <subtitle>{escape_xml(blog_description)}</subtitle>
    <link href="{site_url}/atom.xml" rel="self"/>
    <link href="{site_url}" rel="alternate"/>
    <id>{site_url}/</id>
    <updated>{updated}</updated>
    <generator>TechBlog Atom Generator</generator>
    {entries_xml}
</feed>"""

    return Response(
        content=atom_xml,
        media_type="application/xml; charset=utf-8",
        headers={"Cache-Control": "max-age=3600"},
    )


@router.get("/sitemap.xml")
async def get_sitemap(request: Request) -> Response:
    """获取站点地图"""
    # 获取所有公开文章
    posts = await db.select(
        """
        SELECT slug, updated_at
        FROM posts
        WHERE is_public = 1 AND deleted_at IS NULL
        ORDER BY updated_at DESC
        LIMIT 1000
        """,
        [],
    )

    # 获取所有分类
    categories = await db.select(
        "SELECT slug, updated_at FROM categories ORDER BY name",
        [],
    )

    # 获取所有标签
    tags = await db.select(
        "SELECT slug, updated_at FROM tags ORDER BY name",
        [],
    )

    site_url = str(request.base_url).rstrip("/")
    now = datetime.now().strftime("%Y-%m-%dT%H:%M:%S+08:00")

    urls_xml = f"""
    <url>
        <loc>{site_url}/</loc>
        <lastmod>{now}</lastmod>
        <changefreq>daily</changefreq>
        <priority>1.0</priority>
    </url>"""

    # 添加分类页面
    for cat in categories:
        cat_date = datetime.fromisoformat(cat["updated_at"]).strftime("%Y-%m-%dT%H:%M:%S+08:00") if cat.get("updated_at") else now
        urls_xml += f"""
    <url>
        <loc>{site_url}/category/{cat['slug']}</loc>
        <lastmod>{cat_date}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.8</priority>
    </url>"""

    # 添加标签页面
    for tag in tags:
        tag_date = datetime.fromisoformat(tag["updated_at"]).strftime("%Y-%m-%dT%H:%M:%S+08:00") if tag.get("updated_at") else now
        urls_xml += f"""
    <url>
        <loc>{site_url}/tag/{tag['slug']}</loc>
        <lastmod>{tag_date}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.6</priority>
    </url>"""

    # 添加文章页面
    for post in posts:
        post_date = datetime.fromisoformat(post["updated_at"]).strftime("%Y-%m-%dT%H:%M:%S+08:00") if post.get("updated_at") else now
        urls_xml += f"""
    <url>
        <loc>{site_url}/post/{post['slug']}</loc>
        <lastmod>{post_date}</lastmod>
        <changefreq>monthly</changefreq>
        <priority>0.9</priority>
    </url>"""

    sitemap_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    {urls_xml}
</urlset>"""

    return Response(
        content=sitemap_xml,
        media_type="application/xml; charset=utf-8",
        headers={"Cache-Control": "max-age=86400"},
    )
