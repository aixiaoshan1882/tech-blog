import { useState, useEffect } from 'react'
import { api } from '@/api'

interface User {
  id: number
  email: string
  nickname: string
  role: string
  avatar?: string
  bio?: string
  created_at: string
  post_count: number
  comment_count: number
}

export default function UserManage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [keyword, setKeyword] = useState('')
  const [roleFilter, setRoleFilter] = useState('')

  useEffect(() => {
    fetchUsers()
  }, [page, keyword, roleFilter])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: '10' })
      if (keyword) params.append('keyword', keyword)
      if (roleFilter) params.append('role', roleFilter)
      
      const res = await api.get(`/users?${params}`)
      setUsers(res.data.items)
      setTotal(res.data.total)
    } catch (error) {
      console.error('获取用户列表失败', error)
    }
    setLoading(false)
  }

  const handleRoleChange = async (userId: number, newRole: string) => {
    try {
      await api.put(`/users/${userId}/role`, { role: newRole })
      alert('角色更新成功')
      fetchUsers()
    } catch (error: any) {
      alert(error.response?.data?.detail || '更新失败')
    }
  }

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('确定要删除该用户吗？')) return
    
    try {
      await api.delete(`/users/${userId}`)
      alert('用户已删除')
      fetchUsers()
    } catch (error: any) {
      alert(error.response?.data?.detail || '删除失败')
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-4">用户管理</h1>
        
        {/* 搜索和筛选 */}
        <div className="flex gap-4 mb-4">
          <input
            type="text"
            placeholder="搜索用户..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="border rounded px-3 py-2 flex-1"
          />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="border rounded px-3 py-2"
          >
            <option value="">全部角色</option>
            <option value="admin">管理员</option>
            <option value="reader">普通用户</option>
          </select>
        </div>
      </div>

      {/* 用户列表 */}
      {loading ? (
        <div className="text-center py-8">加载中...</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">用户</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">邮箱</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">角色</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">文章数</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">评论数</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">注册时间</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
                        {user.avatar ? (
                          <img src={user.avatar} alt="" className="w-full h-full rounded-full" />
                        ) : (
                          <span className="text-lg">{user.nickname[0]?.toUpperCase()}</span>
                        )}
                      </div>
                      <div className="ml-4">
                        <div className="font-medium">{user.nickname}</div>
                        {user.bio && <div className="text-sm text-gray-500">{user.bio.slice(0, 20)}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{user.email}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs rounded ${
                      user.role === 'admin' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {user.role === 'admin' ? '管理员' : '普通用户'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">{user.post_count}</td>
                  <td className="px-6 py-4 text-sm">{user.comment_count}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        className="border rounded px-2 py-1 text-sm"
                      >
                        <option value="reader">普通用户</option>
                        <option value="admin">管理员</option>
                      </select>
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {/* 分页 */}
          <div className="px-6 py-4 flex justify-between items-center">
            <span className="text-sm text-gray-500">共 {total} 条</span>
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
                disabled={users.length < 10}
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
