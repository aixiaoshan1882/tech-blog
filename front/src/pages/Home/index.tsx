import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, getCategories, getHotTags, getLatestPosts, getPublishedPosts } from '@/api'
import type { Category, Post, Stats, Tag } from '@/types'

function formatDate(dateStr?: string) {
  if (!dateStr) return '刚刚'

  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays <= 0) return '今天'
  if (diffDays === 1) return '昨天'
  if (diffDays < 7) return `${diffDays} 天前`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} 周前`
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

function postCategory(post: Post) {
  return post.category || {
    id: post.category_id,
    name: post.category_name || '未分类',
    slug: post.category_slug || 'uncategorized',
  }
}

function authorName(post: Post) {
  return post.author?.nickname || '博主'
}

export default function Home() {
  const [featuredPosts, setFeaturedPosts] = useState<Post[]>([])
  const [latestPosts, setLatestPosts] = useState<Post[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function fetchData() {
      setLoading(true)
      setError(null)
      try {
        const [postsRes, latestRes, categoriesRes, tagsRes, statsRes] = await Promise.all([
          getPublishedPosts({ pageSize: 6 }),
          getLatestPosts(5),
          getCategories(),
          getHotTags(10),
          api.get<Stats>('/stats'),
        ])

        if (!mounted) return
        setFeaturedPosts(postsRes.items)
        setLatestPosts(latestRes)
        setCategories(categoriesRes.slice(0, 8))
        setTags(tagsRes)
        setStats(statsRes)
      } catch (err) {
        console.error('获取首页数据失败', err)
        if (mounted) setError('首页数据暂时不可用，请稍后刷新。')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    fetchData()
    return () => {
      mounted = false
    }
  }, [])

  const leadPost = featuredPosts[0]
  const secondaryPosts = featuredPosts.slice(1)

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="w-full max-w-5xl animate-pulse space-y-8">
          <div className="h-72 rounded-lg bg-gray-200 dark:bg-gray-800" />
          <div className="grid gap-4 sm:grid-cols-3">
            {[1, 2, 3].map(item => (
              <div key={item} className="h-44 rounded-lg bg-gray-200 dark:bg-gray-800" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <section className="relative overflow-hidden bg-gray-950 text-white">
        <img
          src="/images/tech-workspace.png"
          alt="技术工作台"
          className="absolute inset-0 h-full w-full object-cover opacity-45"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-gray-950 via-gray-950/90 to-gray-950/30" />
        <div className="relative mx-auto grid min-h-[460px] max-w-7xl content-center gap-8 px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-teal-200">
              Engineering Notes
            </p>
            <h1 className="text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
              技术笔记博客
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-gray-200 sm:text-lg">
              聚合前端、后端、工程化与 AI 实践，把问题拆开，把经验写清楚。
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/search"
                className="inline-flex min-h-11 items-center rounded-lg bg-teal-400 px-5 text-sm font-semibold text-gray-950 hover:bg-teal-300"
              >
                浏览文章
              </Link>
              {leadPost && (
                <Link
                  to={`/post/${leadPost.slug}`}
                  className="inline-flex min-h-11 items-center rounded-lg border border-white/30 px-5 text-sm font-semibold text-white hover:bg-white/10"
                >
                  阅读最新文章
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            {error}
          </div>
        </div>
      )}

      {stats && (
        <section className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px px-4 py-6 sm:grid-cols-4 sm:px-6 lg:px-8">
            {[
              ['文章', stats.totalPosts],
              ['阅读', stats.totalViews],
              ['评论', stats.totalComments],
              ['分类与标签', stats.totalCategories + stats.totalTags],
            ].map(([label, value]) => (
              <div key={label} className="px-2 py-3">
                <div className="text-2xl font-bold text-gray-950 dark:text-white">
                  {Number(value).toLocaleString()}
                </div>
                <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">{label}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-950 dark:text-white">最新文章</h2>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">优先展示最近更新的技术实践和复盘。</p>
          </div>
          <Link to="/search" className="shrink-0 text-sm font-semibold text-teal-700 hover:text-teal-600 dark:text-teal-300">
            查看全部
          </Link>
        </div>

        {leadPost ? (
          <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
            <article className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <Link to={`/post/${leadPost.slug}`} className="block">
                <div className="aspect-[16/7] bg-gray-200 dark:bg-gray-800">
                  {leadPost.coverImage ? (
                    <img src={leadPost.coverImage} alt={leadPost.title} className="h-full w-full object-cover" />
                  ) : (
                    <img src="/images/tech-workspace.png" alt="" className="h-full w-full object-cover" />
                  )}
                </div>
              </Link>
              <div className="p-5 sm:p-6">
                <div className="mb-3 flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                  <Link
                    to={`/category/${postCategory(leadPost).slug}`}
                    className="font-semibold text-teal-700 hover:text-teal-600 dark:text-teal-300"
                  >
                    {postCategory(leadPost).name}
                  </Link>
                  <span>{formatDate(leadPost.publishedAt || leadPost.created_at)}</span>
                  <span>{(leadPost.viewCount || leadPost.view_count || 0).toLocaleString()} 阅读</span>
                </div>
                <Link to={`/post/${leadPost.slug}`}>
                  <h3 className="text-2xl font-bold leading-snug text-gray-950 hover:text-teal-700 dark:text-white dark:hover:text-teal-300">
                    {leadPost.title}
                  </h3>
                </Link>
                <p className="mt-3 line-clamp-2 text-gray-600 dark:text-gray-400">
                  {leadPost.excerpt || '暂无摘要。'}
                </p>
                <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-4 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
                  <span>{authorName(leadPost)}</span>
                  <Link to={`/post/${leadPost.slug}`} className="font-semibold text-gray-900 hover:text-teal-700 dark:text-gray-100">
                    继续阅读
                  </Link>
                </div>
              </div>
            </article>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              {secondaryPosts.slice(0, 4).map(post => (
                <Link
                  key={post.id}
                  to={`/post/${post.slug}`}
                  className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:border-teal-300 hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
                >
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                    {postCategory(post).name}
                  </div>
                  <h3 className="line-clamp-2 font-semibold leading-6 text-gray-950 dark:text-white">
                    {post.title}
                  </h3>
                  <p className="mt-2 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">
                    {post.excerpt || '暂无摘要。'}
                  </p>
                  <div className="mt-4 text-xs text-gray-400">
                    {formatDate(post.publishedAt || post.created_at)}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
            暂无文章，创建第一篇内容后这里会自动展示。
          </div>
        )}
      </section>

      <section className="border-y border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_320px] lg:px-8">
          <div>
            <div className="mb-5 flex items-end justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-950 dark:text-white">分类浏览</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">按主题快速进入文章集合。</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {categories.map(category => (
                <Link
                  key={category.id}
                  to={`/category/${category.slug}`}
                  className="rounded-lg border border-gray-200 p-4 transition hover:border-teal-300 hover:bg-teal-50 dark:border-gray-800 dark:hover:bg-teal-950/30"
                >
                  <div className="font-semibold text-gray-950 dark:text-white">{category.name}</div>
                  <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    {(category.postCount || 0).toLocaleString()} 篇文章
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <aside>
            <h2 className="text-xl font-bold text-gray-950 dark:text-white">热门标签</h2>
            <div className="mt-5 flex flex-wrap gap-2">
              {tags.map(tag => (
                <Link
                  key={tag.id}
                  to={`/tag/${tag.slug}`}
                  className="rounded-full border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:border-amber-300 hover:bg-amber-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-amber-950/30"
                >
                  #{tag.name}
                </Link>
              ))}
            </div>
          </aside>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-950 dark:text-white">最新动态</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">最近发布和更新的文章。</p>
          </div>
        </div>
        <div className="divide-y divide-gray-200 overflow-hidden rounded-lg border border-gray-200 bg-white dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-900">
          {latestPosts.map(post => (
            <Link
              key={post.id}
              to={`/post/${post.slug}`}
              className="grid gap-2 px-4 py-4 transition hover:bg-gray-50 dark:hover:bg-gray-800 sm:grid-cols-[1fr_auto] sm:items-center"
            >
              <div>
                <h3 className="font-semibold text-gray-950 dark:text-white">{post.title}</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {postCategory(post).name} · {authorName(post)}
                </p>
              </div>
              <div className="text-sm text-gray-400">{formatDate(post.publishedAt || post.created_at)}</div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
