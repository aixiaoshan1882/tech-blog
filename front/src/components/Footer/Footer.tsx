/**
 * Footer 组件 - 移动端优化版
 */

import { Link } from 'react-router-dom'
import { useAsync } from '@/hooks/useStore'
import { getHotTags } from '@/api/tags'

const socialLinks = [
  { name: 'GitHub', icon: '🐙', href: 'https://github.com' },
  { name: 'Twitter', icon: '🐦', href: 'https://twitter.com' },
  { name: 'RSS', icon: '📡', href: '/feed.xml' },
]

const quickLinks = [
  { path: '/', label: '首页' },
  { path: '/about', label: '关于我们' },
  { path: '/search', label: '搜索' },
  { path: '/category/frontend', label: '前端开发' },
  { path: '/category/backend', label: '后端开发' },
  { path: '/category/devops', label: 'DevOps' },
]

export default function Footer() {
  const { data: tags } = useAsync(() => getHotTags(8), [])

  return (
    <footer className="bg-gray-900 dark:bg-gray-950 text-gray-300 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        {/* Main Content */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {/* About Section */}
          <div className="sm:col-span-2 lg:col-span-2">
            <Link to="/" className="inline-flex items-center gap-2 mb-4">
              <span className="text-3xl">📝</span>
              <span className="font-bold text-xl text-white">技术博客</span>
            </Link>
            <p className="text-gray-400 mb-6 max-w-md leading-relaxed">
              分享技术，记录成长。这里有前端、后端、DevOps 等多领域的技术文章，
              希望能帮助到同样热爱技术的你。
            </p>
            
            {/* Social Links */}
            <div className="flex items-center gap-3">
              {socialLinks.map(link => (
                <a
                  key={link.name}
                  href={link.href}
                  target={link.href.startsWith('http') ? '_blank' : undefined}
                  rel={link.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                  className="w-10 h-10 flex items-center justify-center bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                  title={link.name}
                >
                  <span className="text-lg">{link.icon}</span>
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
              <span>🔗</span> 快捷链接
            </h3>
            <ul className="space-y-2.5">
              {quickLinks.map(link => (
                <li key={link.path}>
                  <Link 
                    to={link.path} 
                    className="text-gray-400 hover:text-white transition-colors inline-flex items-center gap-1 group"
                  >
                    <span className="text-xs opacity-0 group-hover:opacity-100 transition-opacity">›</span>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Popular Tags */}
          <div>
            <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
              <span>🏷️</span> 热门标签
            </h3>
            <div className="flex flex-wrap gap-2">
              {tags?.map(tag => (
                <Link
                  key={tag.id}
                  to={`/tag/${tag.slug}`}
                  className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  {tag.name}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Divider */}
        <hr className="border-gray-800 my-8" />

        {/* Bottom */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-gray-500">
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
            <p>© {new Date().getFullYear()} 技术博客</p>
            <span className="hidden sm:inline text-gray-700">•</span>
            <p>All rights reserved</p>
          </div>
          <div className="flex items-center gap-2">
            <span>Made with</span>
            <span className="text-red-500">❤️</span>
            <span>using React + TypeScript</span>
          </div>
        </div>
      </div>

      {/* Mobile App Banner */}
      <div className="sm:hidden bg-gray-800 px-4 py-6 border-t border-gray-800">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">下载移动应用</p>
              <p className="text-sm text-blue-100">随时随地阅读技术文章</p>
            </div>
            <button className="px-4 py-2 bg-white/20 backdrop-blur-sm rounded-lg text-sm font-medium hover:bg-white/30 transition-colors">
              即将推出
            </button>
          </div>
        </div>
      </div>
    </footer>
  )
}
