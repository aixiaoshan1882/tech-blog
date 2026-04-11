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

export default function Home() {
  const [featuredPosts, setFeaturedPosts] = useState<FeaturedPost[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [postsRes, categoriesRes] = await Promise.all([
        api.get('/posts?limit=6') as any,
        api.get('/categories') as any,
      ])
      setFeaturedPosts(postsRes.data.items)
      setCategories(categoriesRes.data.slice(0, 8))
    } catch (error) {
      console.error('获取数据失败', error)
    }
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-600 to-purple-700 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            🚀 技术笔记博客
          </h1>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            分享技术心得与实战经验，记录成长的每一步
          </p>
          <div className="flex justify-center gap-4">
            <Link
              to="/search"
              className="px-6 py-3 bg-white text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition-colors"
            >
              探索文章
            </Link>
            <Link
              to="/register"
              className="px-6 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-400 transition-colors"
            >
              加入我们
            </Link>
          </div>
        </div>
      </section>

      {/* Featured Posts */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold">📌 最新文章</h2>
          <Link to="/search" className="text-blue-600 hover:text-blue-700">
            查看全部 →
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {featuredPosts.map((post) => (
            <article
              key={post.id}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden hover:shadow-lg transition-shadow"
            >
              {post.cover && (
                <Link to={`/post/${post.slug}`}>
                  <img
                    src={post.cover}
                    alt={post.title}
                    className="w-full h-48 object-cover"
                  />
                </Link>
              )}
              <div className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">
                    {post.category_name}
                  </span>
                </div>
                <Link to={`/post/${post.slug}`}>
                  <h3 className="text-lg font-bold mb-2 hover:text-blue-600 transition-colors">
                    {post.title}
                  </h3>
                </Link>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-2">
                  {post.excerpt || '暂无摘要...'}
                </p>
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <span>{post.author_nickname}</span>
                  <div className="flex items-center gap-4">
                    <span>👁 {post.view_count}</span>
                    <span>❤️ {post.like_count}</span>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="bg-gray-50 dark:bg-gray-900 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold mb-8">📂 分类浏览</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                to={`/category/${cat.slug}`}
                className="bg-white dark:bg-gray-800 p-4 rounded-lg hover:shadow-md transition-shadow group"
              >
                <h3 className="font-medium group-hover:text-blue-600 transition-colors">
                  {cat.name}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {cat.post_count} 篇文章
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl p-8 text-white text-center">
          <h2 className="text-2xl font-bold mb-6">📊 博客数据</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <div className="text-4xl font-bold mb-2">100+</div>
              <div className="text-blue-100">技术文章</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">10K+</div>
              <div className="text-blue-100">总阅读量</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">1K+</div>
              <div className="text-blue-100">社区用户</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">50+</div>
              <div className="text-blue-100">分类标签</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold mb-4">准备好分享你的技术见解了吗？</h2>
          <p className="text-gray-400 mb-6">
            加入我们的社区，发表你的第一篇文章
          </p>
          <Link
            to="/register"
            className="inline-block px-8 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors"
          >
            开始写作
          </Link>
        </div>
      </section>
    </div>
  )
}
