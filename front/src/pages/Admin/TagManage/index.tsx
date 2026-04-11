/**
 * 标签管理页
 */

import { useState } from 'react'
import { useAsync } from '@/hooks/useStore'
import { getTags, createTag, updateTag, deleteTag } from '@/api/tags'

export default function TagManage() {
  const [editingId, setEditingId] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [saving, setSaving] = useState(false)

  const { data: tags, loading, error, refetch } = useAsync(() => getTags(), [])

  // 生成 slug
  const generateSlug = () => {
    const generated = name
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
      .replace(/^-|-$/g, '')
    setSlug(generated)
  }

  // 重置表单
  const resetForm = () => {
    setName('')
    setSlug('')
    setEditingId(null)
  }

  // 保存标签
  const handleSave = async () => {
    if (!name.trim() || !slug.trim()) {
      alert('请填写名称和别名')
      return
    }

    setSaving(true)
    try {
      if (editingId) {
        await updateTag(editingId, { name, slug })
      } else {
        await createTag({ name, slug })
      }
      resetForm()
      refetch()
    } catch (err) {
      alert(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  // 编辑标签
  const handleEdit = (tag: any) => {
    setName(tag.name)
    setSlug(tag.slug)
    setEditingId(tag.id)
  }

  // 删除标签
  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这个标签吗？')) return
    try {
      await deleteTag(id)
      refetch()
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除失败')
    }
  }

  if (loading) return <div className="p-8 text-center">加载中...</div>
  if (error) return <div className="p-4 text-red-500">加载失败: {error.message}</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          标签管理
        </h1>
      </div>

      {/* 添加/编辑表单 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">
          {editingId ? '编辑标签' : '添加标签'}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              名称
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="标签名称"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              别名
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={slug}
                onChange={e => setSlug(e.target.value)}
                className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="url-slug"
              />
              <button
                type="button"
                onClick={generateSlug}
                className="px-3 py-2 bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200"
              >
                生成
              </button>
            </div>
          </div>
        </div>
        <div className="mt-4 flex space-x-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存'}
          </button>
          {editingId && (
            <button
              onClick={resetForm}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200"
            >
              取消
            </button>
          )}
        </div>
      </div>

      {/* 标签列表 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">名称</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">别名</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {tags?.map((tag: any) => (
              <tr key={tag.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                    {tag.name}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{tag.slug}</td>
                <td className="px-6 py-4 text-right space-x-3">
                  <button
                    onClick={() => handleEdit(tag)}
                    className="text-blue-600 hover:text-blue-700 text-sm"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => handleDelete(tag.id)}
                    className="text-red-600 hover:text-red-700 text-sm"
                  >
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!tags || tags.length === 0) && (
          <div className="p-8 text-center text-gray-500">暂无标签</div>
        )}
      </div>
    </div>
  )
}
