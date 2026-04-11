import { useState, useEffect } from 'react'
import { api } from '@/api'

interface Announcement {
  id: number
  title: string
  content: string
  type: string
  priority: number
  is_pinned: boolean
  is_active: boolean
  start_time?: string
  end_time?: string
  created_at: string
}

export default function AnnouncementManage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Announcement | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    type: 'info',
    priority: 0,
    is_pinned: false,
    is_active: true,
  })

  useEffect(() => {
    fetchAnnouncements()
  }, [])

  const fetchAnnouncements = async () => {
    setLoading(true)
    try {
      const res = await api.get('/announcements/all') as any
      setAnnouncements(res.items)
    } catch (error) {
      console.error('获取公告失败', error)
    }
    setLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editing) {
        await api.put(`/announcements/${editing.id}`, formData)
        alert('公告更新成功')
      } else {
        await api.post('/announcements', formData)
        alert('公告创建成功')
      }
      setShowForm(false)
      setEditing(null)
      setFormData({ title: '', content: '', type: 'info', priority: 0, is_pinned: false, is_active: true })
      fetchAnnouncements()
    } catch (error) {
      alert('操作失败')
    }
  }

  const handleEdit = (ann: Announcement) => {
    setEditing(ann)
    setFormData({
      title: ann.title,
      content: ann.content,
      type: ann.type,
      priority: ann.priority,
      is_pinned: Boolean(ann.is_pinned),
      is_active: Boolean(ann.is_active),
    })
    setShowForm(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除该公告吗？')) return
    try {
      await api.delete(`/announcements/${id}`)
      alert('公告已删除')
      fetchAnnouncements()
    } catch (error) {
      alert('删除失败')
    }
  }

  const typeColors: Record<string, string> = {
    info: 'bg-blue-100 text-blue-800',
    warning: 'bg-yellow-100 text-yellow-800',
    error: 'bg-red-100 text-red-800',
    success: 'bg-green-100 text-green-800',
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold">公告管理</h1>
        <button
          onClick={() => { setShowForm(true); setEditing(null); setFormData({ title: '', content: '', type: 'info', priority: 0, is_pinned: false, is_active: true }) }}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          发布公告
        </button>
      </div>

      {/* 公告表单 */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <h2 className="text-xl font-bold mb-4">{editing ? '编辑公告' : '发布公告'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">标题</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">内容</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="w-full border rounded px-3 py-2 h-32"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">类型</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value="info">信息</option>
                    <option value="warning">警告</option>
                    <option value="error">错误</option>
                    <option value="success">成功</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">优先级</label>
                  <input
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
              </div>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={Boolean(formData.is_pinned)}
                    onChange={(e) => setFormData({ ...formData, is_pinned: e.target.checked })}
                    className="mr-2"
                  />
                  置顶
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={Boolean(formData.is_active)}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="mr-2"
                  />
                  启用
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 border rounded"
                >
                  取消
                </button>
                <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded">
                  提交
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 公告列表 */}
      {loading ? (
        <div className="text-center py-8">加载中...</div>
      ) : announcements.length === 0 ? (
        <div className="text-center py-8 text-gray-500">暂无公告</div>
      ) : (
        <div className="space-y-4">
          {announcements.map((ann) => (
            <div key={ann.id} className="bg-white rounded-lg shadow p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-1 text-xs rounded ${typeColors[ann.type] || 'bg-gray-100'}`}>
                      {ann.type}
                    </span>
                    {ann.is_pinned && <span className="text-red-500">置顶</span>}
                    {!ann.is_active && <span className="text-gray-400">已禁用</span>}
                  </div>
                  <h3 className="font-bold text-lg">{ann.title}</h3>
                  <p className="text-gray-600 mt-2">{ann.content}</p>
                  <div className="text-sm text-gray-400 mt-2">
                    创建于: {new Date(ann.created_at).toLocaleString()}
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => handleEdit(ann)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => handleDelete(ann.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    删除
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
