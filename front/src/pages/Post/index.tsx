/**
 * 文章详情页
 */

import { useParams, Link } from 'react-router-dom'
import { useState } from 'react'
import { useAsync } from '@/hooks/useStore'
import { getPost, likePost } from '@/api/posts'
import { Markdown } from '@/components/Markdown'
import { Comments } from '@/components/Comments'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'

dayjs.locale('zh-cn')

export default function Post() {
  const { slug } = useParams<{ slug: string }>()
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [showShare, setShowShare] = useState(false)
  
  const { data: post, loading, error } = useAsync(
    () => getPost(slug!).then(p => {
      setLikeCount(p.likeCount || 0)
      return p
    }),
    [slug]
  )

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
        console.log('分享取消')
      }
    } else {
      setShowShare(!showShare)
    }
  }

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    alert('链接已复制到剪贴板！')
    setShowShare(false)
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-2xl mb-8" />
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4" />
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-8" />
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !post) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-20">
          <p className="text-8xl mb-6">😢</p>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3">
            文章不存在
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mb-8">
            该文章可能已被删除或移动
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-lg"
          >
            🏠 返回首页
          </Link>
        </div>
      </div>
    )
  }

  return (
    <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Cover Image */}
      {post.coverImage && (
        <div className="mb-8 -mx-4 sm:mx-0">
          <img
            src={post.coverImage}
            alt={post.title}
            className="w-full h-64 md:h-96 object-cover rounded-2xl shadow-xl"
          />
        </div>
      )}

      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          {post.category && (
            <>
              <Link
                to={`/category/${post.category.slug}`}
                className="px-4 py-1.5 text-sm font-medium bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-full hover:shadow-md hover:shadow-blue-500/30 transition-all"
              >
                📁 {post.category.name}
              </Link>
              <span className="text-gray-300">•</span>
            </>
          )}
          <span className="text-sm text-gray-500 dark:text-gray-400">
            📅 {dayjs(post.publishedAt || post.created_at).format('YYYY年MM月DD日')}
          </span>
          <span className="text-gray-300">•</span>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            👁 {post.viewCount} 阅读
          </span>
        </div>

        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-6 leading-tight">
          {post.title}
        </h1>

        <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl">
          <img
            src={post.author?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${post.author?.nickname}`}
            alt={post.author?.nickname}
            className="w-12 h-12 rounded-full ring-2 ring-blue-500"
          />
          <div className="flex-1">
            <p className="font-semibold text-gray-900 dark:text-gray-100">
              {post.author?.nickname}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {post.author?.role === 'admin' ? '✨ 博主' : '✍️ 作者'}
            </p>
          </div>
        </div>
      </header>

      {/* Tags */}
      {post.tags && post.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-8">
          {post.tags.map(tag => (
            <Link
              key={tag.id}
              to={`/tag/${tag.slug}`}
              className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full hover:bg-blue-100 hover:text-blue-600 dark:hover:bg-blue-900/50 dark:hover:text-blue-400 transition-all"
            >
              🏷️ {tag.name}
            </Link>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="prose prose-lg max-w-none">
        <Markdown content={post.content} />
      </div>

      {/* Actions */}
      <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={handleLike}
              disabled={liked}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full transition-all ${
                liked 
                  ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 cursor-not-allowed' 
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30'
              }`}
            >
              <span className="text-xl">{liked ? '❤️' : '🤍'}</span>
              <span className="font-medium">{likeCount} 点赞</span>
            </button>
            
            <div className="relative">
              <button 
                onClick={handleShare}
                className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full hover:bg-blue-100 hover:text-blue-600 transition-all"
              >
                <span className="text-xl">🔗</span>
                <span className="font-medium">分享</span>
              </button>
              
              {showShare && (
                <div className="absolute bottom-full left-0 mb-2 bg-white dark:bg-gray-800 rounded-xl shadow-xl p-2 min-w-[160px] z-10">
                  <button 
                    onClick={copyLink}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    📋 复制链接
                  </button>
                  <button className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                    💬 发送到微信
                  </button>
                  <button className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                    🐦 分享到微博
                  </button>
                </div>
              )}
            </div>
          </div>
          
          <Link
            to="/"
            className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors"
          >
            ← 返回首页
          </Link>
        </div>
      </div>

      {/* Related Posts Placeholder */}
      <div className="mt-12 p-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-800/50 dark:to-indigo-900/50 rounded-2xl">
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
    </article>
  )
}
