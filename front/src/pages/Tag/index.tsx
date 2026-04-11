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

  const { items: posts, page, total, hasMore, nextPage, prevPage } = usePagination(
    fetchPosts,
    9
  )

  if (tagLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
        </div>
      </div>
    )
  }

  if (tagError || !tag) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <p className="text-6xl mb-4">🏷️</p>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            标签不存在
          </h1>
          <Link to="/" className="text-blue-600 hover:text-blue-700">
            返回首页
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <header className="mb-8 pb-8 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-3">
          <span className="text-4xl">🏷️</span>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              {tag.name}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              共 {total} 篇文章
            </p>
          </div>
        </div>
      </header>

      {/* Posts Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {posts.map(post => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>

      {posts.length === 0 && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          该标签下暂无文章
        </div>
      )}

      {/* Pagination */}
      {posts.length > 0 && (
        <div className="mt-8 flex items-center justify-center space-x-4">
          <button
            onClick={prevPage}
            disabled={page === 1}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            上一页
          </button>
          <span className="text-gray-500 dark:text-gray-400">第 {page} 页</span>
          <button
            onClick={nextPage}
            disabled={!hasMore}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            下一页
          </button>
        </div>
      )}
    </div>
  )
}
