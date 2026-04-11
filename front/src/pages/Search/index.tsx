/**
 * 搜索页 - 安全增强版
 */

import { useSearchParams, Link } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react'
import { search } from '@/api/search'
import { PostCard } from '@/components/PostCard/PostCard'
import { usePagination } from '@/hooks/useStore'
import { isValidSearchKeyword, safeJsonParse, truncate } from '@/utils/security'

const MAX_KEYWORD_LENGTH = 50
const MAX_HISTORY_ITEMS = 10

const hotKeywords = ['Python', 'JavaScript', 'React', 'TypeScript', 'Docker', 'Git', '算法', '性能优化']
const tagIcons: Record<string, string> = {
  'Python': '🐍', 'JavaScript': '📜', 'React': '⚛️', 'TypeScript': '🔷',
  'Docker': '🐳', 'Git': '📚', '算法': '🧮', '性能优化': '⚡'
}

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') || ''
  const [keyword, setKeyword] = useState(query)
  const [showHistory, setShowHistory] = useState(false)

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

  // 安全处理关键词
  const handleKeywordChange = useCallback((value: string) => {
    if (value.length > MAX_KEYWORD_LENGTH) {
      value = value.substring(0, MAX_KEYWORD_LENGTH)
    }
    setKeyword(value)
  }, [])
  
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedKeyword = keyword.trim()
    
    const validation = isValidSearchKeyword(trimmedKeyword)
    if (!validation.valid) {
      console.warn(validation.error)
    }
    
    if (trimmedKeyword) {
      const safeKeyword = truncate(trimmedKeyword, MAX_KEYWORD_LENGTH)
      setSearchParams({ q: safeKeyword })
      setShowHistory(false)
      
      const history = safeJsonParse<string[]>(localStorage.getItem('searchHistory'), [])
      const newHistory = [safeKeyword, ...history.filter((h: string) => h !== safeKeyword)].slice(0, MAX_HISTORY_ITEMS)
      localStorage.setItem('searchHistory', JSON.stringify(newHistory))
    }
  }

  const handleKeywordClick = (kw: string) => {
    const safeKeyword = truncate(String(kw).trim(), MAX_KEYWORD_LENGTH)
    setKeyword(safeKeyword)
    setSearchParams({ q: safeKeyword })
    setShowHistory(false)
  }

  const clearHistory = () => {
    localStorage.removeItem('searchHistory')
    setShowHistory(false)
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Search Header */}
      <div className="text-center mb-6 sm:mb-8 lg:mb-10">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1 sm:mb-2">
          🔍 搜索
        </h1>
        <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 hidden sm:block">
          探索你感兴趣的技术内容
        </p>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="mb-6 sm:mb-8 lg:mb-10 relative">
        <div className="relative">
          <input
            type="text"
            value={keyword}
            onChange={e => handleKeywordChange(e.target.value)}
            onFocus={() => setShowHistory(true)}
            placeholder="搜索文章..."
            maxLength={MAX_KEYWORD_LENGTH}
            className="w-full px-4 sm:px-6 py-3 sm:py-4 pl-11 sm:pl-14 text-base sm:text-lg rounded-xl sm:rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-md sm:shadow-lg transition-all"
          />
          <span className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 text-xl sm:text-2xl">🔍</span>
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 px-4 sm:px-6 py-1.5 sm:py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg sm:rounded-xl font-medium hover:shadow-lg transition-all text-sm sm:text-base"
          >
            搜索
          </button>
        </div>

        {/* Search History & Suggestions */}
        {showHistory && !query && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 p-3 sm:p-4 z-20">
            {localStorage.getItem('searchHistory') && (
              <div className="mb-3 sm:mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs sm:text-sm font-medium text-gray-500">搜索历史</span>
                  <button onClick={clearHistory} className="text-xs text-gray-400 hover:text-red-500">清除</button>
                </div>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {JSON.parse(localStorage.getItem('searchHistory') || '[]').map((h: string, i: number) => (
                    <button
                      key={i}
                      onClick={() => handleKeywordClick(h)}
                      className="px-2 sm:px-3 py-1 text-xs sm:text-sm bg-gray-100 dark:bg-gray-700 rounded-full hover:bg-blue-100 hover:text-blue-600 transition-colors"
                    >
                      {h}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <span className="text-xs sm:text-sm font-medium text-gray-500 mb-2 block">热门搜索</span>
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {hotKeywords.map(kw => (
                  <button
                    key={kw}
                    onClick={() => handleKeywordClick(kw)}
                    className="px-2 sm:px-3 py-1 text-xs sm:text-sm bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 text-blue-600 dark:text-blue-400 rounded-full hover:shadow-md transition-all"
                  >
                    🔥 {kw}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </form>

      {/* Results Header */}
      {query && (
        <div className="mb-4 sm:mb-6 flex items-center justify-between">
          <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400">
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="hidden xs:inline">搜索中...</span>
              </span>
            ) : (
              <span className="hidden sm:inline">
                找到 <span className="font-bold text-blue-600">{total}</span> 个关于 "<span className="font-semibold">{query}</span>" 的结果
              </span>
            )}
            {loading && <span className="sm:hidden">搜索中...</span>}
            {!loading && <span className="sm:hidden">找到 <span className="font-bold text-blue-600">{total}</span> 个结果</span>}
          </p>
          {posts.length > 0 && (
            <span className="text-xs sm:text-sm text-gray-400 hidden sm:inline">第 {page} 页</span>
          )}
        </div>
      )}

      {error && (
        <div className="p-4 sm:p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl sm:rounded-2xl text-sm sm:text-base">
          ❌ {error.message}
        </div>
      )}

      {/* Empty State */}
      {!loading && posts.length === 0 && query && (
        <div className="text-center py-12 sm:py-16 lg:py-20">
          <div className="w-20 h-20 sm:w-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl sm:text-5xl">🔍</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
            未找到相关文章
          </h2>
          <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mb-6">
            尝试其他关键词
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {hotKeywords.slice(0, 4).map(kw => (
              <button
                key={kw}
                onClick={() => handleKeywordClick(kw)}
                className="px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full hover:bg-blue-200 transition-colors text-xs sm:text-sm"
              >
                {kw}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Default Content */}
      {!query && (
        <div className="py-6 sm:py-10 lg:py-12">
          {/* Hot Tags */}
          <h2 className="text-lg sm:text-xl font-bold mb-4 sm:mb-6 text-gray-900 dark:text-gray-100">
            🏷️ 热门标签
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-8 sm:mb-12">
            {hotKeywords.map((kw) => (
              <Link
                key={kw}
                to={`/tag/${kw.toLowerCase()}`}
                className="p-4 sm:p-6 bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl text-center hover:shadow-lg transition-all group"
              >
                <div className="text-2xl sm:text-3xl mb-1 sm:mb-2">{tagIcons[kw] || '📄'}</div>
                <div className="font-medium text-sm sm:text-base group-hover:text-blue-600 transition-colors">{kw}</div>
              </Link>
            ))}
          </div>

          {/* Recommended Reading */}
          <h2 className="text-lg sm:text-xl font-bold mb-4 sm:mb-6 text-gray-900 dark:text-gray-100">
            💡 推荐阅读
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {['Python 异步编程实战', 'JavaScript ES2024 新特性'].map((title, i) => (
              <Link
                key={title}
                to={`/post/${title.toLowerCase().replace(/\s+/g, '-')}`}
                className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-white dark:bg-gray-800 rounded-xl hover:shadow-md transition-all group"
              >
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-sm sm:text-base">
                  {i + 1}
                </div>
                <span className="font-medium text-sm sm:text-base group-hover:text-blue-600 transition-colors">{title}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Post List */}
      {posts.length > 0 && (
        <div className="space-y-4 sm:space-y-6">
          {posts.map((post, index) => (
            <div key={post.id} style={{ animationDelay: `${index * 50}ms` }} className="animate-fade-in">
              <PostCard post={post} variant="compact" />
            </div>
          ))}
        </div>
      )}

      {/* Pagination - Mobile Friendly */}
      {posts.length > 0 && (
        <div className="mt-8 sm:mt-10 lg:mt-12">
          {/* Mobile Pagination */}
          <div className="sm:hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-t border-b border-gray-100 dark:border-gray-700">
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
                {Math.ceil(total / 10)}
              </span>
              <button
                onClick={nextPage}
                disabled={!hasMore}
                className="px-4 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
              >
                →
              </button>
            </div>
          </div>

          {/* Desktop Pagination */}
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
              <span className="text-gray-500">{Math.ceil(total / 10)}</span>
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
    </div>
  )
}
