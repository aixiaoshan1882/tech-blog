/**
 * 文章详情页 - 移动端优化
 */

import { useParams, Link } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { useAsync } from '@/hooks/useStore'
import { getPost, likePost } from '@/api/posts'
import { Markdown } from '@/components/Markdown'
import { Comments } from '@/components/Comments'
import { NotFound } from '@/components/Empty'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'

dayjs.locale('zh-cn')

export default function Post() {
  const { slug } = useParams<{ slug: string }>()
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [showShare, setShowShare] = useState(false)
  const shareRef = useRef<HTMLDivElement>(null)
  
  const { data: post, loading, error } = useAsync(
    () => getPost(slug!).then(p => {
      setLikeCount(p.likeCount || 0)
      return p
    }),
    [slug]
  )

  // 点击外部关闭分享菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (shareRef.current && !shareRef.current.contains(event.target as Node)) {
        setShowShare(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLike = async () => {
    if (liked || !post) return
    try {
      const result = await likePost(post.id)
      setLikeCount(result.like_count)
      setLiked(true)
    } catch (err) {
      console.error('点赞失败', err)
    }
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: post?.title,
          text: post?.excerpt,
          url: window.location.href,
        })
      } catch (err) {
        // 用户取消分享
      }
    } else {
      setShowShare(!showShare)
    }
  }

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    setShowShare(false)
    // 使用更友好的提示
    const toast = document.createElement('div')
    toast.className = 'fixed top-20 left-1/2 -translate-x-1/2 px-6 py-3 bg-gray-900 text-white rounded-xl shadow-lg z-50 animate-fade-in'
    toast.textContent = '✅ 链接已复制到剪贴板'
    document.body.appendChild(toast)
    setTimeout(() => toast.remove(), 2000)
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="animate-pulse">
          {/* 封面骨架屏 */}
          <div className="aspect-video bg-gray-200 dark:bg-gray-700 rounded-2xl mb-6 sm:mb-8" />
          {/* 标题骨架屏 */}
          <div className="space-y-3 mb-6">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-full w-24" />
            <div className="h-8 sm:h-10 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
          </div>
          {/* 作者骨架屏 */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full" />
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24" />
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16" />
            </div>
          </div>
          {/* 内容骨架屏 */}
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-4 bg-gray-200 dark:bg-gray-700 rounded" style={{ width: `${100 - i * 5}%` }} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error || !post) {
    return <NotFound title="文章不存在" description="该文章可能已被删除或移动" />
  }

  return (
    <article className="pb-20 sm:pb-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Cover Image */}
        {post.coverImage && (
          <div className="mb-6 sm:mb-8 -mx-4 sm:mx-0">
            <img
              src={post.coverImage}
              alt={post.title}
              className="w-full aspect-video object-cover rounded-none sm:rounded-2xl shadow-none sm:shadow-xl"
              loading="lazy"
            />
          </div>
        )}

        {/* Header */}
        <header className="mb-6 sm:mb-8">
          {/* Category & Meta */}
          <div className="flex items-center gap-2 sm:gap-3 mb-3 flex-wrap">
            {post.category && (
              <Link
                to={`/category/${post.category.slug}`}
                className="px-3 sm:px-4 py-1 sm:py-1.5 text-xs sm:text-sm font-medium bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-full hover:shadow-md transition-all"
              >
                {post.category.name}
              </Link>
            )}
            <span className="hidden sm:inline text-gray-300">•</span>
            <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              {dayjs(post.publishedAt || post.created_at).format('YYYY-MM-DD')}
            </span>
            <span className="hidden sm:inline text-gray-300">•</span>
            <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              👁 {post.viewCount || 0}
            </span>
          </div>

          {/* Title */}
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4 sm:mb-6 leading-tight">
            {post.title}
          </h1>

          {/* Author */}
          <div className="flex items-center gap-3 p-3 sm:p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl sm:rounded-2xl">
            <img
              src={post.author?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${post.author?.nickname}`}
              alt={post.author?.nickname}
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-full ring-2 ring-blue-500"
            />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                {post.author?.nickname}
              </p>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                {post.author?.role === 'admin' ? '✨ 博主' : '✍️ 作者'}
              </p>
            </div>
          </div>
        </header>

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6 sm:mb-8">
            {post.tags.map(tag => (
              <Link
                key={tag.id}
                to={`/tag/${tag.slug}`}
                className="px-3 py-1 text-xs sm:text-sm bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full hover:bg-blue-100 hover:text-blue-600 dark:hover:bg-blue-900/50 dark:hover:text-blue-400 transition-all"
              >
                #{tag.name}
              </Link>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="prose prose-lg max-w-none">
          <Markdown content={post.content} />
        </div>

        {/* Actions - Desktop */}
        <div className="hidden sm:block mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <button 
                onClick={handleLike}
                disabled={liked}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full transition-all ${
                  liked 
                    ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 cursor-not-allowed' 
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-red-100 hover:text-red-600'
                }`}
              >
                <span className="text-xl">{liked ? '❤️' : '🤍'}</span>
                <span className="font-medium">{likeCount} 点赞</span>
              </button>
              
              <div className="relative" ref={shareRef}>
                <button 
                  onClick={handleShare}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full hover:bg-blue-100 hover:text-blue-600 transition-all"
                >
                  <span className="text-xl">🔗</span>
                  <span className="font-medium">分享</span>
                </button>
                
                {showShare && (
                  <div className="absolute bottom-full left-0 mb-2 bg-white dark:bg-gray-800 rounded-xl shadow-xl p-2 min-w-[160px] z-20 animate-fade-in">
                    <button 
                      onClick={copyLink}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex items-center gap-2"
                    >
                      📋 复制链接
                    </button>
                    <button className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex items-center gap-2">
                      💬 发送到微信
                    </button>
                    <button className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex items-center gap-2">
                      🐦 分享到微博
                    </button>
                  </div>
                )}
              </div>
            </div>
            
            <Link
              to="/"
              className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 font-medium transition-colors"
            >
              ← 返回首页
            </Link>
          </div>
        </div>

        {/* Related Posts Placeholder */}
        <div className="hidden sm:block mt-12 p-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-800/50 dark:to-indigo-900/50 rounded-2xl">
          <h3 className="font-bold text-lg mb-3">📚 推荐阅读</h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            探索更多精彩内容，发现更多技术见解
          </p>
          <Link
            to="/search"
            className="inline-flex items-center gap-2 mt-3 text-blue-600 dark:text-blue-400 hover:text-blue-700 font-medium"
          >
            浏览更多文章 →
          </Link>
        </div>

        {/* Comments */}
        <div className="mt-12">
          <Comments postId={post.id} />
        </div>
      </div>

      {/* Mobile Bottom Bar */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 px-4 py-3 z-40 pb-safe">
        <div className="flex items-center justify-between gap-4">
          <button 
            onClick={handleLike}
            disabled={liked}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all ${
              liked 
                ? 'bg-red-100 text-red-600' 
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
            }`}
          >
            <span>{liked ? '❤️' : '🤍'}</span>
            <span className="text-sm font-medium">{likeCount}</span>
          </button>
          
          <button 
            onClick={handleShare}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-xl"
          >
            <span>🔗</span>
            <span className="text-sm font-medium">分享</span>
          </button>
          
          <Link
            to="/"
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-xl"
          >
            <span>🏠</span>
            <span className="text-sm font-medium">首页</span>
          </Link>
        </div>
      </div>

      {/* Mobile Share Modal */}
      {showShare && (
        <>
          <div 
            className="sm:hidden fixed inset-0 bg-black/50 z-50 animate-fade-in"
            onClick={() => setShowShare(false)}
          />
          <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 rounded-t-2xl p-6 z-50 animate-slide-in-top pb-8">
            <div className="w-12 h-1 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mb-6" />
            <h3 className="font-bold text-lg mb-4 text-center">分享到</h3>
            <div className="grid grid-cols-4 gap-4">
              <button 
                onClick={copyLink}
                className="flex flex-col items-center gap-2 p-3"
              >
                <span className="text-3xl">📋</span>
                <span className="text-xs text-gray-600 dark:text-gray-400">复制</span>
              </button>
              <button className="flex flex-col items-center gap-2 p-3">
                <span className="text-3xl">💬</span>
                <span className="text-xs text-gray-600 dark:text-gray-400">微信</span>
              </button>
              <button className="flex flex-col items-center gap-2 p-3">
                <span className="text-3xl">🐦</span>
                <span className="text-xs text-gray-600 dark:text-gray-400">微博</span>
              </button>
              <button className="flex flex-col items-center gap-2 p-3">
                <span className="text-3xl">🔖</span>
                <span className="text-xs text-gray-600 dark:text-gray-400">收藏</span>
              </button>
            </div>
          </div>
        </>
      )}
    </article>
  )
}
