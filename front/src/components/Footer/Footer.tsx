/**
 * Footer 组件
 */

import { Link } from 'react-router-dom'
import { useAsync } from '@/hooks/useStore'
import { getHotTags } from '@/api/tags'

export default function Footer() {
  const { data: tags } = useAsync(() => getHotTags(8), [])

  return (
    <footer className="bg-gray-900 dark:bg-gray-950 text-gray-300 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* 关于 */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center space-x-2 mb-4">
              <span className="text-2xl">📝</span>
              <span className="font-bold text-xl text-white">技术博客</span>
            </div>
            <p className="text-gray-400 mb-4 max-w-md">
              分享技术，记录成长。这里有前端、后端、DevOps 等多领域的技术文章，
              希望能帮助到同样热爱技术的你。
            </p>
            <div className="flex space-x-4">
              <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                GitHub
              </a>
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                Twitter
              </a>
              <a href="/rss.xml" className="hover:text-white transition-colors">
                RSS
              </a>
            </div>
          </div>

          {/* 快捷链接 */}
          <div>
            <h3 className="font-semibold text-white mb-4">快捷链接</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/" className="text-gray-400 hover:text-white transition-colors">
                  首页
                </Link>
              </li>
              <li>
                <Link to="/about" className="text-gray-400 hover:text-white transition-colors">
                  关于
                </Link>
              </li>
              <li>
                <Link to="/category/frontend" className="text-gray-400 hover:text-white transition-colors">
                  前端开发
                </Link>
              </li>
              <li>
                <Link to="/category/backend" className="text-gray-400 hover:text-white transition-colors">
                  后端开发
                </Link>
              </li>
              <li>
                <Link to="/category/devops" className="text-gray-400 hover:text-white transition-colors">
                  DevOps
                </Link>
              </li>
            </ul>
          </div>

          {/* 热门标签 */}
          <div>
            <h3 className="font-semibold text-white mb-4">热门标签</h3>
            <div className="flex flex-wrap gap-2">
              {tags?.map(tag => (
                <Link
                  key={tag.id}
                  to={`/tag/${tag.slug}`}
                  className="px-2 py-1 text-xs bg-gray-800 rounded hover:bg-gray-700 transition-colors"
                >
                  {tag.name}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <hr className="border-gray-800 my-8" />

        <div className="flex flex-col md:flex-row justify-between items-center text-sm text-gray-500">
          <p>© {new Date().getFullYear()} 技术博客. All rights reserved.</p>
          <p className="mt-2 md:mt-0">
            Made with ❤️ using React + TypeScript
          </p>
        </div>
      </div>
    </footer>
  )
}
