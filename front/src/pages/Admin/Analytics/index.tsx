import { useState, useEffect } from 'react'
import { api } from '@/api'

interface DailyStats {
  date: string
  views: number
  posts: number
  comments: number
}

interface TopPost {
  id: number
  title: string
  slug: string
  view_count: number
  like_count: number
}

export default function Analytics() {
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([])
  const [topPosts, setTopPosts] = useState<TopPost[]>([])
  const [topViewed, setTopViewed] = useState<TopPost[]>([])
  const [topLiked, setTopLiked] = useState<TopPost[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'7' | '30' | '90'>('30')

  useEffect(() => {
    fetchData()
  }, [period])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [statsRes, topRes, viewRes, likeRes] = await Promise.all([
        api.get(`/stats/trends?period=${period}`) as any,
        api.get('/posts/top?period=comments') as any,
        api.get('/posts/top?period=views') as any,
        api.get('/posts/top?period=likes') as any,
      ])
      setDailyStats(statsRes.data.daily || [])
      setTopPosts(topRes.data.posts || [])
      setTopViewed(viewRes.data.posts || [])
      setTopLiked(likeRes.data.posts || [])
    } catch (error) {
      console.error('获取统计数据失败', error)
    }
    setLoading(false)
  }

  const maxViews = Math.max(...dailyStats.map(d => d.views), 1)

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">数据分析</h1>
        <div className="flex gap-2">
          {(['7', '30', '90'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 rounded ${
                period === p 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {p}天
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">加载中...</div>
      ) : (
        <>
          {/* 趋势图表 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold mb-4">访问趋势</h2>
            <div className="h-64 flex items-end justify-between gap-2">
              {dailyStats.map((day, i) => (
                <div key={i} className="flex-1 flex flex-col items-center">
                  <div 
                    className="w-full bg-blue-500 rounded-t transition-all hover:bg-blue-600"
                    style={{ height: `${(day.views / maxViews) * 200}px`, minHeight: '4px' }}
                  />
                  <span className="text-xs text-gray-500 mt-2 rotate-45 origin-left">
                    {day.date.slice(5)}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-4 text-sm text-gray-500">
              <span>浏览量趋势</span>
              <span>总计: {dailyStats.reduce((sum, d) => sum + d.views, 0)}</span>
            </div>
          </div>

          {/* 统计卡片 */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-3xl font-bold text-blue-600">
                {dailyStats.reduce((sum, d) => sum + d.views, 0)}
              </div>
              <div className="text-gray-500 text-sm">总浏览量</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-3xl font-bold text-green-600">
                {dailyStats.reduce((sum, d) => sum + d.posts, 0)}
              </div>
              <div className="text-gray-500 text-sm">新增文章</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-3xl font-bold text-purple-600">
                {dailyStats.reduce((sum, d) => sum + d.comments, 0)}
              </div>
              <div className="text-gray-500 text-sm">新增评论</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-3xl font-bold text-orange-600">
                {topViewed.length > 0 ? topViewed[0].view_count : 0}
              </div>
              <div className="text-gray-500 text-sm">最高单篇浏览</div>
            </div>
          </div>

          {/* 排行榜 */}
          <div className="grid grid-cols-3 gap-6">
            {/* 浏览排行 */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-4 py-3 border-b">
                <h3 className="font-bold">🔥 浏览排行</h3>
              </div>
              <div className="divide-y">
                {topViewed.slice(0, 10).map((post, i) => (
                  <div key={post.id} className="px-4 py-2 flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      i < 3 ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-600'
                    }`}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{post.title}</div>
                      <div className="text-xs text-gray-500">{post.view_count} 阅读</div>
                    </div>
                  </div>
                ))}
                {topViewed.length === 0 && (
                  <div className="px-4 py-8 text-center text-gray-500">暂无数据</div>
                )}
              </div>
            </div>

            {/* 点赞排行 */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-4 py-3 border-b">
                <h3 className="font-bold">❤️ 点赞排行</h3>
              </div>
              <div className="divide-y">
                {topLiked.slice(0, 10).map((post, i) => (
                  <div key={post.id} className="px-4 py-2 flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      i < 3 ? 'bg-pink-500 text-white' : 'bg-gray-200 text-gray-600'
                    }`}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{post.title}</div>
                      <div className="text-xs text-gray-500">{post.like_count} 点赞</div>
                    </div>
                  </div>
                ))}
                {topLiked.length === 0 && (
                  <div className="px-4 py-8 text-center text-gray-500">暂无数据</div>
                )}
              </div>
            </div>

            {/* 评论排行 */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-4 py-3 border-b">
                <h3 className="font-bold">💬 评论排行</h3>
              </div>
              <div className="divide-y">
                {topPosts.slice(0, 10).map((post, i) => (
                  <div key={post.id} className="px-4 py-2 flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      i < 3 ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'
                    }`}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{post.title}</div>
                      <div className="text-xs text-gray-500">{post.like_count} 评论</div>
                    </div>
                  </div>
                ))}
                {topPosts.length === 0 && (
                  <div className="px-4 py-8 text-center text-gray-500">暂无数据</div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
