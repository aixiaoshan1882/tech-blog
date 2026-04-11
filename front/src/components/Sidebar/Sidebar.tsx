/**
 * Sidebar 组件 - 侧边栏
 */

import { Link } from 'react-router-dom'
import { useAsync } from '@/hooks/useStore'
import { getCategories } from '@/api/categories'
import { getTags } from '@/api/tags'
import { getHotPosts } from '@/api/posts'
import { PostCard } from '@/components/PostCard/PostCard'

export function Sidebar() {
  const { data: categories } = useAsync(() => getCategories(), [])
  const { data: tags } = useAsync(() => getTags(), [])
  const { data: hotPosts } = useAsync(() => getHotPosts(5), [])

  return (
    <aside className="space-y-8">
      {/* 热门文章 */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
          🔥 热门文章
        </h3>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          {hotPosts?.map(post => (
            <PostCard key={post.id} post={post} variant="compact" />
          ))}
        </div>
      </section>

      {/* 分类 */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
          📁 分类
        </h3>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <ul className="space-y-2">
            {categories?.map(cat => (
              <li key={cat.id}>
                <Link
                  to={`/category/${cat.slug}`}
                  className="flex items-center justify-between py-1.5 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  <span>{cat.name}</span>
                  <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-full">
                    {cat.postCount}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 标签云 */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
          🏷️ 标签
        </h3>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {tags?.map(tag => (
              <Link
                key={tag.id}
                to={`/tag/${tag.slug}`}
                className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/50 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                {tag.name}
                <span className="ml-1 text-xs opacity-60">({tag.postCount})</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 关于 */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
          👤 关于
        </h3>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            热爱技术，专注于前端开发、Node.js 和云原生技术。分享工作中的经验和心得。
          </p>
          <div className="mt-4 flex space-x-3">
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              GitHub
            </a>
            <a href="mailto:@example@mail.com" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              Email
            </a>
          </div>
        </div>
      </section>
    </aside>
  )
}
