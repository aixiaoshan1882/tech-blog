-- Tech Blog D1 数据库 Schema
-- 创建日期: 2026-04-10

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    nickname TEXT NOT NULL,
    avatar TEXT,
    role TEXT DEFAULT 'reader',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 分类表
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    parent_id INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 标签表
CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 文章表
CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    content TEXT NOT NULL,
    excerpt TEXT,
    cover TEXT,
    category_id INTEGER,
    is_public INTEGER DEFAULT 1,
    view_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- 文章-标签关联表
CREATE TABLE IF NOT EXISTS post_tags (
    post_id INTEGER,
    tag_id INTEGER,
    PRIMARY KEY (post_id, tag_id),
    FOREIGN KEY (post_id) REFERENCES posts(id),
    FOREIGN KEY (tag_id) REFERENCES tags(id)
);

-- 评论表
CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    user_id INTEGER,
    content TEXT NOT NULL,
    parent_id INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category_id);
CREATE INDEX IF NOT EXISTS idx_posts_public ON posts(is_public);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at);
CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_post_tags_post ON post_tags(post_id);
CREATE INDEX IF NOT EXISTS idx_post_tags_tag ON post_tags(tag_id);

-- 插入示例数据

-- 分类
INSERT INTO categories (name, slug, description) VALUES
    ('前端开发', 'frontend', '前端技术文章'),
    ('后端开发', 'backend', '后端技术文章'),
    ('DevOps', 'devops', '运维和部署');

-- 标签
INSERT INTO tags (name, slug) VALUES
    ('JavaScript', 'javascript'),
    ('TypeScript', 'typescript'),
    ('Python', 'python'),
    ('React', 'react'),
    ('Vue', 'vue'),
    ('Node.js', 'nodejs'),
    ('Docker', 'docker'),
    ('Git', 'git');

-- 文章
INSERT INTO posts (title, slug, content, excerpt, category_id, is_public, view_count) VALUES
    ('TypeScript 5.0 高级特性详解', 'typescript-50-advanced', 
     '# TypeScript 5.0 高级特性\n\nTypeScript 5.0 带来了许多新特性，包括装饰器、const 类型参数等。\n\n## 装饰器\n\n装饰器是一种实验性功能，现在已经稳定...',
     'TypeScript 5.0 带来了许多新特性，包括装饰器、const 类型参数等', 1, 1, 100),
    ('React Server Components 深入理解', 'react-server-components',
     '# React Server Components\n\nRSC 是 React 18 的重要特性，它允许你在服务器上渲染组件...',
     '探索 React Server Components 的原理和使用方法', 1, 1, 80),
    ('Node.js 性能优化实战', 'nodejs-performance',
     '# Node.js 性能优化\n\n本文介绍如何优化 Node.js 应用性能。',
     '从原理到实践，全面提升 Node.js 应用性能', 2, 1, 60);

-- 文章标签关联
INSERT INTO post_tags (post_id, tag_id) VALUES
    (1, 1), (1, 2),
    (2, 1), (2, 4),
    (3, 3), (3, 6);
