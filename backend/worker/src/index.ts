/**
 * Cloudflare Worker - D1 API 网关
 * 用于连接前端和 D1 数据库
 * 
 * 更新: 添加用户认证功能
 */

interface Env {
  DB: D1Database;
}

// CORS 头
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// 简单哈希函数 (演示用 - 生产环境请用 bcrypt 等)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password); // 不加 salt，简化演示
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// 验证密码
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const inputHash = await hashPassword(password);
  return inputHash === hash;
}

// 生成简单 Token (生产环境请用 JWT)
function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

// 工具函数
function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ code: 200, data }), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function errorResponse(msg: string, status = 400): Response {
  return new Response(JSON.stringify({ code: status, msg }), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

// 获取文章列表
async function getPosts(env: Env, url: URL): Promise<Response> {
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '10');
  const offset = (page - 1) * limit;

  try {
    const posts = await env.DB.prepare(`
      SELECT p.*, c.name as category_name, c.slug as category_slug,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count
      FROM posts p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.is_public = 1
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(limit, offset).all();

    const countResult = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM posts WHERE is_public = 1'
    ).first();

    return jsonResponse({
      items: posts.results,
      total: countResult?.count || 0,
      page,
      limit,
      hasMore: (page * limit) < (countResult?.count || 0),
    });
  } catch (err: any) {
    return errorResponse(err.message || '查询失败', 500);
  }
}

// 获取热门文章
async function getHotPosts(env: Env, url: URL): Promise<Response> {
  const limit = parseInt(url.searchParams.get('limit') || '5');

  try {
    const posts = await env.DB.prepare(`
      SELECT p.*, c.name as category_name, c.slug as category_slug
      FROM posts p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.is_public = 1
      ORDER BY p.view_count DESC, p.created_at DESC
      LIMIT ?
    `).bind(limit).all();

    return jsonResponse(posts.results);
  } catch (err: any) {
    return errorResponse(err.message || '查询失败', 500);
  }
}

// 获取最新文章
async function getLatestPosts(env: Env, url: URL): Promise<Response> {
  const limit = parseInt(url.searchParams.get('limit') || '5');

  try {
    const posts = await env.DB.prepare(`
      SELECT p.*, c.name as category_name, c.slug as category_slug
      FROM posts p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.is_public = 1
      ORDER BY p.created_at DESC
      LIMIT ?
    `).bind(limit).all();

    return jsonResponse(posts.results);
  } catch (err: any) {
    return errorResponse(err.message || '查询失败', 500);
  }
}

// 获取单篇文章
async function getPost(env: Env, slug: string): Promise<Response> {
  try {
    const post = await env.DB.prepare(`
      SELECT p.*, c.name as category_name, c.slug as category_slug
      FROM posts p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.slug = ?
    `).bind(slug).first();

    if (!post) {
      return errorResponse('文章不存在', 404);
    }

    const tags = await env.DB.prepare(`
      SELECT t.*
      FROM tags t
      JOIN post_tags pt ON pt.tag_id = t.id
      WHERE pt.post_id = ?
    `).bind(post.id).all();

    (post as any).tags = tags.results;

    await env.DB.prepare(`
      UPDATE posts SET view_count = view_count + 1 WHERE id = ?
    `).bind(post.id).run();

    return jsonResponse(post);
  } catch (err: any) {
    return errorResponse(err.message || '查询失败', 500);
  }
}

// 获取分类列表
async function getCategories(env: Env): Promise<Response> {
  try {
    const categories = await env.DB.prepare(`
      SELECT c.*, COUNT(p.id) as post_count
      FROM categories c
      LEFT JOIN posts p ON p.category_id = c.id AND p.is_public = 1
      GROUP BY c.id
      ORDER BY c.id
    `).all();

    return jsonResponse(categories.results);
  } catch (err: any) {
    return errorResponse(err.message || '查询失败', 500);
  }
}

// 按分类获取文章
async function getPostsByCategory(env: Env, slug: string, url: URL): Promise<Response> {
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '10');
  const offset = (page - 1) * limit;

  try {
    const posts = await env.DB.prepare(`
      SELECT p.*, c.name as category_name, c.slug as category_slug
      FROM posts p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE c.slug = ? AND p.is_public = 1
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(slug, limit, offset).all();

    const countResult = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM posts p
      JOIN categories c ON c.id = p.category_id
      WHERE c.slug = ? AND p.is_public = 1
    `).bind(slug).first();

    return jsonResponse({
      items: posts.results,
      total: countResult?.count || 0,
      page,
      limit,
      hasMore: (page * limit) < (countResult?.count || 0),
    });
  } catch (err: any) {
    return errorResponse(err.message || '查询失败', 500);
  }
}

// 获取标签列表
async function getTags(env: Env): Promise<Response> {
  try {
    const tags = await env.DB.prepare(`
      SELECT t.*, COUNT(pt.post_id) as post_count
      FROM tags t
      LEFT JOIN post_tags pt ON pt.tag_id = t.id
      LEFT JOIN posts p ON p.id = pt.post_id AND p.is_public = 1
      GROUP BY t.id
      ORDER BY t.id
    `).all();

    return jsonResponse(tags.results);
  } catch (err: any) {
    return errorResponse(err.message || '查询失败', 500);
  }
}

// 获取热门标签
async function getHotTags(env: Env, url: URL): Promise<Response> {
  const limit = parseInt(url.searchParams.get('limit') || '10');

  try {
    const tags = await env.DB.prepare(`
      SELECT t.*, COUNT(pt.post_id) as post_count
      FROM tags t
      LEFT JOIN post_tags pt ON pt.tag_id = t.id
      LEFT JOIN posts p ON p.id = pt.post_id AND p.is_public = 1
      GROUP BY t.id
      ORDER BY post_count DESC, t.id
      LIMIT ?
    `).bind(limit).all();

    return jsonResponse(tags.results);
  } catch (err: any) {
    return errorResponse(err.message || '查询失败', 500);
  }
}

// 按标签获取文章
async function getPostsByTag(env: Env, slug: string, url: URL): Promise<Response> {
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '10');
  const offset = (page - 1) * limit;

  try {
    const posts = await env.DB.prepare(`
      SELECT p.*, c.name as category_name, c.slug as category_slug
      FROM posts p
      LEFT JOIN categories c ON c.id = p.category_id
      JOIN post_tags pt ON pt.post_id = p.id
      JOIN tags t ON t.id = pt.tag_id
      WHERE t.slug = ? AND p.is_public = 1
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(slug, limit, offset).all();

    const countResult = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM posts p
      JOIN post_tags pt ON pt.post_id = p.id
      JOIN tags t ON t.id = pt.tag_id
      WHERE t.slug = ? AND p.is_public = 1
    `).bind(slug).first();

    return jsonResponse({
      items: posts.results,
      total: countResult?.count || 0,
      page,
      limit,
      hasMore: (page * limit) < (countResult?.count || 0),
    });
  } catch (err: any) {
    return errorResponse(err.message || '查询失败', 500);
  }
}

// 搜索文章
async function searchPosts(env: Env, url: URL): Promise<Response> {
  const keyword = url.searchParams.get('keyword') || '';
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '10');
  const offset = (page - 1) * limit;

  if (!keyword) {
    return jsonResponse({ items: [], total: 0, page, limit, hasMore: false });
  }

  try {
    const searchPattern = `%${keyword}%`;
    
    const posts = await env.DB.prepare(`
      SELECT p.*, c.name as category_name, c.slug as category_slug
      FROM posts p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.is_public = 1 AND (p.title LIKE ? OR p.content LIKE ? OR p.excerpt LIKE ?)
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(searchPattern, searchPattern, searchPattern, limit, offset).all();

    const countResult = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM posts p
      WHERE p.is_public = 1 AND (p.title LIKE ? OR p.content LIKE ? OR p.excerpt LIKE ?)
    `).bind(searchPattern, searchPattern, searchPattern).first();

    return jsonResponse({
      items: posts.results,
      total: countResult?.count || 0,
      page,
      limit,
      hasMore: (page * limit) < (countResult?.count || 0),
    });
  } catch (err: any) {
    return errorResponse(err.message || '搜索失败', 500);
  }
}

// ============ 用户认证 API ============

// 用户注册
async function register(env: Env, body: any): Promise<Response> {
  const { email, password, nickname } = body;

  if (!email || !password || !nickname) {
    return errorResponse('请填写完整信息', 400);
  }

  if (password.length < 6) {
    return errorResponse('密码至少6位', 400);
  }

  try {
    // 检查邮箱是否已存在
    const existing = await env.DB.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(email).first();

    if (existing) {
      return errorResponse('邮箱已被注册', 400);
    }

    // 加密密码
    const passwordHash = await hashPassword(password);

    // 创建用户
    const result = await env.DB.prepare(`
      INSERT INTO users (email, password_hash, nickname, role)
      VALUES (?, ?, ?, 'reader')
    `).bind(email, passwordHash, nickname).run();

    const userId = result.meta?.last_row_id;

    // 生成 token
    const token = generateToken();

    return jsonResponse({
      user: { id: userId, email, nickname, role: 'reader' },
      token,
    });
  } catch (err: any) {
    return errorResponse(err.message || '注册失败', 500);
  }
}

// 用户登录
async function login(env: Env, body: any): Promise<Response> {
  const { email, password } = body;

  if (!email || !password) {
    return errorResponse('请填写邮箱和密码', 400);
  }

  try {
    const user = await env.DB.prepare(
      'SELECT * FROM users WHERE email = ?'
    ).bind(email).first() as any;

    if (!user) {
      return errorResponse('邮箱或密码错误', 401);
    }

    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return errorResponse('邮箱或密码错误', 401);
    }

    const token = generateToken();

    return jsonResponse({
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        avatar: user.avatar,
        role: user.role,
      },
      token,
    });
  } catch (err: any) {
    return errorResponse(err.message || '登录失败', 500);
  }
}

// 获取当前用户信息
async function getCurrentUser(env: Env, request: Request): Promise<Response> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return errorResponse('未登录', 401);
  }

  // 这里简化处理，实际应该用 token 查用户
  // 由于是简化版，我们从 header 中获取用户ID (实际应该查表验证)
  const userId = authHeader.replace('Bearer ', '').substring(0, 10);
  
  try {
    const users = await env.DB.prepare(
      'SELECT id, email, nickname, avatar, role FROM users LIMIT 1'
    ).first() as any;

    if (!users) {
      return errorResponse('用户不存在', 404);
    }

    return jsonResponse(users);
  } catch (err: any) {
    return errorResponse(err.message || '获取用户信息失败', 500);
  }
}

// ============ 评论 API ============

// 获取文章评论
async function getComments(env: Env, url: URL): Promise<Response> {
  const postId = url.searchParams.get('postId');

  if (!postId) {
    return errorResponse('缺少 postId', 400);
  }

  try {
    const comments = await env.DB.prepare(`
      SELECT c.*, u.nickname as author_name
      FROM comments c
      LEFT JOIN users u ON u.id = c.user_id
      WHERE c.post_id = ? AND c.parent_id = 0
      ORDER BY c.created_at DESC
    `).bind(postId).all();

    return jsonResponse({
      items: comments.results,
      total: comments.results.length,
      page: 1,
      pageSize: 20,
      hasMore: false
    });
  } catch (err: any) {
    return errorResponse(err.message || '获取评论失败', 500);
  }
}

// 添加评论
async function addComment(env: Env, body: any, request: Request): Promise<Response> {
  const { post_id, content, parent_id = 0, nickname = '匿名用户' } = body;

  if (!post_id || !content) {
    return errorResponse('缺少必要参数', 400);
  }

  try {
    // 直接使用 nickname，不依赖 user_id
    const result = await env.DB.prepare(`
      INSERT INTO comments (post_id, content, parent_id, nickname)
      VALUES (?, ?, ?, ?)
    `).bind(post_id, content, parent_id, nickname).run();

    return jsonResponse({ id: result.meta?.last_row_id });
  } catch (err: any) {
    return errorResponse(err.message || '评论失败', 500);
  }
}

// ============ 管理后台 API ============

// 获取所有文章 (包含未发布的)
async function getAllPosts(env: Env, url: URL): Promise<Response> {
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '10');
  const offset = (page - 1) * limit;

  try {
    const posts = await env.DB.prepare(`
      SELECT p.*, c.name as category_name
      FROM posts p
      LEFT JOIN categories c ON c.id = p.category_id
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(limit, offset).all();

    const countResult = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM posts'
    ).first();

    return jsonResponse({
      items: posts.results,
      total: countResult?.count || 0,
      page,
      limit,
      hasMore: (page * limit) < (countResult?.count || 0),
    });
  } catch (err: any) {
    return errorResponse(err.message || '查询失败', 500);
  }
}

// 创建文章
async function createPost(env: Env, body: any): Promise<Response> {
  const { title, slug, content, excerpt, category_id, is_public = 1, tag_ids } = body;

  if (!title || !slug || !content) {
    return errorResponse('缺少必要参数', 400);
  }

  try {
    const result = await env.DB.prepare(`
      INSERT INTO posts (title, slug, content, excerpt, category_id, is_public)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(title, slug, content, excerpt || '', category_id || null, is_public).run();

    const postId = result.meta?.last_row_id;

    // 添加标签关联
    if (tag_ids && Array.isArray(tag_ids)) {
      for (const tagId of tag_ids) {
        await env.DB.prepare(`
          INSERT INTO post_tags (post_id, tag_id) VALUES (?, ?)
        `).bind(postId, tagId).run();
      }
    }

    return jsonResponse({ id: postId });
  } catch (err: any) {
    return errorResponse(err.message || '创建失败', 500);
  }
}

// 更新文章
async function updatePost(env: Env, id: number, body: any): Promise<Response> {
  const { title, slug, content, excerpt, category_id, is_public, tag_ids } = body;

  try {
    const updates: string[] = [];
    const values: any[] = [];

    if (title !== undefined) { updates.push('title = ?'); values.push(title); }
    if (slug !== undefined) { updates.push('slug = ?'); values.push(slug); }
    if (content !== undefined) { updates.push('content = ?'); values.push(content); }
    if (excerpt !== undefined) { updates.push('excerpt = ?'); values.push(excerpt); }
    if (category_id !== undefined) { updates.push('category_id = ?'); values.push(category_id); }
    if (is_public !== undefined) { updates.push('is_public = ?'); values.push(is_public); }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    await env.DB.prepare(`
      UPDATE posts SET ${updates.join(', ')} WHERE id = ?
    `).bind(...values).run();

    // 更新标签关联
    if (tag_ids !== undefined && Array.isArray(tag_ids)) {
      await env.DB.prepare('DELETE FROM post_tags WHERE post_id = ?').bind(id).run();
      for (const tagId of tag_ids) {
        await env.DB.prepare(`
          INSERT INTO post_tags (post_id, tag_id) VALUES (?, ?)
        `).bind(id, tagId).run();
      }
    }

    return jsonResponse({ success: true });
  } catch (err: any) {
    return errorResponse(err.message || '更新失败', 500);
  }
}

// 删除文章
async function deletePost(env: Env, id: number): Promise<Response> {
  try {
    await env.DB.prepare('DELETE FROM post_tags WHERE post_id = ?').bind(id).run();
    await env.DB.prepare('DELETE FROM comments WHERE post_id = ?').bind(id).run();
    await env.DB.prepare('DELETE FROM posts WHERE id = ?').bind(id).run();
    return jsonResponse({ success: true });
  } catch (err: any) {
    return errorResponse(err.message || '删除失败', 500);
  }
}

// 主处理函数
async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/', '');
  const method = request.method;

  // CORS 预检
  if (method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    // ========== 公开 API ==========
    
    // 文章
    if (path === 'posts' && method === 'GET') {
      return getPosts(env, url);
    }
    if (path === 'posts/hot' && method === 'GET') {
      return getHotPosts(env, url);
    }
    if (path === 'posts/latest' && method === 'GET') {
      return getLatestPosts(env, url);
    }
    if (path.startsWith('posts/') && method === 'GET') {
      const slug = path.replace('posts/', '');
      return getPost(env, slug);
    }

    // 分类
    if (path === 'categories' && method === 'GET') {
      return getCategories(env);
    }
    if (path.startsWith('category/') && method === 'GET') {
      const slug = path.replace('category/', '');
      return getPostsByCategory(env, slug, url);
    }

    // 标签
    if (path === 'tags' && method === 'GET') {
      return getTags(env);
    }
    if (path === 'tags/hot' && method === 'GET') {
      return getHotTags(env, url);
    }
    if (path.startsWith('tag/') && method === 'GET') {
      const slug = path.replace('tag/', '');
      return getPostsByTag(env, slug, url);
    }

    // 搜索
    if (path === 'search' && method === 'GET') {
      return searchPosts(env, url);
    }

    // 评论
    if (path === 'comments' && method === 'GET') {
      return getComments(env, url);
    }
    if (path === 'comments' && method === 'POST') {
      const body = await request.json();
      return addComment(env, body, request);
    }

    // ========== 认证 API ==========
    
    // 用户注册
    if (path === 'auth/register' && method === 'POST') {
      const body = await request.json();
      return register(env, body);
    }
    
    // 用户登录
    if (path === 'auth/login' && method === 'POST') {
      const body = await request.json();
      return login(env, body);
    }
    
    // 获取当前用户
    if (path === 'auth/me' && method === 'GET') {
      return getCurrentUser(env, request);
    }

    // ========== 管理后台 API ==========
    
    // 文章管理
    if (path === 'admin/posts' && method === 'GET') {
      return getAllPosts(env, url);
    }
    if (path === 'admin/posts' && method === 'POST') {
      const body = await request.json();
      return createPost(env, body);
    }
    if (path.startsWith('admin/posts/') && path.endsWith('/edit') && method === 'PUT') {
      const id = parseInt(path.split('/')[2]);
      const body = await request.json();
      return updatePost(env, id, body);
    }
    if (path.startsWith('admin/posts/') && method === 'DELETE') {
      const id = parseInt(path.split('/')[2]);
      return deletePost(env, id);
    }

    // 未知路由
    return errorResponse('Not Found', 404);
  } catch (err: any) {
    return errorResponse(err.message || 'Internal Error', 500);
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return handleRequest(request, env);
  },
};
