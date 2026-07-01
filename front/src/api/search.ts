/**
 * 搜索和统计 API
 */

import { api } from './client'
import type { Stats, SearchResult } from '@/types'
import { transformPosts } from '@/types'

// 搜索文章
export async function search(q: string, page: number = 1, pageSize: number = 10): Promise<SearchResult> {
  const result = await api.get<any>('/search', {
    q,
    page: String(page),
    limit: String(pageSize),
  })

  if (Array.isArray(result)) {
    return {
      items: transformPosts(result),
      total: result.length,
      page,
      limit: pageSize,
      hasMore: false,
    }
  }

  return {
    ...result,
    items: transformPosts(result.items || []),
  }
}

// 获取统计数据
export async function getStats(): Promise<Stats> {
  return api.get('/stats')
}

// 获取网站信息
export async function getSiteInfo(): Promise<{
  name: string
  description: string
  keywords: string[]
  analytics?: string
}> {
  return api.get('/site/info')
}
