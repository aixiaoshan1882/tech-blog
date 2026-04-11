/**
 * Admin 仪表盘 - 移动端优化
 */

import { useAsync } from '@/hooks/useStore'
import { getStats } from '@/api/search'
import { getLatestPosts } from '@/api/posts'
import { Link } from 'react-router-dom'
import { Loading } from '@/components/Loading'
import { Empty } from '@/components/Empty'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'

dayjs.locale('zh-cn')

const statCards = [
  { key: 'totalPosts', label: '文章', icon: '📝', color: 'from-blue-500 to-blue-600' },
  { key: 'totalViews', label: '阅读', icon: '👁', color: 'from-green-500 to-green-600' },
  { key: 'totalComments', label: '评论', icon: '💬', color: 'from-purple-500 to-purple-600' },
  { key: 'totalCategories', label: '分类', icon: '📁', color: 'from-orange-500 to-orange-600' },
]

export default function AdminDashboard() {
  const { data: stats, loading: statsLoading } = useAsync(() => getStats(), [])
  const { data: latestPosts, loading: postsLoading } = useAsync(() => getLatestPosts(5), [])

  return (
    <div className="space-y-6 px-4 sm:px-0">
      {/* Header */}
      <div className="sm:hidden">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          📊 仪表盘
        </h1>
        <p className="text-sm text-gray-500">欢迎回来！</p>
      </div>

      {/* Stats Cards - Mobile optimized grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {statCards.map((card) => (
          <div
            key={card.key}
            className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow"
          >
            {statsLoading ? (
              <div className="animate-pulse">
                <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-xl mb-3" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2" />
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <span className="text-2xl sm:text-3xl">{card.icon}</span>
                  <span className={`text-xs sm:text-sm px-2 py-1 bg-gradient-to-r ${card.color} text-white rounded-full`}>
                    {card.label}
                  </span>
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {stats?.[card.key as keyof typeof stats] || 0}
                </p>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">{card.label}总数</p>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Quick Actions - Mobile optimized */}
      <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <span>🚀</span> 快捷操作
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link
            to="/admin/posts/new"
            className="flex flex-col items-center gap-2 p-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:shadow-lg transition-all"
          >
            <span className="text-2xl">✍️</span>
            <span className="text-sm font-medium">写文章</span>
          </Link>
          <Link
            to="/admin/categories"
            className="flex flex-col items-center gap-2 p-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <span className="text-2xl">📁</span>
            <span className="text-sm">分类</span>
          </Link>
          <Link
            to="/admin/tags"
            className="flex flex-col items-center gap-2 p-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <span className="text-2xl">🏷️</span>
            <span className="text-sm">标签</span>
          </Link>
          <Link
            to="/admin/comments"
            className="flex flex-col items-center gap-2 p-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <span className="text-2xl">💬</span>
            <span className="text-sm">评论</span>
          </Link>
        </div>
      </div>

      {/* Recent Posts - Mobile optimized */}
      <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <span>📝</span> 最新文章
          </h2>
          <Link
            to="/admin/posts"
            className="text-xs sm:text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            查看全部 →
          </Link>
        </div>

        {postsLoading ? (
          <Loading />
        ) : latestPosts && latestPosts.length > 0 ? (
          <div className="space-y-3 sm:divide-y sm:divide-gray-100 sm:dark:divide-gray-700">
            {latestPosts.map(post => (
              <div key={post.id} className="py-3 sm:py-4 first:pt-0 last:pb-0 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <Link
                    to={`/post/${post.slug}`}
                    target="_blank"
                    className="font-medium text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 line-clamp-1"
                  >
                    {post.title}
                  </Link>
                  <div className="flex items-center gap-2 mt-1 text-xs sm:text-sm text-gray-500">
                    <span>{dayjs(post.created_at).format('MM-DD HH:mm')}</span>
                    <span className="hidden xs:inline">•</span>
                    <span className="hidden xs:inline">{post.viewCount || post.view_count || 0} 阅读</span>
                  </div>
                </div>
                <span
                  className={`px-2 py-1 rounded text-xs whitespace-nowrap ${
                    post.is_public === 1
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                  }`}
                >
                  {post.is_public === 1 ? '已发布' : '私密'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <Empty 
            icon="📝"
            title="暂无文章"
            description="开始创作你的第一篇文章吧"
            action={{ label: '写文章', href: '/admin/posts/new' }}
          />
        )}
      </div>

      {/* Admin Links - Mobile optimized */}
      <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <span>⚙️</span> 管理功能
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[
            { to: '/admin/users', icon: '👥', label: '用户' },
            { to: '/admin/announcements', icon: '📢', label: '公告' },
            { to: '/admin/logs', icon: '📋', label: '日志' },
            { to: '/admin/trash', icon: '🗑️', label: '回收站' },
            { to: '/admin/analytics', icon: '📊', label: '分析' },
            { to: '/admin/settings', icon: '🔧', label: '设置' },
          ].map(link => (
            <Link
              key={link.to}
              to={link.to}
              className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <span className="text-xl">{link.icon}</span>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{link.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
