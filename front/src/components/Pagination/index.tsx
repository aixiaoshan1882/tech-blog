/**
 * Pagination 分页组件 - 移动端友好
 */

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  maxVisible?: number
}

export function Pagination({ 
  currentPage, 
  totalPages, 
  onPageChange,
  maxVisible = 5 
}: PaginationProps) {
  if (totalPages <= 1) return null

  // 生成页码数组
  const getPages = () => {
    const pages: (number | 'ellipsis')[] = []
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      if (currentPage <= Math.ceil(maxVisible / 2)) {
        for (let i = 1; i <= maxVisible - 1; i++) pages.push(i)
        pages.push('ellipsis')
        pages.push(totalPages)
      } else if (currentPage >= totalPages - Math.floor(maxVisible / 2)) {
        pages.push(1)
        pages.push('ellipsis')
        for (let i = totalPages - maxVisible + 2; i <= totalPages; i++) pages.push(i)
      } else {
        pages.push(1)
        pages.push('ellipsis')
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i)
        pages.push('ellipsis')
        pages.push(totalPages)
      }
    }
    
    return pages
  }

  const pages = getPages()

  return (
    <div className="flex items-center justify-center gap-1 sm:gap-2 py-6">
      {/* 上一页 */}
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-3 sm:px-4 py-2 text-sm sm:text-base bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        <span className="hidden sm:inline">←</span>
        <span className="sm:hidden">‹</span>
      </button>

      {/* 页码 */}
      <div className="flex items-center gap-1">
        {pages.map((page, index) => {
          if (page === 'ellipsis') {
            return (
              <span key={`ellipsis-${index}`} className="px-2 sm:px-3 py-2 text-gray-400">
                •••
              </span>
            )
          }
          
          const isActive = page === currentPage
          return (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={`min-w-[36px] sm:min-w-[40px] h-10 px-2 sm:px-3 text-sm sm:text-base rounded-lg font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
              }`}
            >
              {page}
            </button>
          )
        })}
      </div>

      {/* 下一页 */}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="px-3 sm:px-4 py-2 text-sm sm:text-base bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        <span className="hidden sm:inline">→</span>
        <span className="sm:hidden">›</span>
      </button>
    </div>
  )
}

// 移动端简化版分页
export function PaginationSimple({ 
  currentPage, 
  totalPages, 
  onPageChange,
  total = 0
}: { 
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  total?: number
}) {
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-4 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        ← 上一页
      </button>
      
      <div className="text-sm text-gray-500">
        <span className="font-medium text-gray-900 dark:text-gray-100">{currentPage}</span>
        <span className="mx-1">/</span>
        <span>{totalPages}</span>
        {total > 0 && (
          <span className="hidden sm:inline ml-2 text-gray-400">
            (共 {total} 条)
          </span>
        )}
      </div>
      
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="px-4 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        下一页 →
      </button>
    </div>
  )
}
