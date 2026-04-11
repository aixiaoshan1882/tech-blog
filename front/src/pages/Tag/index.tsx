/**
 * 标签页
 */

import { useParams, Link } from 'react-router-dom'
import { useAsync } from '@/hooks/useStore'
import { getTag } from '@/api/tags'
import { getPublishedPosts } from '@/api/posts'
import { PostCard } from '@/components/PostCard/PostCard'
import { usePagination } from '@/hooks/useStore'

export default function Tag() {
  const { slug } = useParams<{ slug: string }>()

  const { data: tag, loading: tagLoading, error: tagError } = useAsync(
    () => getTag(slug!),
    [slug]
  )

  const fetchPosts = async (page: number, pageSize: number) => {
    if (!tag) return { items: [], total: 0 }
    return getPublishedPosts({ tagId: tag.id, page, pageSize })
  }

  const { items: posts, loading: postsLoading, page, total, hasMore, nextPage, prevPage } = usePagination(
    fetchPosts,
    9
  )

  if (tagLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">加载中...</p>
        </div>
      </div>
    )
  }

  if (tagError || !tag) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-5xl">🏷️</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
            标签不存在
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            该标签可能已被删除
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors shadow-lg"
          >
            🏠 返回首页
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-purple-600 via-pink-600 to-red-600 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl mb-6 text-5xl">
            🏷️
          </div>
          <div className="inline-block px-6 py-2 bg-white/20 backdrop-blur-sm rounded-full mb-4">
            <span className="text-2xl font-bold">#{tag.name}</span>
          </div>
          <p className="text-purple-100 text-lg mb-6">
            探索与 <span className="font-semibold">{tag.name}</span> 相关的所有文章
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full">
            <span>📚</span>
            <span>共 <span className="font-bold">{total}</span> 篇文章</span>
          </div>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <nav className="flex items-center gap-2 text-sm">
            <Link to="/" className="text-gray-500 hover:text-purple-600 transition-colors">
              首页
            </Link>
            <span className="text-gray-400">/</span>
            <span className="text-gray-900 dark:text-gray-100">标签</span>
            <span className="text-gray-400">/</span>
            <span className="text-purple-600">#{tag.name}</span>
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {postsLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden animate-pulse">
                <div className="h-48 bg-gray-200 dark:bg-gray-700" />
                <div className="p-5 space-y-3">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
                  <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : posts.length > 0 ? (
          <>
            {/* Stats Bar */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <p className="text-gray-500 dark:text-gray-400">
                  显示 <span className="font-medium text-purple-600">{posts.length}</span> 篇
                </p>
                <span className="text-gray-300">|</span>
                <p className="text-gray-500 dark:text-gray-400">
                  共 <span className="font-medium">{total}</span> 篇
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">排序：</span>
                <select className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
                  <option>最新发布</option>
                  <option>最多阅读</option>
                  <option>最多点赞</option>
                </select>
              </div>
            </div>

            {/* Posts Grid */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {posts.map((post, index) => (
                <div
                  key={post.id}
                  style={{ animationDelay: `${index * 50}ms` }}
                  className="animate-fade-in"
                >
                  <PostCard post={post} />
                </div>
              ))}
            </div>

            {/* Pagination */}
            {posts.length > 0 && (
              <div className="mt-12 flex items-center justify-center gap-4">
                <button
                  onClick={prevPage}
                  disabled={page === 1}
                  className="px-6 py-2.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md transition-all border border-gray-200 dark:border-gray-700"
                >
                  ← 上一页
                </button>
                <div className="px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-xl text-sm">
                  <span className="font-medium">{page}</span>
                  <span className="text-gray-400 mx-1">/</span>
                  <span className="text-gray-500">{Math.ceil(total / 9)}</span>
                </div>
                <button
                  onClick={nextPage}
                  disabled={!hasMore}
                  className="px-6 py-2.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md transition-all border border-gray-200 dark:border-gray-700"
                >
                  下一页 →
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-20">
            <div className="w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-5xl">📭</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
              该标签下暂无文章
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              敬请期待更多精彩内容
            </p>
            <Link
              to="/search"
              className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors"
            >
              🔍 浏览其他文章
            </Link>
          </div>
        )}
      </div>

      {/* Popular Tags */}
      <section className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-gray-900 dark:to-indigo-900 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <span>🔥</span> 热门标签
          </h2>
          <div className="flex flex-wrap gap-3">
            {['JavaScript', 'Python', 'React', 'TypeScript', 'Docker', 'Git', '算法', '性能优化'].map(t => (
              <Link
                key={t}
                to={`/tag/${t.toLowerCase()}`}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all hover:shadow-md ${
                  t.toLowerCase() === slug?.toLowerCase()
                    ? 'bg-purple-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-purple-100 hover:text-purple-600'
                }`}
              >
                #{t}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
