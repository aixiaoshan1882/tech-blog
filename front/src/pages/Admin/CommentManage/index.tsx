/**
 * 评论管理页
 */

import { useState } from 'react'
import { useAsync } from '@/hooks/useStore'
import { getComments, deleteComment } from '@/api/comments'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'

dayjs.locale('zh-cn')

export default function CommentManage() {
  const [page, setPage] = useState(1)
  const { data, loading, error, refetch } = useAsync(
    () => getComments({ page, pageSize: 20 }),
    [page]
  )

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这条评论吗？')) return
    try {
      await deleteComment(id)
      refetch()
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除失败')
    }
  }

  if (loading) return <div className="p-8 text-center">加载中...</div>
  if (error) return <div className="p-4 text-red-500">加载失败: {error.message}</div>

  const comments = data?.items || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          评论管理
        </h1>
      </div>

      {/* 评论列表 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">内容</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">文章</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">昵称</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">时间</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {comments.map((comment: any) => (
              <tr key={comment.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-6 py-4">
                  <p className="text-gray-900 dark:text-gray-100 line-clamp-2">{comment.content}</p>
                </td>
                <td className="px-6 py-4 text-gray-500 dark:text-gray-400 text-sm">
                  {comment.post?.title || '文章已删除'}
                </td>
                <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                  {comment.nickname || comment.author?.nickname || '匿名'}
                </td>
                <td className="px-6 py-4 text-gray-500 dark:text-gray-400 text-sm">
                  {dayjs(comment.created_at || comment.createdAt).format('YYYY-MM-DD HH:mm')}
                </td>
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={() => handleDelete(comment.id)}
                    className="text-red-600 hover:text-red-700 text-sm"
                  >
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {comments.length === 0 && (
          <div className="p-8 text-center text-gray-500">暂无评论</div>
        )}
      </div>

      {/* 分页 */}
      {data && data.total > data.pageSize && (
        <div className="flex items-center justify-center space-x-4">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg disabled:opacity-50"
          >
            上一页
          </button>
          <span className="text-gray-500">
            第 {page} / {Math.ceil(data.total / data.pageSize)} 页
          </span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page >= Math.ceil(data.total / data.pageSize)}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg disabled:opacity-50"
          >
            下一页
          </button>
        </div>
      )}
    </div>
  )
}
