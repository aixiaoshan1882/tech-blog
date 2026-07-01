import { useState, useEffect } from 'react'
import { api } from '@/api'

interface Log {
  id: number
  user_id: number
  action: string
  resource: string
  resource_id: number
  details: string
  ip_address: string
  user_agent: string
  created_at: string
  user_nickname?: string
  user_email?: string
}

export default function LogManage() {
  const [logs, setLogs] = useState<Log[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<any>(null)

  useEffect(() => {
    fetchLogs()
    fetchStats()
  }, [page])

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/logs?page=${page}&limit=20`) as any
      setLogs(res.items)
      setTotal(res.total)
    } catch (error) {
      console.error('获取日志失败', error)
    }
    setLoading(false)
  }

  const fetchStats = async () => {
    try {
      const res = await api.get('/logs/stats') as any
      setStats(res)
    } catch (error) {
      console.error('获取统计失败', error)
    }
  }

  const actionLabels: Record<string, string> = {
    login: '登录',
    create: '创建',
    update: '更新',
    delete: '删除',
    publish: '发布',
  }

  const actionColors: Record<string, string> = {
    login: 'bg-blue-100 text-blue-800',
    create: 'bg-green-100 text-green-800',
    update: 'bg-yellow-100 text-yellow-800',
    delete: 'bg-red-100 text-red-800',
    publish: 'bg-purple-100 text-purple-800',
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-4">操作日志</h1>
        
        {/* 统计卡片 */}
        {stats && (
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-2xl font-bold text-blue-600">{stats.total_count}</div>
              <div className="text-gray-500">总操作数</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-2xl font-bold text-green-600">{stats.today_count}</div>
              <div className="text-gray-500">今日操作</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4 col-span-2">
              <div className="text-sm text-gray-500 mb-2">操作类型分布</div>
              <div className="flex flex-wrap gap-2">
                {stats.action_stats?.map((stat: any) => (
                  <span key={stat.action} className={`px-2 py-1 text-xs rounded ${actionColors[stat.action] || 'bg-gray-100'}`}>
                    {actionLabels[stat.action] || stat.action}: {stat.count}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 日志列表 */}
      {loading ? (
        <div className="text-center py-8">加载中...</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">时间</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">用户</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">详情</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium">{log.user_nickname || '系统'}</div>
                    <div className="text-xs text-gray-400">{log.user_email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs rounded ${actionColors[log.action] || 'bg-gray-100'}`}>
                      {actionLabels[log.action] || log.action}
                    </span>
                    {log.resource && (
                      <div className="text-xs text-gray-400 mt-1">
                        {log.resource} #{log.resource_id}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {log.details || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {log.ip_address || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {/* 分页 */}
          <div className="px-6 py-4 flex justify-between items-center border-t">
            <span className="text-sm text-gray-500">共 {total} 条</span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 border rounded disabled:opacity-50"
              >
                上一页
              </button>
              <span className="px-3 py-1">第 {page} 页</span>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={logs.length < 20}
                className="px-3 py-1 border rounded disabled:opacity-50"
              >
                下一页
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
