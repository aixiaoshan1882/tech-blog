import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/api'

interface FeaturedPost {
  id: number
  title: string
  slug: string
  excerpt: string
  cover?: string
  category_name: string
  category_slug: string
  author_nickname: string
  view_count: number
  like_count: number
  created_at: string
}

interface Category {
  id: number
  name: string
  slug: string
  post_count: number
}

interface Stats {
  totalPosts: number
  totalViews: number
  totalComments: number
  totalCategories: number
  totalTags: number
}

// 分类图标和颜色映射
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

const categoryGradients: Record<string, string> = {
  frontend: 'from-pink-500 to-rose-500',
  backend: 'from-blue-500 to-cyan-500',
  devops: 'from-purple-500 to-indigo-500',
  ai: 'from-orange-500 to-amber-500',
  python: 'from-green-500 to-emerald-500',
  javascript: 'from-yellow-500 to-orange-500',
  react: 'from-cyan-500 to-blue-500',
  default: 'from-gray-500 to-slate-500',
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) return '今天'
  if (diffDays === 1) return '昨天'
  if (diffDays < 7) return `${diffDays}天前`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}周前`
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

export default function Home() {
  const [featuredPosts, setFeaturedPosts] = useState<FeaturedPost[]>([])
  const [latestPosts, setLatestPosts] = useState<FeaturedPost[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [postsRes, latestRes, categoriesRes, statsRes] = await Promise.all([
        api.get('/posts?limit=6') as Promise<any>,
        api.get('/posts/latest?limit=5') as Promise<any>,
        api.get('/categories') as Promise<any>,
        api.get('/stats') as Promise<any>,
      ])
      setFeaturedPosts(postsRes.data.items)
      setLatestPosts(latestRes.data)
      setCategories(categoriesRes.data.slice(0, 8))
      setStats(statsRes.data)
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
          <p className="text-gray-500 dark:text-gray-400">加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700 text-white overflow-hidden">
        {/* 背景装饰 */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-pink-400 rounded-full blur-3xl" />
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-24">
          <div className="text-center">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6 animate-fade-in">
              💻 技术笔记博客
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-blue-100 mb-6 sm:mb-8 md:mb-10 max-w-2xl mx-auto leading-relaxed px-4">
              分享技术心得与实战经验，记录成长的每一步
            </p>
            <div className="flex flex-wrap justify-center gap-3 sm:gap-4 px-4">
              <Link
                to="/search"
                className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 bg-white text-blue-600 rounded-xl font-semibold hover:bg-blue-50 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
              >
                🔍 探索文章
              </Link>
              <Link
                to="/register"
                className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 bg-blue-500 bg-opacity-20 backdrop-blur-sm text-white rounded-xl font-semibold border border-white border-opacity-30 hover:bg-opacity-30 transition-all duration-300"
              >
                ✨ 加入我们
              </Link>
            </div>
          </div>
        </div>
        
        {/* 底部波浪 */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 120L60 110C120 100 240 80 360 70C480 60 600 60 720 65C840 70 960 80 1080 85C1200 90 1320 90 1380 90L1440 90V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z" className="fill-gray-50 dark:fill-gray-900"/>
          </svg>
        </div>
      </section>

      {/* Stats Section */}
      {stats && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 sm:-mt-10 relative z-10">
          <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-lg sm:shadow-xl p-4 sm:p-6 grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div className="text-center p-3 sm:p-4">
              <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-blue-600">{stats.totalPosts}</div>
              <div className="text-xs sm:text-sm text-gray-500 mt-1">📝 文章</div>
            </div>
            <div className="text-center p-3 sm:p-4 border-t sm:border-t-0 sm:border-l border-gray-100 dark:border-gray-700">
              <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-green-600">{stats.totalViews}</div>
              <div className="text-xs sm:text-sm text-gray-500 mt-1">👁 阅读</div>
            </div>
            <div className="text-center p-3 sm:p-4 border-t sm:border-t-0 sm:border-l border-gray-100 dark:border-gray-700">
              <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-purple-600">{stats.totalComments}</div>
              <div className="text-xs sm:text-sm text-gray-500 mt-1">💬 评论</div>
            </div>
            <div className="text-center p-3 sm:p-4 border-t sm:border-t-0 sm:border-l border-gray-100 dark:border-gray-700">
              <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-orange-600">{stats.totalCategories + stats.totalTags}</div>
              <div className="text-xs sm:text-sm text-gray-500 mt-1">🏷️ 标签</div>
            </div>
          </div>
        </section>
      )}

      {/* Featured Posts */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
        <div className="flex items-center justify-between mb-4 sm:mb-6 lg:mb-8">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold">✨ 最新文章</h2>
            <p className="text-gray-500 mt-1 hidden sm:block">发现最新最热门的技术内容</p>
          </div>
          <Link 
            to="/search" 
            className="px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
          >
            查看全部 →
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {featuredPosts.map((post, index) => (
            <article
              key={post.id}
              className="group bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {post.cover ? (
                <Link to={`/post/${post.slug}`} className="block">
                  <div className="relative overflow-hidden">
                    <img
                      src={post.cover}
                      alt={post.title}
                      className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>
              ) : (
                <div className="h-48 bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                  <span className="text-6xl opacity-50">📝</span>
                </div>
              )}
              <div className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Link 
                    to={`/category/${post.category_slug}`}
                    className="px-3 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded-full hover:bg-blue-200 transition-colors"
                  >
                    {post.category_name}
                  </Link>
                  <span className="text-xs text-gray-400">
                    {formatDate(post.created_at)}
                  </span>
                </div>
                <Link to={`/post/${post.slug}`}>
                  <h3 className="text-lg font-bold mb-2 group-hover:text-blue-600 transition-colors line-clamp-2">
                    {post.title}
                  </h3>
                </Link>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-2">
                  {post.excerpt || '暂无摘要...'}
                </p>
                <div className="flex items-center justify-between text-sm text-gray-500 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white text-xs">
                      {post.author_nickname[0]}
                    </div>
                    <span>{post.author_nickname}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      👁 {post.view_count}
                    </span>
                    <span className="flex items-center gap-1">
                      ❤️ {post.like_count}
                    </span>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-indigo-900 py-8 sm:py-12 lg:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-6 sm:mb-8 lg:mb-10">
            <h2 className="text-xl sm:text-2xl font-bold">📂 分类浏览</h2>
            <p className="text-gray-500 mt-2 hidden sm:block">按分类探索你感兴趣的内容</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-4">
            {categories.map((cat) => {
              const gradient = categoryGradients[cat.slug] || categoryGradients.default
              return (
              <Link
                key={cat.id}
                to={`/category/${cat.slug}`}
                className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl sm:rounded-2xl hover:shadow-lg transition-all duration-300 group text-center relative overflow-hidden"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-10 transition-opacity`} />
                <div className={`relative inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br ${gradient} mb-2 sm:mb-3 shadow-lg group-hover:scale-110 transition-transform`}>
                  <span className="text-2xl sm:text-3xl">{categoryIcons[cat.slug] || categoryIcons.default}</span>
                </div>
                <h3 className="font-semibold group-hover:text-blue-600 transition-colors mb-1 text-sm sm:text-base">
                  {cat.name}
                </h3>
                <p className="text-xs sm:text-sm text-gray-500">
                  {cat.post_count} 篇
                </p>
              </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* Latest Posts Sidebar Style */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Latest Posts */}
          <div className="lg:col-span-2">
            <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">🕐 最新动态</h2>
            <div className="space-y-2 sm:space-y-4">
              {latestPosts.map((post, index) => (
                <Link
                  key={post.id}
                  to={`/post/${post.slug}`}
                  className="flex gap-3 sm:gap-4 p-3 sm:p-4 bg-white dark:bg-gray-800 rounded-xl hover:shadow-md transition-all duration-300 group"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-sm sm:text-base">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold group-hover:text-blue-600 transition-colors truncate mb-1 text-sm sm:text-base">
                      {post.title}
                    </h3>
                    <div className="flex items-center gap-1 sm:gap-3 text-xs sm:text-sm text-gray-500">
                      <span className="hidden xs:inline">{post.category_name}</span>
                      <span className="hidden sm:inline">•</span>
                      <span>{formatDate(post.created_at)}</span>
                      <span className="hidden sm:inline">•</span>
                      <span className="hidden sm:inline">👁 {post.view_count}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">🔗 快捷入口</h2>
            <div className="space-y-2 sm:space-y-3">
              <Link
                to="/search"
                className="flex items-center gap-3 p-3 sm:p-4 bg-white dark:bg-gray-800 rounded-xl hover:shadow-md transition-all group"
              >
                <span className="text-xl sm:text-2xl">🔍</span>
                <span className="font-medium group-hover:text-blue-600 transition-colors text-sm sm:text-base">搜索文章</span>
              </Link>
              <Link
                to="/register"
                className="flex items-center gap-3 p-3 sm:p-4 bg-white dark:bg-gray-800 rounded-xl hover:shadow-md transition-all group"
              >
                <span className="text-xl sm:text-2xl">✍️</span>
                <span className="font-medium group-hover:text-blue-600 transition-colors text-sm sm:text-base">成为作者</span>
              </Link>
              <Link
                to="/login"
                className="flex items-center gap-3 p-3 sm:p-4 bg-white dark:bg-gray-800 rounded-xl hover:shadow-md transition-all group"
              >
                <span className="text-xl sm:text-2xl">🔑</span>
                <span className="font-medium group-hover:text-blue-600 transition-colors text-sm sm:text-base">登录账号</span>
              </Link>
            </div>

            {/* Tags Cloud */}
            <h3 className="text-lg sm:text-xl font-bold mt-6 sm:mt-8 mb-3 sm:mb-4">🏷️ 热门标签</h3>
            <div className="flex flex-wrap gap-2">
              {['JavaScript', 'Python', 'React', 'TypeScript', 'Docker', 'Git'].map((tag) => (
                <Link
                  key={tag}
                  to={`/tag/${tag.toLowerCase()}`}
                  className="px-2 sm:px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-xs sm:text-sm hover:bg-blue-100 hover:text-blue-600 transition-colors"
                >
                  {tag}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-700 text-white py-10 sm:py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3 sm:mb-4">准备好分享你的技术见解了吗？ 🚀</h2>
          <p className="text-blue-100 mb-6 sm:mb-8 text-base sm:text-lg px-4">
            加入我们的社区，发表你的第一篇文章
          </p>
          <Link
            to="/register"
            className="inline-block px-6 sm:px-10 py-3 sm:py-4 bg-white text-blue-600 rounded-xl font-semibold hover:bg-blue-50 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
          >
            开始写作 ✨
          </Link>
        </div>
      </section>
    </div>
  )
}
