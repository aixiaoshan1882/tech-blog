/**
 * 文章列表页
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAsync } from '@/hooks/useStore'
import { getPosts, deletePost } from '@/api/posts'
import dayjs from 'dayjs'
import type { Post } from '@/types'

export default function PostList() {
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState<'all' | 'published' | 'draft'>('all')
  
  const { data, loading, error, refetch } = useAsync(
    () => getPosts({ page, status: filter === 'all' ? undefined : filter }),
    [page, filter]
  )

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这篇文章吗？')) return
    try {
      await deletePost(id)
      refetch()
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除失败')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          文章管理
        </h1>
        <Link
          to="/admin/posts/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          ✍️ 新建文章
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-4">
        {(['all', 'published', 'draft'] as const).map(f => (
          <button
            key={f}
            onClick={() => { setFilter(f); setPage(1) }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            {f === 'all' ? '全部' : f === 'published' ? '已发布' : '草稿'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        {loading && (
          <div className="p-8 text-center text-gray-500">
            加载中...
          </div>
        )}

        {error && (
          <div className="p-4 text-red-600 dark:text-red-400">
            {error.message}
          </div>
        )}

        {!loading && data?.items.length === 0 && (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            暂无文章
          </div>
        )}

        {!loading && data && data.items.length > 0 && (
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  标题
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  分类
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  状态
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  日期
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {data.items.map((post: Post) => (
                <tr key={post.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-6 py-4">
                    <Link
                      to={`/post/${post.slug}`}
                      target="_blank"
                      className="font-medium text-gray-900 dark:text-gray-100 hover:text-blue-600"
                    >
                      {post.title}
                    </Link>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {post.viewCount || post.view_count} 阅读 · {post.commentCount || 0} 评论
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                    {post.category?.name || '未分类'}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-1 text-xs rounded ${
                        post.is_public === 1
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                      }`}
                    >
                      {post.is_public === 1 ? '已发布' : '私密'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-500 dark:text-gray-400 text-sm">
                    {dayjs(post.created_at).format('YYYY-MM-DD')}
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <Link
                      to={`/admin/posts/${post.id}/edit`}
                      className="text-blue-600 hover:text-blue-700 text-sm"
                    >
                      编辑
                    </Link>
                    <button
                      onClick={() => handleDelete(post.id)}
                      className="text-red-600 hover:text-red-700 text-sm"
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {data && data.total > data.pageSize && (
        <div className="flex items-center justify-center space-x-4">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            上一页
          </button>
          <span className="text-gray-500 dark:text-gray-400">
            第 {page} / {Math.ceil(data.total / data.pageSize)} 页
          </span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page >= Math.ceil(data.total / data.pageSize)}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            下一页
          </button>
        </div>
      )}
    </div>
  )
}
