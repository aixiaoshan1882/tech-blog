/**
 * 分类管理页
 */

import { useState } from 'react'
import { useAsync } from '@/hooks/useStore'
import { getCategories, createCategory, updateCategory, deleteCategory } from '@/api/categories'

export default function CategoryManage() {
  const [editingId, setEditingId] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [parentId, setParentId] = useState<number>(0)
  const [saving, setSaving] = useState(false)

  const { data: categories, loading, error, refetch } = useAsync(() => getCategories(), [])

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
    setParentId(0)
    setEditingId(null)
  }

  // 保存分类
  const handleSave = async () => {
    if (!name.trim() || !slug.trim()) {
      alert('请填写名称和别名')
      return
    }

    setSaving(true)
    try {
      if (editingId) {
        await updateCategory(editingId, { name, slug, parentId })
      } else {
        await createCategory({ name, slug, parentId })
      }
      resetForm()
      refetch()
    } catch (err) {
      alert(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  // 编辑分类
  const handleEdit = (cat: any) => {
    setName(cat.name)
    setSlug(cat.slug)
    setParentId(cat.parent_id)
    setEditingId(cat.id)
  }

  // 删除分类
  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这个分类吗？')) return
    try {
      await deleteCategory(id)
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
          分类管理
        </h1>
      </div>

      {/* 添加/编辑表单 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">
          {editingId ? '编辑分类' : '添加分类'}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              名称
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="分类名称"
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
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              父分类
            </label>
            <select
              value={parentId}
              onChange={e => setParentId(Number(e.target.value))}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value={0}>顶级分类</option>
              {categories?.filter((c: any) => c.parent_id === 0).map((cat: any) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
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

      {/* 分类列表 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">名称</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">别名</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">父分类</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {categories?.map((cat: any) => (
              <tr key={cat.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">{cat.name}</td>
                <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{cat.slug}</td>
                <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                  {cat.parent_id === 0 ? '顶级' : categories?.find((c: any) => c.id === cat.parent_id)?.name}
                </td>
                <td className="px-6 py-4 text-right space-x-3">
                  <button
                    onClick={() => handleEdit(cat)}
                    className="text-blue-600 hover:text-blue-700 text-sm"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => handleDelete(cat.id)}
                    className="text-red-600 hover:text-red-700 text-sm"
                  >
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!categories || categories.length === 0) && (
          <div className="p-8 text-center text-gray-500">暂无分类</div>
        )}
      </div>
    </div>
  )
}
