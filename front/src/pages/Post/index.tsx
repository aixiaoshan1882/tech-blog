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
        <div className="text-center py-12">
          <p className="text-6xl mb-4">😢</p>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            文章不存在
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            该文章可能已被删除或移动
          </p>
          <Link
            to="/"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            返回首页
          </Link>
        </div>
      </div>
    )
  }

  return (
    <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Cover Image */}
      {post.coverImage && (
        <img
          src={post.coverImage}
          alt={post.title}
          className="w-full h-64 md:h-96 object-cover rounded-2xl mb-8"
        />
      )}

      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center space-x-3 mb-4">
          <Link
            to={`/category/${post.category?.slug}`}
            className="px-3 py-1 text-sm font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-full hover:bg-blue-200 dark:hover:bg-blue-900"
          >
            {post.category?.name}
          </Link>
          <span className="text-gray-400">·</span>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {dayjs(post.publishedAt || post.created_at).format('YYYY年MM月DD日')}
          </span>
          <span className="text-gray-400">·</span>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {post.viewCount} 阅读
          </span>
        </div>

        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          {post.title}
        </h1>

        <div className="flex items-center">
          <img
            src={post.author?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${post.author?.nickname}`}
            alt={post.author?.nickname}
            className="w-10 h-10 rounded-full mr-3"
          />
          <div>
            <p className="font-medium text-gray-900 dark:text-gray-100">
              {post.author?.nickname}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {post.author?.role === 'admin' ? '博主' : '作者'}
            </p>
          </div>
        </div>
      </header>

      {/* Tags */}
      {post.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-8">
          {post.tags.map(tag => (
            <Link
              key={tag.id}
              to={`/tag/${tag.slug}`}
              className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
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

      {/* Actions */}
      <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button 
              onClick={handleLike}
              className={`flex items-center space-x-2 transition-colors ${
                liked 
                  ? 'text-red-500' 
                  : 'text-gray-500 dark:text-gray-400 hover:text-red-500'
              }`}
            >
              <span className="text-xl">{liked ? '❤️' : '🤍'}</span>
              <span>{likeCount}</span>
            </button>
            <button className="flex items-center space-x-2 text-gray-500 dark:text-gray-400 hover:text-blue-500 transition-colors">
              <span className="text-xl">🔗</span>
              <span>分享</span>
            </button>
          </div>
          <Link
            to="/"
            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
          >
            ← 返回首页
          </Link>
        </div>
      </div>

      {/* Comments */}
      <Comments postId={post.id} />
    </article>
  )
}
