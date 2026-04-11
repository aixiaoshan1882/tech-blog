/**
 * 首页
 */

import { useAsync } from '@/hooks/useStore'
import { getPublishedPosts, getHotPosts } from '@/api/posts'
import { PostCard } from '@/components/PostCard/PostCard'
import { Sidebar } from '@/components/Sidebar/Sidebar'
import { Link } from 'react-router-dom'

export default function Home() {
  const { data: postsData, loading, error } = useAsync(
    () => getPublishedPosts({ page: 1, pageSize: 6 }),
    []
  )
  const { data: featuredPosts } = useAsync(() => getHotPosts(3), [])

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Hero Section */}
      {featuredPosts && featuredPosts.length > 0 && (
        <section className="mb-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {featuredPosts.slice(0, 2).map(post => (
              <PostCard key={post.id} post={post} variant="featured" />
            ))}
          </div>
          {featuredPosts.length > 2 && (
            <div className="mt-6">
              <PostCard post={featuredPosts[2]} variant="featured" />
            </div>
          )}
        </section>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Article List */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              最新文章
            </h2>
            <Link
              to="/posts"
              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm font-medium"
            >
              查看全部 →
            </Link>
          </div>

          {loading && (
            <div className="space-y-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-6 animate-pulse">
                  <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-lg mb-4" />
                  <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-3" />
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg">
              加载失败: {error.message}
            </div>
          )}

          {!loading && !error && postsData?.items.length === 0 && (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <p className="text-4xl mb-4">📝</p>
              <p>暂无文章</p>
            </div>
          )}

          {!loading && !error && postsData && (
            <div className="grid gap-6 md:grid-cols-2">
              {postsData.items.map(post => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {postsData && postsData.hasMore && (
            <div className="mt-8 text-center">
              <Link
                to="/posts"
                className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                加载更多
              </Link>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          <Sidebar />
        </div>
      </div>
    </div>
  )
}
