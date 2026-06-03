/**
 * 分类页 - 移动端优化
 */

import { useParams, Link } from 'react-router-dom'
import { useCallback } from 'react'
import { useAsync } from '@/hooks/useStore'
import { getCategory } from '@/api/categories'
import { getPublishedPosts } from '@/api/posts'
import { PostCard } from '@/components/PostCard/PostCard'
import { usePagination } from '@/hooks/useStore'

const categoryIcons: Record<string, string> = {
  frontend: '🎨',
  backend: '⚙️',
  devops: '🚀',
  ai: '🤖',
  python: '🐍',
  javascript: '📜',
  react: '⚛️',
  default: '📁',
}

export default function Category() {
  const { slug } = useParams<{ slug: string }>()

  const { data: category, loading: categoryLoading, error: categoryError } = useAsync(
    () => getCategory(slug!),
    [slug]
  )

  const fetchPosts = useCallback(async (page: number, pageSize: number) => {
    if (!category) return { items: [], total: 0 }
    return getPublishedPosts({ categoryId: category.id, page, pageSize })
  }, [category])

  const { items: posts, loading: postsLoading, page, total, hasMore, nextPage, prevPage } = usePagination(
    fetchPosts,
    9
  )

  if (categoryLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center px-4">
          <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">加载中...</p>
        </div>
      </div>
    )
  }

  if (categoryError || !category) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-20 h-20 sm:w-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl sm:text-5xl">📁</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
            分类不存在
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            该分类可能已被删除
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-lg text-sm sm:text-base"
          >
            🏠 返回首页
          </Link>
        </div>
      </div>
    )
  }

  const icon = categoryIcons[slug || ''] || categoryIcons.default

  return (
    <div className="min-h-screen pb-16 sm:pb-0">
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700 text-white py-10 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-white/20 backdrop-blur-sm rounded-2xl mb-4 sm:mb-6 text-4xl sm:text-5xl">
            {icon}
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2 sm:mb-3">{category.name}</h1>
          {category.description && (
            <p className="text-blue-100 text-sm sm:text-lg max-w-2xl mx-auto mb-3 sm:mb-4 px-4 hidden sm:block">
              {category.description}
            </p>
          )}
          <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-white/20 backdrop-blur-sm rounded-full text-sm sm:text-base">
            <span className="text-lg sm:text-xl">📚</span>
            <span>共 <span className="font-bold">{total}</span> 篇文章</span>
          </div>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 sm:py-3">
          <nav className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm overflow-x-auto scrollbar-hide">
            <Link to="/" className="text-gray-500 hover:text-blue-600 transition-colors whitespace-nowrap">
              首页
            </Link>
            <span className="text-gray-400">/</span>
            <span className="text-gray-900 dark:text-gray-100 whitespace-nowrap">分类</span>
            <span className="text-gray-400">/</span>
            <span className="text-blue-600 whitespace-nowrap">{category.name}</span>
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 lg:py-12">
        {postsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl overflow-hidden animate-pulse">
                <div className="h-40 sm:h-48 bg-gray-200 dark:bg-gray-700" />
                <div className="p-4 sm:p-5 space-y-2 sm:space-y-3">
                  <div className="h-3 sm:h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
                  <div className="h-5 sm:h-6 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
                  <div className="h-3 sm:h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : posts.length > 0 ? (
          <>
            {/* Filter/Sort Bar */}
            <div className="flex items-center justify-between mb-4 sm:mb-6 lg:mb-8">
              <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400">
                <span className="font-medium text-gray-900 dark:text-gray-100">{posts.length}</span> 篇
                <span className="hidden xs:inline"> / 共 {total} 篇</span>
              </p>
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm text-gray-500 hidden sm:inline">排序：</span>
                <select className="px-2 sm:px-3 py-1.5 sm:py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option>最新发布</option>
                  <option>最多阅读</option>
                  <option>最多点赞</option>
                </select>
              </div>
            </div>

            {/* Posts Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
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

            {/* Pagination - Mobile Friendly */}
            {total > 9 && (
              <div className="mt-8 sm:mt-10 lg:mt-12">
                <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-t border-b border-gray-100 dark:border-gray-700 sm:hidden">
                  <button
                    onClick={prevPage}
                    disabled={page === 1}
                    className="px-4 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                  >
                    ←
                  </button>
                  <span className="text-sm text-gray-500">
                    <span className="font-medium text-gray-900 dark:text-gray-100">{page}</span>
                    <span className="mx-1">/</span>
                    {Math.ceil(total / 9)}
                  </span>
                  <button
                    onClick={nextPage}
                    disabled={!hasMore}
                    className="px-4 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                  >
                    →
                  </button>
                </div>
                
                <div className="hidden sm:flex items-center justify-center gap-3">
                  <button
                    onClick={prevPage}
                    disabled={page === 1}
                    className="px-5 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md transition-all border border-gray-200 dark:border-gray-700"
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
                    className="px-5 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md transition-all border border-gray-200 dark:border-gray-700"
                  >
                    下一页 →
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12 sm:py-20">
            <div className="w-20 h-20 sm:w-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl sm:text-5xl">📭</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
              该分类下暂无文章
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              敬请期待更多精彩内容
            </p>
            <Link
              to="/search"
              className="inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-sm sm:text-base"
            >
              🔍 浏览其他文章
            </Link>
          </div>
        )}
      </div>

      {/* Related Categories */}
      <section className="bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-indigo-900 py-8 sm:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-lg sm:text-xl font-bold mb-4 sm:mb-6 flex items-center gap-2">
            <span>📂</span> 其他分类
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {['frontend', 'backend', 'python', 'devops'].filter(s => s !== slug).slice(0, 4).map(cat => (
              <Link
                key={cat}
                to={`/category/${cat}`}
                className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-white dark:bg-gray-800 rounded-xl hover:shadow-lg transition-all group"
              >
                <span className="text-xl sm:text-2xl">{categoryIcons[cat] || categoryIcons.default}</span>
                <span className="font-medium group-hover:text-blue-600 transition-colors text-sm sm:text-base capitalize">{cat}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
