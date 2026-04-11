import { useState } from 'react'

interface Endpoint {
  method: string
  path: string
  description: string
  params?: string[]
  response: string
  auth?: boolean
}

interface Category {
  category: string
  endpoints: Endpoint[]
}

const apiDocs: Category[] = [
  {
    category: '认证相关',
    endpoints: [
      {
        method: 'POST',
        path: '/api/auth/register',
        description: '用户注册',
        params: ['email', 'password', 'nickname'],
        response: `{ code: 200, data: { user, token } }`,
      },
      {
        method: 'POST',
        path: '/api/auth/login',
        description: '用户登录',
        params: ['email', 'password'],
        response: `{ code: 200, data: { user, token } }`,
      },
      {
        method: 'GET',
        path: '/api/auth/me',
        description: '获取当前用户信息',
        auth: true,
        response: `{ code: 200, data: { user } }`,
      },
    ],
  },
  {
    category: '文章相关',
    endpoints: [
      {
        method: 'GET',
        path: '/api/posts',
        description: '获取文章列表',
        params: ['page', 'limit', 'category_id'],
        response: `{ code: 200, data: { items, total } }`,
      },
      {
        method: 'GET',
        path: '/api/posts/:slug',
        description: '获取文章详情',
        params: ['slug'],
        response: `{ code: 200, data: { post } }`,
      },
      {
        method: 'POST',
        path: '/api/posts',
        description: '创建文章',
        auth: true,
        params: ['title', 'slug', 'content'],
        response: `{ code: 200, data: { id } }`,
      },
      {
        method: 'PUT',
        path: '/api/posts/:id',
        description: '更新文章',
        auth: true,
        params: ['title', 'content'],
        response: `{ code: 200 }`,
      },
      {
        method: 'DELETE',
        path: '/api/posts/:id',
        description: '删除文章',
        auth: true,
        response: `{ code: 200 }`,
      },
    ],
  },
  {
    category: '分类与标签',
    endpoints: [
      {
        method: 'GET',
        path: '/api/categories',
        description: '获取所有分类',
        response: `{ code: 200, data: [...] }`,
      },
      {
        method: 'GET',
        path: '/api/tags',
        description: '获取所有标签',
        response: `{ code: 200, data: [...] }`,
      },
      {
        method: 'POST',
        path: '/api/categories',
        description: '创建分类',
        auth: true,
        params: ['name', 'slug'],
        response: `{ code: 200, data: { id } }`,
      },
      {
        method: 'POST',
        path: '/api/tags',
        description: '创建标签',
        auth: true,
        params: ['name', 'slug'],
        response: `{ code: 200, data: { id } }`,
      },
    ],
  },
  {
    category: '评论相关',
    endpoints: [
      {
        method: 'GET',
        path: '/api/comments',
        description: '获取评论列表',
        params: ['post_id', 'page'],
        response: `{ code: 200, data: { items, total } }`,
      },
      {
        method: 'POST',
        path: '/api/comments',
        description: '添加评论',
        auth: true,
        params: ['post_id', 'content', 'parent_id?'],
        response: `{ code: 200, data: { comment } }`,
      },
      {
        method: 'POST',
        path: '/api/comments/:id/like',
        description: '点赞评论',
        auth: true,
        response: `{ code: 200 }`,
      },
    ],
  },
  {
    category: '用户相关',
    endpoints: [
      {
        method: 'GET',
        path: '/api/users',
        description: '获取用户列表（管理员）',
        auth: true,
        params: ['page', 'keyword', 'role'],
        response: `{ code: 200, data: { items, total } }`,
      },
      {
        method: 'PUT',
        path: '/api/users/:id/role',
        description: '修改用户角色',
        auth: true,
        params: ['role'],
        response: `{ code: 200 }`,
      },
      {
        method: 'GET',
        path: '/api/users/:id/posts',
        description: '获取用户文章',
        params: ['user_id'],
        response: `{ code: 200, data: { items } }`,
      },
    ],
  },
  {
    category: '收藏与点赞',
    endpoints: [
      {
        method: 'POST',
        path: '/api/posts/:id/like',
        description: '点赞文章',
        auth: true,
        response: `{ code: 200 }`,
      },
      {
        method: 'DELETE',
        path: '/api/posts/:id/like',
        description: '取消点赞',
        auth: true,
        response: `{ code: 200 }`,
      },
      {
        method: 'POST',
        path: '/api/posts/:id/favorite',
        description: '收藏文章',
        auth: true,
        response: `{ code: 200 }`,
      },
      {
        method: 'DELETE',
        path: '/api/posts/:id/favorite',
        description: '取消收藏',
        auth: true,
        response: `{ code: 200 }`,
      },
      {
        method: 'GET',
        path: '/api/favorites',
        description: '获取收藏列表',
        auth: true,
        response: `{ code: 200, data: { items } }`,
      },
    ],
  },
  {
    category: '通知与日志',
    endpoints: [
      {
        method: 'GET',
        path: '/api/notifications',
        description: '获取通知列表',
        auth: true,
        response: `{ code: 200, data: { items } }`,
      },
      {
        method: 'PUT',
        path: '/api/notifications/:id/read',
        description: '标记通知已读',
        auth: true,
        response: `{ code: 200 }`,
      },
      {
        method: 'GET',
        path: '/api/logs',
        description: '获取操作日志（管理员）',
        auth: true,
        params: ['page', 'limit'],
        response: `{ code: 200, data: { items, total } }`,
      },
    ],
  },
  {
    category: '系统',
    endpoints: [
      {
        method: 'GET',
        path: '/api/stats',
        description: '获取全站统计',
        response: `{ code: 200, data: { totalPosts, totalViews, ... } }`,
      },
      {
        method: 'GET',
        path: '/api/announcements',
        description: '获取公告列表',
        response: `{ code: 200, data: { items } }`,
      },
      {
        method: 'GET',
        path: '/api/search',
        description: '搜索文章',
        params: ['q'],
        response: `{ code: 200, data: { items } }`,
      },
    ],
  },
  {
    category: '订阅与 SEO',
    endpoints: [
      {
        method: 'GET',
        path: '/feed.xml',
        description: 'RSS 2.0 订阅源',
        response: 'XML',
      },
      {
        method: 'GET',
        path: '/atom.xml',
        description: 'Atom 1.0 订阅源',
        response: 'XML',
      },
      {
        method: 'GET',
        path: '/sitemap.xml',
        description: '站点地图',
        response: 'XML',
      },
    ],
  },
]

const methodColors: Record<string, string> = {
  GET: 'bg-green-100 text-green-800',
  POST: 'bg-blue-100 text-blue-800',
  PUT: 'bg-yellow-100 text-yellow-800',
  DELETE: 'bg-red-100 text-red-800',
  PATCH: 'bg-purple-100 text-purple-800',
}

export default function APIDocs() {
  const [expandedCategory, setExpandedCategory] = useState<string | null>('认证相关')

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">API 文档</h1>
        <p className="text-gray-600">
          技术笔记博客 API 接口文档。所有需要认证的接口需要在 Header 中携带 Token：
          <code className="bg-gray-100 px-2 py-1 rounded ml-1">
            Authorization: Bearer &lt;token&gt;
          </code>
        </p>
      </div>

      {/* 认证说明 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="font-bold text-blue-800 mb-2">🔐 认证方式</h3>
        <div className="text-sm text-blue-700 space-y-1">
          <p><strong>方式一：JWT Token</strong> - 登录后获取，用于需要登录的操作</p>
          <p><strong>方式二：API Key</strong> - 在 Header 中添加 X-API-Key 和 X-API-Secret</p>
        </div>
      </div>

      {/* 全局响应格式 */}
      <div className="bg-gray-50 border rounded-lg p-4 mb-6">
        <h3 className="font-bold mb-2">📋 全局响应格式</h3>
        <pre className="bg-gray-800 text-green-400 p-3 rounded text-sm overflow-x-auto">
{`// 成功
{ "code": 200, "data": {...}, "msg": "操作成功" }

// 错误
{ "code": 400, "msg": "错误信息" }

// 分页响应
{ "code": 200, "data": { "items": [...], "total": 100, "page": 1 } }`}
        </pre>
      </div>

      {/* 接口列表 */}
      <div className="space-y-4">
        {apiDocs.map((category) => (
          <div key={category.category} className="border rounded-lg overflow-hidden">
            <button
              onClick={() => setExpandedCategory(
                expandedCategory === category.category ? null : category.category
              )}
              className="w-full px-4 py-3 bg-gray-100 hover:bg-gray-200 text-left font-bold flex justify-between items-center"
            >
              <span>{category.category}</span>
              <span>{expandedCategory === category.category ? '▲' : '▼'}</span>
            </button>
            
            {expandedCategory === category.category && (
              <div className="divide-y">
                {category.endpoints.map((endpoint: Endpoint) => (
                  <div key={endpoint.path} className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-1 text-xs font-bold rounded ${methodColors[endpoint.method]}`}>
                        {endpoint.method}
                      </span>
                      <code className="text-sm font-mono">{endpoint.path}</code>
                      {endpoint.auth && (
                        <span className="text-xs bg-orange-100 text-orange-800 px-2 py-0.5 rounded">
                          需认证
                        </span>
                      )}
                    </div>
                    <p className="text-gray-600 text-sm mb-2">{endpoint.description}</p>
                    {endpoint.params && (
                      <div className="text-xs text-gray-500 mb-2">
                        <strong>参数：</strong>
                        {endpoint.params.map((p) => (
                          <span key={p} className="inline-block bg-gray-100 px-1.5 py-0.5 rounded mr-1">
                            {p}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="text-xs">
                      <strong className="text-gray-500">响应示例：</strong>
                      <pre className="bg-gray-800 text-green-400 p-2 rounded mt-1 overflow-x-auto">
                        {endpoint.response}
                      </pre>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
