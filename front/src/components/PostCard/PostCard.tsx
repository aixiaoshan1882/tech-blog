/**
 * PostCard 组件 - 文章卡片
 */

import { Link } from 'react-router-dom'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import type { Post } from '@/types'
import { transformPost } from '@/types'

dayjs.locale('zh-cn')

interface PostCardProps {
  post: Post | any  // 接受原始数据
  variant?: 'default' | 'compact' | 'featured'
}

export function PostCard({ post: rawPost, variant = 'default' }: PostCardProps) {
  // 确保数据是转换后的格式
  const post = rawPost.category ? rawPost : transformPost(rawPost)

  // 获取分类信息
  const category = post.category || { name: '未分类', slug: 'uncategorized' }
  const author = post.author || { nickname: '匿名', avatar: undefined }

  if (variant === 'compact') {
    return (
      <div className="py-4 border-b border-gray-200 dark:border-gray-700 last:border-0">
        <Link to={`/post/${post.slug}`} className="group">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-1">
            {post.title}
          </h3>
          <div className="mt-1 flex items-center text-sm text-gray-500 dark:text-gray-400">
            <span>{dayjs(post.publishedAt || post.created_at).format('MMM D, YYYY')}</span>
            <span className="mx-2">·</span>
            <span>{post.viewCount || post.view_count} 阅读</span>
          </div>
        </Link>
      </div>
    )
  }

  if (variant === 'featured') {
    return (
      <article className="group relative overflow-hidden rounded-2xl">
        {post.coverImage && (
          <img
            src={post.coverImage}
            alt={post.title}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <div className="flex items-center space-x-2 mb-2">
            <span className="px-2 py-0.5 text-xs font-medium bg-blue-600 text-white rounded">
              {category.name}
            </span>
          </div>
          <Link to={`/post/${post.slug}`}>
            <h2 className="text-2xl font-bold text-white mb-2 group-hover:text-blue-300 transition-colors">
              {post.title}
            </h2>
          </Link>
          <p className="text-gray-300 line-clamp-2 mb-3">
            {post.excerpt || post.content?.slice(0, 100)}
          </p>
          <div className="flex items-center text-sm text-gray-400">
            <img
              src={author.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${author.nickname}`}
              alt={author.nickname}
              className="w-6 h-6 rounded-full mr-2"
            />
            <span>{author.nickname}</span>
            <span className="mx-2">·</span>
            <span>{dayjs(post.publishedAt || post.created_at).format('YYYY年MM月DD日')}</span>
          </div>
        </div>
      </article>
    )
  }

  // Default variant
  return (
    <article className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {post.coverImage && (
        <Link to={`/post/${post.slug}`}>
          <img
            src={post.coverImage}
            alt={post.title}
            className="w-full h-48 object-cover"
          />
        </Link>
      )}
      <div className="p-5">
        <div className="flex items-center space-x-2 mb-3">
          <Link
            to={`/category/${category.slug}`}
            className="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded hover:bg-blue-200 dark:hover:bg-blue-900"
          >
            {category.name}
          </Link>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {dayjs(post.publishedAt || post.created_at).format('YYYY-MM-DD')}
          </span>
        </div>

        <Link to={`/post/${post.slug}`}>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2 hover:text-blue-600 dark:hover:text-blue-400 transition-colors line-clamp-2">
            {post.title}
          </h2>
        </Link>

        <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-2">
          {post.excerpt || post.content?.slice(0, 120)}
        </p>

        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <img
              src={author.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${author.nickname}`}
              alt={author.nickname}
              className="w-6 h-6 rounded-full mr-2"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {author.nickname}
            </span>
          </div>

          <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
            <span>👁 {post.viewCount || post.view_count}</span>
            <span>💬 {post.commentCount || 0}</span>
          </div>
        </div>

        {post.tags?.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {post.tags.slice(0, 3).map((tag: any) => (
              <Link
                key={tag.id}
                to={`/tag/${tag.slug}`}
                className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                #{tag.name}
              </Link>
            ))}
          </div>
        )}
      </div>
    </article>
  )
}
