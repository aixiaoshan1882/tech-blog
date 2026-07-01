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

const quickActions = [
  { icon: '✨', title: '写文章', desc: '创建新文章', link: '/admin/posts/new', color: 'from-blue-500 to-blue-600' },
  { icon: '📢', title: '发公告', desc: '发布系统公告', link: '/admin/announcements', color: 'from-yellow-500 to-orange-500' },
  { icon: '👥', title: '用户管理', desc: '管理用户', link: '/admin/users', color: 'from-purple-500 to-pink-500' },
  { icon: '🗑️', title: '回收站', desc: '查看已删除', link: '/admin/trash', color: 'from-red-500 to-red-600' },
  { icon: '📊', title: '数据分析', desc: '查看统计数据', link: '/admin/analytics', color: 'from-green-500 to-emerald-500' },
  { icon: '⚙️', title: '网站设置', desc: '系统配置', link: '/admin/settings', color: 'from-gray-500 to-gray-600' },
]

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
        api.get('/stats') as any,
        api.get('/users/stats/overview') as any,
        api.get('/posts?limit=5') as any,
      ])
      setStats(statsRes)
      setUserStats(userRes)
      setRecentPosts(postsRes.items || [])
    } catch (error) {
      console.error('获取数据失败', error)
    }
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">加载中...</p>
        </div>
      </div>
    )
  }

  const statCards = [
    { label: '文章总数', value: stats?.totalPosts || 0, icon: '📝', color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: '总浏览量', value: stats?.totalViews || 0, icon: '👁', color: 'text-green-600', bg: 'bg-green-50' },
    { label: '评论总数', value: stats?.totalComments || 0, icon: '💬', color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: '分类总数', value: stats?.totalCategories || 0, icon: '📂', color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: '标签总数', value: stats?.totalTags || 0, icon: '🏷️', color: 'text-pink-600', bg: 'bg-pink-50' },
    { label: '用户总数', value: userStats?.total_users || 0, icon: '👥', color: 'text-indigo-600', bg: 'bg-indigo-50' },
  ]

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">📊 仪表盘</h1>
        <p className="text-gray-500 dark:text-gray-400">欢迎回来！以下是博客的最新动态</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {statCards.map((stat, i) => (
          <div
            key={i}
            className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all"
          >
            <div className={`w-12 h-12 ${stat.bg} rounded-xl flex items-center justify-center text-2xl mb-3`}>
              {stat.icon}
            </div>
            <div className={`text-2xl font-bold ${stat.color} mb-1`}>
              {stat.value.toLocaleString()}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-xl font-bold mb-4">🚀 快捷操作</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {quickActions.map((action, i) => (
            <Link
              key={i}
              to={action.link}
              className="group bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
            >
              <div className={`w-12 h-12 bg-gradient-to-br ${action.color} rounded-xl flex items-center justify-center text-2xl mb-3 group-hover:scale-110 transition-transform`}>
                {action.icon}
              </div>
              <div className="font-semibold text-gray-900 dark:text-gray-100 mb-1">{action.title}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{action.desc}</div>
            </Link>
          ))}
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Recent Posts */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <span>📝</span> 最近文章
            </h2>
            <Link to="/admin/posts" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              查看全部 →
            </Link>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {recentPosts.length > 0 ? recentPosts.map((post) => (
              <Link
                key={post.id}
                to={`/admin/posts/${post.id}/edit`}
                className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 dark:text-gray-100 truncate mb-1">
                    {post.title}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">{post.category_name || '未分类'}</span>
                    <span>{new Date(post.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-400 ml-4">
                  <span className="flex items-center gap-1" title="阅读">
                    👁 {post.view_count || 0}
                  </span>
                  <span className="flex items-center gap-1" title="点赞">
                    ❤️ {post.like_count || 0}
                  </span>
                </div>
              </Link>
            )) : (
              <div className="p-8 text-center text-gray-500">
                暂无文章
              </div>
            )}
          </div>
        </div>

        {/* User Stats */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <span>👥</span> 用户统计
            </h2>
            <Link to="/admin/users" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              管理用户 →
            </Link>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 rounded-2xl">
                <div className="text-3xl font-bold text-blue-600 mb-2">{userStats?.total_users || 0}</div>
                <div className="text-sm text-gray-500">总用户</div>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-800/30 rounded-2xl">
                <div className="text-3xl font-bold text-red-600 mb-2">{userStats?.admin_count || 0}</div>
                <div className="text-sm text-gray-500">管理员</div>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 rounded-2xl">
                <div className="text-3xl font-bold text-green-600 mb-2">{userStats?.today_users || 0}</div>
                <div className="text-sm text-gray-500">今日新增</div>
              </div>
            </div>
            
            <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <div className="text-sm text-gray-500 mb-2">用户角色分布</div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                    style={{ width: `${((userStats?.admin_count || 0) / (userStats?.total_users || 1)) * 100}%` }}
                  />
                </div>
                <span className="text-sm text-gray-500">
                  {((userStats?.admin_count || 0) / (userStats?.total_users || 1) * 100).toFixed(1)}% 管理员
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* System Status */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <span>📡</span> 系统状态
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-xl">
            <span className="text-2xl">✅</span>
            <div>
              <div className="font-medium text-green-700 dark:text-green-400">数据库</div>
              <div className="text-xs text-green-600 dark:text-green-500">运行正常</div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-xl">
            <span className="text-2xl">✅</span>
            <div>
              <div className="font-medium text-green-700 dark:text-green-400">API 服务</div>
              <div className="text-xs text-green-600 dark:text-green-500">运行正常</div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-xl">
            <span className="text-2xl">✅</span>
            <div>
              <div className="font-medium text-green-700 dark:text-green-400">前端应用</div>
              <div className="text-xs text-green-600 dark:text-green-500">运行正常</div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-xl">
            <span className="text-2xl">✅</span>
            <div>
              <div className="font-medium text-green-700 dark:text-green-400">安全防护</div>
              <div className="text-xs text-green-600 dark:text-green-500">已启用</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
