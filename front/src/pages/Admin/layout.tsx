/**
 * Admin 布局
 */

import { Outlet, Link, useLocation } from 'react-router-dom'
import { authStore } from '@/store/authStore'
import { useStoreSelector } from '@/hooks/useStore'

const navItems = [
  { path: '/admin', label: '仪表盘', icon: '📊' },
  { path: '/admin/posts', label: '文章管理', icon: '📝' },
  { path: '/admin/trash', label: '回收站', icon: '🗑️' },
  { path: '/admin/categories', label: '分类管理', icon: '📁' },
  { path: '/admin/tags', label: '标签管理', icon: '🏷️' },
  { path: '/admin/comments', label: '评论管理', icon: '💬' },
  { path: '/admin/announcements', label: '公告管理', icon: '📢' },
  { path: '/admin/users', label: '用户管理', icon: '👥' },
  { path: '/admin/logs', label: '操作日志', icon: '📋' },
  { path: '/admin/api-docs', label: 'API 文档', icon: '📖' },
  { path: '/admin/analytics', label: '数据分析', icon: '📈' },
  { path: '/admin/settings', label: '网站设置', icon: '⚙️' },
]

export default function AdminLayout() {
  const location = useLocation()
  const user = useStoreSelector(authStore, s => s.user)

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Admin Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link to="/" className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                ← 返回前台
              </Link>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                管理后台
              </span>
            </div>
            <div className="flex items-center space-x-3">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {user?.nickname}
              </span>
              <img
                src={user?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${user?.nickname}`}
                alt={user?.nickname}
                className="w-8 h-8 rounded-full"
              />
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Sidebar */}
          <aside className="w-64 flex-shrink-0">
            <nav className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 space-y-1">
              {navItems.map(item => {
                const isActive = location.pathname === item.path
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
