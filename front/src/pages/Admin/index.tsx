/**
 * Admin 仪表盘
 */

import { useAsync } from '@/hooks/useStore'
import { getStats } from '@/api/search'
import { getLatestPosts } from '@/api/posts'
import { Link } from 'react-router-dom'
import dayjs from 'dayjs'

const statCards = [
  { key: 'totalPosts', label: '文章总数', icon: '📝' },
  { key: 'totalViews', label: '总阅读量', icon: '👁' },
  { key: 'totalComments', label: '评论总数', icon: '💬' },
  { key: 'totalCategories', label: '分类总数', icon: '📁' },
]

export default function AdminDashboard() {
  const { data: stats, loading: statsLoading } = useAsync(() => getStats(), [])
  const { data: latestPosts } = useAsync(() => getLatestPosts(5), [])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
          仪表盘
        </h1>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statCards.map(card => (
            <div
              key={card.key}
              className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm"
            >
              {statsLoading ? (
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2" />
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
                </div>
              ) : (
                <>
                  <div className="flex items-center space-x-3 mb-2">
                    <span className="text-2xl">{card.icon}</span>
                    <span className="text-gray-500 dark:text-gray-400 text-sm">
                      {card.label}
                    </span>
                  </div>
                  <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                    {stats?.[card.key as keyof typeof stats] || 0}
                  </p>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          快捷操作
        </h2>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/admin/posts/new"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            ✍️ 写文章
          </Link>
          <Link
            to="/admin/categories"
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            📁 管理分类
          </Link>
          <Link
            to="/admin/tags"
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            🏷️ 管理标签
          </Link>
        </div>
      </div>

      {/* Recent Posts */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            最新文章
          </h2>
          <Link
            to="/admin/posts"
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            查看全部 →
          </Link>
        </div>

        {latestPosts && latestPosts.length > 0 ? (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {latestPosts.map(post => (
              <div key={post.id} className="py-3 flex items-center justify-between">
                <div>
                  <Link
                    to={`/post/${post.slug}`}
                    target="_blank"
                    className="font-medium text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400"
                  >
                    {post.title}
                  </Link>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {dayjs(post.created_at).format('YYYY-MM-DD HH:mm')}
                  </div>
                </div>
                <div className="flex items-center space-x-4 text-sm text-gray-500">
                  <span>{post.viewCount || post.view_count} 阅读</span>
                  <span
                    className={`px-2 py-0.5 rounded text-xs ${
                      post.is_public === 1
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                    }`}
                  >
                    {post.is_public === 1 ? '已发布' : '私密'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 dark:text-gray-400 text-center py-4">
            暂无文章
          </p>
        )}
      </div>
    </div>
  )
}
