/**
 * 评论组件
 */

import { useState } from 'react'
import { useAsync } from '@/hooks/useStore'
import { getComments, createComment } from '@/api/comments'
import { authStore } from '@/store/authStore'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'

dayjs.locale('zh-cn')

interface CommentsProps {
  postId: number
}

export function Comments({ postId }: CommentsProps) {
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(0)

  const { data: comments, loading, error: loadError } = useAsync(
    () => getComments({ postId }).then(r => r.items),
    [postId, refreshing]
  )

  const user = authStore.getState().user
  const isLoggedIn = !!user

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return

    setError('')
    setSubmitting(true)

    try {
      await createComment({ postId, content: content.trim() })
      setContent('')
      setRefreshing(r => r + 1) // 刷新评论列表
    } catch (err) {
      setError(err instanceof Error ? err.message : '评论失败')
    } finally {
      setSubmitting(false)
    }
  }

  // 渲染单条评论
  const renderComment = (comment: any) => (
    <div key={comment.id} className="flex gap-3 py-4">
      <img
        src={comment.author_avatar || comment.author?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${comment.author_name || comment.author?.nickname || 'Anonymous'}`}
        alt={comment.author_name || comment.author?.nickname || '匿名用户'}
        className="w-10 h-10 rounded-full flex-shrink-0"
      />
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-gray-900 dark:text-gray-100">
            {comment.author_name || comment.author?.nickname || '匿名用户'}
          </span>
          <span className="text-sm text-gray-400">
            {dayjs(comment.created_at || comment.createdAt).format('YYYY-MM-DD HH:mm')}
          </span>
        </div>
        <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
          {comment.content}
        </p>
        <div className="mt-2 flex gap-4">
          <button className="text-sm text-gray-400 hover:text-blue-500 transition-colors">
            回复
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="mt-12 border-t border-gray-200 dark:border-gray-700 pt-8">
      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">
        评论 ({comments?.length || 0})
      </h2>

      {/* 发表评论 */}
      <div className="mb-8">
        {isLoggedIn ? (
          <form onSubmit={handleSubmit}>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="写下你的评论..."
              rows={4}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {error && (
              <p className="mt-2 text-sm text-red-500">{error}</p>
            )}
            <div className="mt-3 flex justify-end">
              <button
                type="submit"
                disabled={submitting || !content.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? '提交中...' : '发表评论'}
              </button>
            </div>
          </form>
        ) : (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 text-center">
            <p className="text-gray-500 dark:text-gray-400 mb-3">
              登录后即可参与评论
            </p>
            <a
              href="/login"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              登录
            </a>
          </div>
        )}
      </div>

      {/* 评论列表 */}
      <div>
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse flex gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700" />
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-2" />
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : loadError ? (
          <p className="text-red-500">加载评论失败</p>
        ) : comments?.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">
            暂无评论，来发表第一篇评论吧！
          </p>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {comments?.map(comment => renderComment(comment))}
          </div>
        )}
      </div>
    </div>
  )
}
