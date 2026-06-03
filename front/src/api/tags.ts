/**
 * 标签 API
 */

import { api } from './client'
import type { Tag } from '@/types'

export interface CreateTagInput {
  name: string
  slug: string
}

function transformTag(raw: any): Tag {
  return {
    ...raw,
    postCount: raw.postCount ?? raw.post_count ?? 0,
  }
}

// 获取所有标签
export async function getTags(): Promise<Tag[]> {
  const tags = await api.get<any[]>('/tags')
  return tags.map(transformTag)
}

// 获取单个标签
export async function getTag(slugOrId: string): Promise<Tag> {
  const tag = await api.get<any>(`/tags/${slugOrId}`)
  return transformTag(tag)
}

// 创建标签
export async function createTag(input: CreateTagInput): Promise<Tag> {
  return api.post('/tags', input)
}

// 更新标签
export async function updateTag(id: number, input: CreateTagInput): Promise<Tag> {
  return api.put(`/tags/${id}`, input)
}

// 删除标签
export async function deleteTag(id: number): Promise<void> {
  return api.delete(`/tags/${id}`)
}

// 获取热门标签
export async function getHotTags(limit: number = 10): Promise<Tag[]> {
  const tags = await api.get<any[]>('/tags/hot', { limit: String(limit) })
  return tags.map(transformTag)
}
