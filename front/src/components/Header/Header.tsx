/**
 * Header 组件 - 移动端优化版
 */

import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useSyncExternalStore } from 'react'
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

const navItems = [
  { path: '/', label: '首页', icon: '🏠' },
  { path: '/category/frontend', label: '前端', icon: '🎨' },
  { path: '/category/backend', label: '后端', icon: '⚙️' },
  { path: '/category/devops', label: 'DevOps', icon: '🚀' },
  { path: '/category/python', label: 'Python', icon: '🐍' },
  { path: '/category/ai', label: 'AI', icon: '🤖' },
]

export default function Header() {
  const navigate = useNavigate()
  const location = useLocation()
  const user = useStoreSelector(authStore, s => s.user)
  const isAuthenticated = useStoreSelector(authStore, s => s.isAuthenticated)
  const theme = useStoreSelector(themeStore, s => s.theme)
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [scrolled, setScrolled] = useState(false)

  // 滚动时添加阴影
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // 关闭菜单当路由变化
  useEffect(() => {
    setMenuOpen(false)
    setSearchOpen(false)
  }, [location.pathname])

  // 防止背景滚动
  useEffect(() => {
    if (menuOpen || searchOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [menuOpen, searchOpen])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
      setSearchOpen(false)
      setSearchQuery('')
    }
  }

  const ThemeIcon = () => {
    if (theme === 'dark') return '🌙'
    if (theme === 'light') return '☀️'
    return '🌓'
  }

  return (
    <>
      <header className={`bg-white/95 dark:bg-gray-900/95 backdrop-blur-md sticky top-0 z-50 transition-shadow duration-300 ${scrolled ? 'shadow-md border-b border-gray-200 dark:border-gray-800' : 'border-b border-gray-100 dark:border-gray-800'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2">
              <span className="text-2xl sm:text-3xl">📝</span>
              <span className="font-bold text-lg sm:text-xl text-gray-900 dark:text-white">
                技术博客
              </span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-1">
              {navItems.map(item => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                    location.pathname === item.path
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-1 sm:gap-2">
              {/* Mobile Search Button */}
              <button
                onClick={() => setSearchOpen(true)}
                className="sm:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <span className="text-lg">🔍</span>
              </button>

              {/* Desktop Search */}
              <form onSubmit={handleSearch} className="hidden sm:block">
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="搜索文章..."
                    className="w-32 lg:w-48 px-3 py-1.5 pl-9 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                    🔍
                  </span>
                  <kbd className="hidden lg:inline absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 rounded">Ctrl+K</kbd>
                </div>
              </form>

              {/* Theme Toggle */}
              <button
                onClick={() => themeStore.toggle()}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                title={`主题: ${theme === 'dark' ? '深色' : theme === 'light' ? '浅色' : '自动'}`}
              >
                <span className="text-lg">{ThemeIcon()}</span>
              </button>

              {/* Auth */}
              {isAuthenticated ? (
                <div className="relative hidden sm:block">
                  <button
                    onClick={() => setMenuOpen(!menuOpen)}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <img
                      src={user?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${user?.nickname}`}
                      alt={user?.nickname}
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-full ring-2 ring-gray-200 dark:ring-gray-700"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300 hidden md:block">
                      {user?.nickname}
                    </span>
                  </button>

                  {menuOpen && (
                    <>
                      <div 
                        className="fixed inset-0 z-40" 
                        onClick={() => setMenuOpen(false)} 
                      />
                      <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 py-2 z-50 animate-fade-in">
                        <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700">
                          <p className="font-medium text-gray-900 dark:text-white">{user?.nickname}</p>
                          <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                        </div>
                        <Link
                          to="/admin"
                          className="flex items-center gap-3 px-4 py-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          <span>⚙️</span> 管理后台
                        </Link>
                        <Link
                          to="/profile"
                          className="flex items-center gap-3 px-4 py-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          <span>👤</span> 个人资料
                        </Link>
                        <hr className="my-2 border-gray-100 dark:border-gray-700" />
                        <button
                          onClick={() => {
                            authStore.logout()
                            navigate('/')
                            setMenuOpen(false)
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          <span>🚪</span> 退出登录
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Link
                    to="/login"
                    className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors"
                  >
                    登录
                  </Link>
                  <Link
                    to="/register"
                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    注册
                  </Link>
                </div>
              )}

              {/* Mobile Menu Button */}
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <span className="text-xl">{menuOpen ? '✕' : '☰'}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
            onClick={() => setMenuOpen(false)}
          />
          
          {/* Menu Panel */}
          <div className="absolute right-0 top-0 bottom-0 w-80 max-w-[85vw] bg-white dark:bg-gray-900 shadow-2xl animate-slide-in-right">
            {/* User Info (if logged in) */}
            {isAuthenticated && (
              <div className="p-4 border-b border-gray-100 dark:border-gray-800 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-800">
                <div className="flex items-center gap-3">
                  <img
                    src={user?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${user?.nickname}`}
                    alt={user?.nickname}
                    className="w-12 h-12 rounded-full ring-2 ring-white dark:ring-gray-700"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white truncate">{user?.nickname}</p>
                    <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <Link
                    to="/admin"
                    className="flex-1 text-center px-3 py-1.5 text-xs bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300"
                  >
                    ⚙️ 管理后台
                  </Link>
                  <button
                    onClick={() => {
                      authStore.logout()
                      navigate('/')
                      setMenuOpen(false)
                    }}
                    className="px-3 py-1.5 text-xs text-red-600"
                  >
                    退出
                  </button>
                </div>
              </div>
            )}

            {/* Navigation */}
            <nav className="p-4 space-y-1">
              <p className="px-3 py-2 text-xs font-medium text-gray-400 uppercase tracking-wider">导航</p>
              {navItems.map(item => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ${
                    location.pathname === item.path
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <span className="text-xl">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </nav>

            {/* Quick Links */}
            <nav className="p-4 border-t border-gray-100 dark:border-gray-800 space-y-1">
              <p className="px-3 py-2 text-xs font-medium text-gray-400 uppercase tracking-wider">更多</p>
              <Link
                to="/about"
                className="flex items-center gap-3 px-3 py-3 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <span className="text-xl">ℹ️</span> 关于我们
              </Link>
              <Link
                to="/search"
                className="flex items-center gap-3 px-3 py-3 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <span className="text-xl">🔍</span> 搜索文章
              </Link>
            </nav>

            {/* Auth (if not logged in) */}
            {!isAuthenticated && (
              <div className="p-4 border-t border-gray-100 dark:border-gray-800">
                <div className="flex gap-3">
                  <Link
                    to="/login"
                    className="flex-1 text-center px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    登录
                  </Link>
                  <Link
                    to="/register"
                    className="flex-1 text-center px-4 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
                  >
                    注册
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobile Search Overlay */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 sm:hidden">
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
            onClick={() => setSearchOpen(false)}
          />
          <div className="absolute top-0 left-0 right-0 bg-white dark:bg-gray-900 shadow-xl p-4 animate-slide-in-top">
            <form onSubmit={handleSearch} className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <span className="text-xl">←</span>
              </button>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="搜索文章..."
                autoFocus
                className="flex-1 px-4 py-3 text-lg rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
              >
                搜索
              </button>
            </form>
            <div className="mt-4">
              <p className="text-xs text-gray-500 mb-2">热门搜索</p>
              <div className="flex flex-wrap gap-2">
                {['Python', 'JavaScript', 'React', 'Docker'].map(tag => (
                  <button
                    key={tag}
                    onClick={() => {
                      setSearchQuery(tag)
                      navigate(`/search?q=${encodeURIComponent(tag)}`)
                      setSearchOpen(false)
                    }}
                    className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 rounded-full text-gray-700 dark:text-gray-300 hover:bg-blue-100 hover:text-blue-600 transition-colors"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
