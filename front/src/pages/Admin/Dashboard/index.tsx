import { useState, useEffect } from 'react'
import { api } from '@/api'
import { Link } from 'react-router-dom'

interface DashboardStats {
  totalPosts: number
  totalViews: number
  totalComments: number
  totalCategories: number
  totalTags: number
}

interface UserStats {
  total_users: number
  admin_count: number
  reader_count: number
  today_users: number
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [userStats, setUserStats] = useState<UserStats | null>(null)
  const [recentPosts, setRecentPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [statsRes, userRes, postsRes] = await Promise.all([
        api.get('/stats'),
        api.get('/users/stats/overview'),
        api.get('/posts?limit=5'),
      ])
      setStats(statsRes.data.data)
      setUserStats(userRes.data.data)
      setRecentPosts(postsRes.data.data.items)
    } catch (error) {
      console.error('获取数据失败', error)
    }
    setLoading(false)
  }

  if (loading) {
    return <div className="p-6 text-center">加载中...</div>
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">仪表盘</h1>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-3xl font-bold text-blue-600">{stats?.totalPosts || 0}</div>
          <div className="text-gray-500 text-sm">文章总数</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-3xl font-bold text-green-600">{stats?.totalViews || 0}</div>
          <div className="text-gray-500 text-sm">总浏览量</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-3xl font-bold text-purple-600">{stats?.totalComments || 0}</div>
          <div className="text-gray-500 text-sm">评论总数</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-3xl font-bold text-orange-600">{stats?.totalCategories || 0}</div>
          <div className="text-gray-500 text-sm">分类总数</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-3xl font-bold text-pink-600">{stats?.totalTags || 0}</div>
          <div className="text-gray-500 text-sm">标签总数</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-3xl font-bold text-indigo-600">{userStats?.total_users || 0}</div>
          <div className="text-gray-500 text-sm">用户总数</div>
        </div>
      </div>

      {/* 快捷操作和最近文章 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 快捷操作 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold mb-4">快捷操作</h2>
          <div className="grid grid-cols-2 gap-4">
            <Link
              to="/admin/posts/new"
              className="flex items-center p-4 border rounded-lg hover:bg-gray-50"
            >
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div>
                <div className="font-medium">写文章</div>
                <div className="text-sm text-gray-500">创建新文章</div>
              </div>
            </Link>
            <Link
              to="/admin/announcements"
              className="flex items-center p-4 border rounded-lg hover:bg-gray-50"
            >
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center mr-3">
                <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <div>
                <div className="font-medium">发公告</div>
                <div className="text-sm text-gray-500">发布系统公告</div>
              </div>
            </Link>
            <Link
              to="/admin/users"
              className="flex items-center p-4 border rounded-lg hover:bg-gray-50"
            >
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center mr-3">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div>
                <div className="font-medium">用户</div>
                <div className="text-sm text-gray-500">管理用户</div>
              </div>
            </Link>
            <Link
              to="/admin/trash"
              className="flex items-center p-4 border rounded-lg hover:bg-gray-50"
            >
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center mr-3">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <div className="font-medium">回收站</div>
                <div className="text-sm text-gray-500">查看已删除</div>
              </div>
            </Link>
          </div>
        </div>

        {/* 最近文章 */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold">最近文章</h2>
            <Link to="/admin/posts" className="text-blue-600 text-sm hover:underline">
              查看全部
            </Link>
          </div>
          <div className="space-y-3">
            {recentPosts.map((post) => (
              <Link
                key={post.id}
                to={`/admin/posts/${post.id}/edit`}
                className="flex justify-between items-center p-3 border rounded-lg hover:bg-gray-50"
              >
                <div>
                  <div className="font-medium">{post.title}</div>
                  <div className="text-sm text-gray-500">
                    {post.category_name || '未分类'} • {new Date(post.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex gap-4 text-sm text-gray-400">
                  <span>{post.view_count} 阅读</span>
                  <span>{post.like_count} 点赞</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* 用户统计 */}
      <div className="mt-6 bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-bold mb-4">用户统计</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{userStats?.total_users || 0}</div>
            <div className="text-gray-500">总用户数</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-red-600">{userStats?.admin_count || 0}</div>
            <div className="text-gray-500">管理员</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{userStats?.today_users || 0}</div>
            <div className="text-gray-500">今日新增</div>
          </div>
        </div>
      </div>
    </div>
  )
}
