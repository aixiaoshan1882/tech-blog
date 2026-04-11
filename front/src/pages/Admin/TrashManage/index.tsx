import { useState, useEffect } from 'react'
import { api } from '@/api'

interface TrashPost {
  id: number
  title: string
  slug: string
  deleted_at: string
  category_name?: string
  view_count: number
  like_count: number
}

export default function TrashManage() {
  const [posts, setPosts] = useState<TrashPost[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    fetchTrashPosts()
  }, [page])

  const fetchTrashPosts = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/posts/trash/list?page=${page}&limit=10`) as any
      setPosts(res.items)
      setTotal(res.total)
    } catch (error) {
      console.error('获取回收站失败', error)
    }
    setLoading(false)
  }

  const handleRestore = async (id: number) => {
    if (!confirm('确定要恢复该文章吗？')) return
    try {
      await api.post(`/posts/${id}/restore`, {})
      alert('文章已恢复')
      fetchTrashPosts()
    } catch (error) {
      alert('恢复失败')
    }
  }

  const handlePermanentDelete = async (id: number) => {
    if (!confirm('⚠️ 警告：永久删除后无法恢复！\n\n确定要永久删除该文章吗？')) return
    try {
      await api.delete(`/posts/${id}/permanent`)
      alert('文章已永久删除')
      fetchTrashPosts()
    } catch (error) {
      alert('删除失败')
    }
  }

  const handleEmptyTrash = async () => {
    if (!confirm('⚠️ 警告：这将永久删除回收站中的所有文章！\n\n确定要清空回收站吗？')) return
    
    try {
      for (const post of posts) {
        await api.delete(`/posts/${post.id}/permanent`)
      }
      alert('回收站已清空')
      fetchTrashPosts()
    } catch (error) {
      alert('清空失败')
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold">文章回收站</h1>
        {posts.length > 0 && (
          <button
            onClick={handleEmptyTrash}
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            清空回收站
          </button>
        )}
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <div className="flex items-center">
          <svg className="w-5 h-5 text-yellow-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span className="text-yellow-800">
            回收站中的文章已被标记为删除，可以在 30 天内恢复或永久删除
          </span>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">加载中...</div>
      ) : posts.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          回收站为空
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">文章</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">分类</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">删除时间</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">浏览</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">点赞</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {posts.map((post) => (
                <tr key={post.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{post.title}</div>
                    <div className="text-sm text-gray-500">{post.slug}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {post.category_name || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(post.deleted_at).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {post.view_count}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {post.like_count}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRestore(post.id)}
                        className="text-green-600 hover:text-green-800 text-sm font-medium"
                      >
                        恢复
                      </button>
                      <button
                        onClick={() => handlePermanentDelete(post.id)}
                        className="text-red-600 hover:text-red-800 text-sm font-medium"
                      >
                        永久删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {/* 分页 */}
          <div className="px-6 py-4 flex justify-between items-center border-t">
            <span className="text-sm text-gray-500">共 {total} 篇已删除文章</span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 border rounded disabled:opacity-50"
              >
                上一页
              </button>
              <span className="px-3 py-1">第 {page} 页</span>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={posts.length < 10}
                className="px-3 py-1 border rounded disabled:opacity-50"
              >
                下一页
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
