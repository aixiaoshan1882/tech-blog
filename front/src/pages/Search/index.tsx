/**
 * 搜索页
 */

import { useSearchParams, Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { search } from '@/api/search'
import { PostCard } from '@/components/PostCard/PostCard'
import { usePagination } from '@/hooks/useStore'

// 搜索历史
const hotKeywords = ['Python', 'JavaScript', 'React', 'TypeScript', 'Docker', 'Git', '算法', '性能优化']

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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (keyword.trim()) {
      setSearchParams({ q: keyword.trim() })
      setShowHistory(false)
      // 保存搜索历史
      const history = JSON.parse(localStorage.getItem('searchHistory') || '[]')
      const newHistory = [keyword.trim(), ...history.filter((h: string) => h !== keyword.trim())].slice(0, 10)
      localStorage.setItem('searchHistory', JSON.stringify(newHistory))
    }
  }

  const handleKeywordClick = (kw: string) => {
    setKeyword(kw)
    setSearchParams({ q: kw })
    setShowHistory(false)
  }

  const clearHistory = () => {
    localStorage.removeItem('searchHistory')
    setShowHistory(false)
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Search Header */}
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">🔍 搜索</h1>
        <p className="text-gray-500 dark:text-gray-400">探索你感兴趣的技术内容</p>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="mb-10 relative">
        <div className="relative">
          <input
            type="text"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            onFocus={() => setShowHistory(true)}
            placeholder="搜索文章标题、内容、标签..."
            className="w-full px-6 py-4 pl-14 text-lg rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-lg transition-all"
          />
          <span className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl">🔍</span>
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-blue-500/30 transition-all"
          >
            搜索
          </button>
        </div>

        {/* Search History & Suggestions */}
        {showHistory && !query && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 p-4 z-20">
            {localStorage.getItem('searchHistory') && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-500">搜索历史</span>
                  <button onClick={clearHistory} className="text-xs text-gray-400 hover:text-red-500">清除</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {JSON.parse(localStorage.getItem('searchHistory') || '[]').map((h: string, i: number) => (
                    <button
                      key={i}
                      onClick={() => handleKeywordClick(h)}
                      className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 rounded-full hover:bg-blue-100 hover:text-blue-600 transition-colors"
                    >
                      {h}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <span className="text-sm font-medium text-gray-500 mb-2 block">热门搜索</span>
              <div className="flex flex-wrap gap-2">
                {hotKeywords.map(kw => (
                  <button
                    key={kw}
                    onClick={() => handleKeywordClick(kw)}
                    className="px-3 py-1 text-sm bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 text-blue-600 dark:text-blue-400 rounded-full hover:shadow-md transition-all"
                  >
                    🔥 {kw}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </form>

      {/* Results */}
      {query && (
        <div className="mb-6 flex items-center justify-between">
          <p className="text-gray-500 dark:text-gray-400">
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                搜索中...
              </span>
            ) : (
              <>找到 <span className="font-bold text-blue-600">{total}</span> 个关于 "<span className="font-semibold">{query}</span>" 的结果</>
            )}
          </p>
          {posts.length > 0 && (
            <span className="text-sm text-gray-400">第 {page} 页</span>
          )}
        </div>
      )}

      {error && (
        <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-2xl">
          ❌ {error.message}
        </div>
      )}

      {!loading && posts.length === 0 && query && (
        <div className="text-center py-20">
          <div className="w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-5xl">🔍</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
            未找到相关文章
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            尝试其他关键词，或浏览热门分类
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {hotKeywords.slice(0, 4).map(kw => (
              <button
                key={kw}
                onClick={() => handleKeywordClick(kw)}
                className="px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full hover:bg-blue-200 transition-colors"
              >
                {kw}
              </button>
            ))}
          </div>
        </div>
      )}

      {!query && (
        <div className="py-12">
          <h2 className="text-xl font-bold mb-6 text-gray-900 dark:text-gray-100">🏷️ 热门标签</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {hotKeywords.map((kw, i) => (
              <Link
                key={kw}
                to={`/tag/${kw.toLowerCase()}`}
                className="p-6 bg-white dark:bg-gray-800 rounded-2xl text-center hover:shadow-lg transition-all group"
              >
                <div className="text-3xl mb-2">{['🐍', '📜', '⚛️', '🔷', '🐳', '📚', '🧮', '⚡'][i]}</div>
                <div className="font-medium group-hover:text-blue-600 transition-colors">{kw}</div>
              </Link>
            ))}
          </div>

          <h2 className="text-xl font-bold mt-12 mb-6 text-gray-900 dark:text-gray-100">💡 推荐阅读</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {['Python 异步编程实战', 'JavaScript ES2024 新特性'].map((title, i) => (
              <Link
                key={title}
                to={`/post/${title.toLowerCase().replace(/\s+/g, '-')}`}
                className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-xl hover:shadow-md transition-all group"
              >
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold">
                  {i + 1}
                </div>
                <span className="font-medium group-hover:text-blue-600 transition-colors">{title}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Post List */}
      {posts.length > 0 && (
        <div className="space-y-6">
          {posts.map((post, index) => (
            <div key={post.id} style={{ animationDelay: `${index * 50}ms` }} className="animate-fade-in">
              <PostCard post={post} variant="compact" />
            </div>
          ))}
        </div>
      )}

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
            <span className="text-gray-500">{Math.ceil(total / 10)}</span>
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
    </div>
  )
}
