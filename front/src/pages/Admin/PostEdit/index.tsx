/**
 * 文章编辑页
 */

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAsync } from '@/hooks/useStore'
import { getPost, createPost, updatePost } from '@/api/posts'
import { getCategories } from '@/api/categories'
import { getTags } from '@/api/tags'
import { Markdown } from '@/components/Markdown'

type PostStatus = 'draft' | 'published' | 'archived'

export default function PostEdit() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [content, setContent] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [coverImage, setCoverImage] = useState('')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [tagIds, setTagIds] = useState<number[]>([])
  const [status, setStatus] = useState<PostStatus>('draft')
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState(false)

  const { data: categories } = useAsync(() => getCategories(), [])
  const { data: tags } = useAsync(() => getTags(), [])

  const { data: existingPost, loading: loadingPost } = useAsync(
    () => (id ? getPost(id) : Promise.resolve(null)),
    [id]
  )

  // 填充现有文章数据
  useEffect(() => {
    if (existingPost) {
      setTitle(existingPost.title)
      setSlug(existingPost.slug)
      setContent(existingPost.content)
      setExcerpt(existingPost.excerpt || '')
      setCoverImage(existingPost.coverImage || existingPost.cover || '')
      setCategoryId(existingPost.category?.id || null)
      setTagIds(existingPost.tags.map(t => t.id))
      // 从 is_public 转换状态
      setStatus(existingPost.is_public === 1 ? 'published' : 'draft')
    }
  }, [existingPost])

  // 生成 slug
  const generateSlug = () => {
    const generated = title
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
      .replace(/^-|-$/g, '')
    setSlug(generated)
  }

  const handleSave = async () => {
    if (!title.trim()) {
      alert('请输入标题')
      return
    }
    if (!content.trim()) {
      alert('请输入内容')
      return
    }
    if (!categoryId) {
      alert('请选择分类')
      return
    }

    setSaving(true)
    try {
      const data = {
        title,
        slug: slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        content,
        excerpt,
        coverImage,
        categoryId,
        tagIds,
        status,
      }

      if (isEdit && id) {
        await updatePost(parseInt(id), data)
      } else {
        const created = await createPost(data)
        navigate(`/admin/posts/${created.id}/edit`)
        return
      }

      alert('保存成功')
    } catch (err) {
      alert(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const toggleTag = (tagId: number) => {
    setTagIds(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    )
  }

  if (loadingPost) {
    return (
      <div className="p-8 text-center text-gray-500">
        加载中...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {isEdit ? '编辑文章' : '新建文章'}
        </h1>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setPreview(!preview)}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            {preview ? '📝 编辑' : '👁 预览'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? '保存中...' : '💾 保存'}
          </button>
        </div>
      </div>

      {preview ? (
        // Preview Mode
        <div className="bg-white dark:bg-gray-800 rounded-xl p-8">
          {coverImage && (
            <img src={coverImage} alt="" className="w-full h-64 object-cover rounded-xl mb-8" />
          )}
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            {title || '无标题'}
          </h1>
          <div className="flex items-center space-x-4 text-gray-500 dark:text-gray-400 mb-8">
            {categoryId && categories && (
              <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full text-sm">
                {categories.find(c => c.id === categoryId)?.name}
              </span>
            )}
            <span>{status === 'published' ? '已发布' : status === 'draft' ? '草稿' : '归档'}</span>
          </div>
          <div className="prose prose-lg max-w-none dark:prose-invert">
            <Markdown content={content || '*暂无内容*'} />
          </div>
        </div>
      ) : (
        // Edit Mode
        <div className="space-y-6">
          {/* Basic Info */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                标题
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="文章标题"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Slug
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={slug}
                    onChange={e => setSlug(e.target.value)}
                    className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder="auto-generate"
                  />
                  <button
                    type="button"
                    onClick={generateSlug}
                    className="px-3 py-2 bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500"
                  >
                    生成
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  分类
                </label>
                <select
                  value={categoryId || ''}
                  onChange={e => setCategoryId(Number(e.target.value))}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="">选择分类</option>
                  {categories?.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                封面图 URL
              </label>
              <input
                type="url"
                value={coverImage}
                onChange={e => setCoverImage(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="https://..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                摘要
              </label>
              <textarea
                value={excerpt}
                onChange={e => setExcerpt(e.target.value)}
                rows={2}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="文章摘要（可选）"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                标签
              </label>
              <div className="flex flex-wrap gap-2">
                {tags?.map(tag => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className={`px-3 py-1 text-sm rounded-full transition-colors ${
                      tagIds.includes(tag.id)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                状态
              </label>
              <div className="flex space-x-4">
                {(['draft', 'published', 'archived'] as const).map(s => (
                  <label key={s} className="flex items-center">
                    <input
                      type="radio"
                      name="status"
                      value={s}
                      checked={status === s}
                      onChange={() => setStatus(s)}
                      className="mr-2"
                    />
                    <span className="text-gray-700 dark:text-gray-300">
                      {s === 'draft' ? '草稿' : s === 'published' ? '已发布' : '归档'}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              内容 (Markdown)
            </label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={20}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono text-sm"
              placeholder="# 标题&#10;&#10;内容..."
            />
          </div>
        </div>
      )}
    </div>
  )
}
