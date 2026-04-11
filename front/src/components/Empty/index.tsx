/**
 * Empty 空状态组件 - 移动端友好
 */

import { Link } from 'react-router-dom'

interface EmptyProps {
  icon?: string
  title: string
  description?: string
  action?: {
    label: string
    href?: string
    onClick?: () => void
  }
}

export function Empty({ icon = '📭', title, description, action }: EmptyProps) {
  return (
    <div className="py-12 sm:py-16 text-center">
      <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
        <span className="text-4xl sm:text-5xl">{icon}</span>
      </div>
      <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
        {title}
      </h3>
      {description && (
        <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-sm mx-auto px-4">
          {description}
        </p>
      )}
      {action && (
        action.href ? (
          <Link
            to={action.href}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
          >
            {action.label}
          </Link>
        ) : (
          <button
            onClick={action.onClick}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
          >
            {action.label}
          </button>
        )
      )}
    </div>
  )
}

// 404 页面
export function NotFound({ title = '页面不存在', description = '抱歉，您访问的页面不存在或已被删除' }: { title?: string; description?: string }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center">
        <div className="w-32 h-32 sm:w-40 sm:h-40 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-7xl sm:text-8xl">😢</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3">
          {title}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-md mx-auto">
          {description}
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            to="/"
            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
          >
            🏠 返回首页
          </Link>
          <Link
            to="/search"
            className="px-6 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            🔍 搜索文章
          </Link>
        </div>
      </div>
    </div>
  )
}

// 错误状态
export function ErrorState({ 
  message = '出错了', 
  onRetry 
}: { 
  message?: string
  onRetry?: () => void 
}) {
  return (
    <div className="py-12 text-center">
      <div className="w-20 h-20 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
        <span className="text-4xl">❌</span>
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
        {message}
      </h3>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          🔄 重试
        </button>
      )}
    </div>
  )
}
