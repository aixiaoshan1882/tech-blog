/**
 * 搜索页
 */

import { useSearchParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { search } from '@/api/search'
import { PostCard } from '@/components/PostCard/PostCard'
import { usePagination } from '@/hooks/useStore'

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') || ''
  const [keyword, setKeyword] = useState(query)

  const fetchPosts = async (page: number, pageSize: number) => {
    if (!query) return { items: [], total: 0 }
    return search(query, page, pageSize)
  }

  const { items: posts, loading, error, page, total, hasMore, nextPage, prevPage } = usePagination(
    fetchPosts,
    10
  )

  useEffect(() => {
    setKeyword(query)
  }, [query])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (keyword.trim()) {
      setSearchParams({ q: keyword.trim() })
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Search Form */}
      <form onSubmit={handleSearch} className="mb-8">
        <div className="flex gap-2">
          <input
            type="text"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            placeholder="搜索文章..."
            className="flex-1 px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            搜索
          </button>
        </div>
      </form>

      {/* Results */}
      {query && (
        <div className="mb-6">
          <p className="text-gray-500 dark:text-gray-400">
            {loading ? '搜索中...' : `找到 ${total} 个关于 "${query}" 的结果`}
          </p>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
          {error.message}
        </div>
      )}

      {!loading && posts.length === 0 && query && (
        <div className="text-center py-12">
          <p className="text-6xl mb-4">🔍</p>
          <h2 className="text-xl font-medium text-gray-900 dark:text-gray-100 mb-2">
            未找到相关文章
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            尝试其他关键词
          </p>
        </div>
      )}

      {!query && (
        <div className="text-center py-12">
          <p className="text-6xl mb-4">🔍</p>
          <h2 className="text-xl font-medium text-gray-900 dark:text-gray-100 mb-2">
            输入关键词搜索
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            支持标题、内容、标签搜索
          </p>
        </div>
      )}

      {/* Post List */}
      <div className="space-y-6">
        {posts.map(post => (
          <PostCard key={post.id} post={post} variant="compact" />
        ))}
      </div>

      {/* Pagination */}
      {posts.length > 0 && (
        <div className="mt-8 flex items-center justify-center space-x-4">
          <button
            onClick={prevPage}
            disabled={page === 1}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            上一页
          </button>
          <span className="text-gray-500 dark:text-gray-400">
            第 {page} 页
          </span>
          <button
            onClick={nextPage}
            disabled={!hasMore}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            下一页
          </button>
        </div>
      )}
    </div>
  )
}
