/**
 * Header 组件
 */

import { Link, useNavigate } from 'react-router-dom'
import { useState, useSyncExternalStore } from 'react'
import { authStore } from '@/store/authStore'
import { themeStore } from '@/store/themeStore'

// 使用 useSyncExternalStore 的 hook
function useStoreSelector<T, S>(store: { getState: () => T; subscribe: (fn: () => void) => () => void }, selector: (state: T) => S): S {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(store.getState())
  )
}

export default function Header() {
  const navigate = useNavigate()
  const user = useStoreSelector(authStore, s => s.user)
  const isAuthenticated = useStoreSelector(authStore, s => s.isAuthenticated)
  const theme = useStoreSelector(themeStore, s => s.theme)
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
      setSearchQuery('')
    }
  }

  const ThemeIcon = () => {
    if (theme === 'dark') return '🌙'
    if (theme === 'light') return '☀️'
    return '🌓'
  }

  return (
    <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md sticky top-0 z-50 border-b border-gray-200 dark:border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <span className="text-2xl">📝</span>
            <span className="font-bold text-xl text-gray-900 dark:text-white">
              技术博客
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link
              to="/"
              className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              首页
            </Link>
            <Link
              to="/category/frontend"
              className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              前端
            </Link>
            <Link
              to="/category/backend"
              className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              后端
            </Link>
            <Link
              to="/category/devops"
              className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              DevOps
            </Link>
          </nav>

          {/* Actions */}
          <div className="flex items-center space-x-4">
            {/* Search */}
            <form onSubmit={handleSearch} className="hidden sm:block">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="搜索..."
                  className="w-40 lg:w-64 px-3 py-1.5 pl-9 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  🔍
                </span>
              </div>
            </form>

            {/* Theme Toggle */}
            <button
              onClick={() => themeStore.toggle()}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title={`当前: ${theme}`}
            >
              <ThemeIcon />
            </button>

            {/* Auth */}
            {isAuthenticated ? (
              <div className="relative">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <img
                    src={user?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${user?.nickname}`}
                    alt={user?.nickname}
                    className="w-8 h-8 rounded-full"
                  />
                  <span className="hidden sm:block text-sm text-gray-700 dark:text-gray-300">
                    {user?.nickname}
                  </span>
                </button>

                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1">
                    <Link
                      to="/admin"
                      className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      onClick={() => setMenuOpen(false)}
                    >
                      管理后台
                    </Link>
                    <Link
                      to="/profile"
                      className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      onClick={() => setMenuOpen(false)}
                    >
                      个人资料
                    </Link>
                    <hr className="my-1 border-gray-200 dark:border-gray-700" />
                    <button
                      onClick={() => {
                        authStore.logout()
                        navigate('/')
                        setMenuOpen(false)
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      退出登录
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link
                  to="/login"
                  className="text-sm text-gray-700 dark:text-gray-300 hover:text-blue-600"
                >
                  登录
                </Link>
                <Link
                  to="/register"
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  注册
                </Link>
              </div>
            )}

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <span className="text-xl">☰</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <nav className="px-4 py-3 space-y-2">
            <Link to="/" className="block py-2 text-gray-700 dark:text-gray-300">
              首页
            </Link>
            <Link to="/category/frontend" className="block py-2 text-gray-700 dark:text-gray-300">
              前端
            </Link>
            <Link to="/category/backend" className="block py-2 text-gray-700 dark:text-gray-300">
              后端
            </Link>
            <Link to="/category/devops" className="block py-2 text-gray-700 dark:text-gray-300">
              DevOps
            </Link>
            <form onSubmit={handleSearch} className="pt-2">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="搜索..."
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
              />
            </form>
          </nav>
        </div>
      )}
    </header>
  )
}
