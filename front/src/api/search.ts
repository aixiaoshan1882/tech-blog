/**
 * 搜索和统计 API
 */

import { api } from './client'
import type { Stats, SearchResult } from '@/types'

// 搜索文章
export async function search(q: string, _page: number = 1, _pageSize: number = 10): Promise<SearchResult> {
  return api.get('/search', {
    q,
  })
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
