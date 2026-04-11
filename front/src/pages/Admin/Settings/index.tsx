import { useState } from 'react'

interface SiteSettings {
  site_name: string
  site_description: string
  posts_per_page: number
  enable_comments: boolean
  require_verification: boolean
  allow_register: boolean
}

export default function Settings() {
  const [settings, setSettings] = useState<SiteSettings>({
    site_name: '技术笔记博客',
    site_description: '分享技术心得与实战经验',
    posts_per_page: 10,
    enable_comments: true,
    require_verification: false,
    allow_register: true,
  })
  const [saved, setSaved] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      // TODO: 调用设置保存 API
      await new Promise(resolve => setTimeout(resolve, 500))
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (error) {
      alert('保存失败')
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">网站设置</h1>

      <div className="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 基本设置 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold mb-4">基本设置</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">网站名称</label>
                <input
                  type="text"
                  value={settings.site_name}
                  onChange={(e) => setSettings({ ...settings, site_name: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">网站描述</label>
                <textarea
                  value={settings.site_description}
                  onChange={(e) => setSettings({ ...settings, site_description: e.target.value })}
                  className="w-full border rounded px-3 py-2 h-24"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">每页文章数</label>
                <input
                  type="number"
                  min="5"
                  max="50"
                  value={settings.posts_per_page}
                  onChange={(e) => setSettings({ ...settings, posts_per_page: parseInt(e.target.value) || 10 })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
            </div>
          </div>

          {/* 评论设置 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold mb-4">评论设置</h2>
            
            <div className="space-y-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.enable_comments}
                  onChange={(e) => setSettings({ ...settings, enable_comments: e.target.checked })}
                  className="mr-2"
                />
                开启评论功能
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.require_verification}
                  onChange={(e) => setSettings({ ...settings, require_verification: e.target.checked })}
                  className="mr-2"
                />
                评论需要审核
              </label>
            </div>
          </div>

          {/* 用户设置 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold mb-4">用户设置</h2>
            
            <div className="space-y-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.allow_register}
                  onChange={(e) => setSettings({ ...settings, allow_register: e.target.checked })}
                  className="mr-2"
                />
                允许新用户注册
              </label>
            </div>
          </div>

          {/* 保存按钮 */}
          <div className="flex items-center gap-4">
            <button
              type="submit"
              className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600"
            >
              保存设置
            </button>
            {saved && (
              <span className="text-green-600">✓ 设置已保存</span>
            )}
          </div>
        </form>

        {/* 系统信息 */}
        <div className="mt-8 bg-gray-50 rounded-lg p-6">
          <h2 className="text-lg font-bold mb-4">系统信息</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">版本号：</span>
              <span>1.0.0</span>
            </div>
            <div>
              <span className="text-gray-500">数据库：</span>
              <span>SQLite 3</span>
            </div>
            <div>
              <span className="text-gray-500">后端框架：</span>
              <span>FastAPI</span>
            </div>
            <div>
              <span className="text-gray-500">前端框架：</span>
              <span>React + Vite</span>
            </div>
            <div>
              <span className="text-gray-500">Python 版本：</span>
              <span>3.10+</span>
            </div>
            <div>
              <span className="text-gray-500">Node 版本：</span>
              <span>18+</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
