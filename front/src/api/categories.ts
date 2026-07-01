/**
 * 分类 API
 */

import { api } from './client'
import type { Category } from '@/types'

export interface CreateCategoryInput {
  name: string
  slug: string
  description?: string
  parentId?: number
}

function toCategoryPayload(input: CreateCategoryInput) {
  return {
    name: input.name,
    slug: input.slug,
    description: input.description,
    parent_id: input.parentId ?? 0,
  }
}

function transformCategory(raw: any): Category {
  return {
    ...raw,
    postCount: raw.postCount ?? raw.post_count ?? 0,
    children: raw.children?.map(transformCategory) ?? [],
  }
}

// 获取所有分类
export async function getCategories(): Promise<Category[]> {
  const categories = await api.get<any[]>('/categories')
  return categories.map(transformCategory)
}

// 获取单个分类
export async function getCategory(slugOrId: string): Promise<Category> {
  const category = await api.get<any>(`/categories/${slugOrId}`)
  return transformCategory(category)
}

// 创建分类
export async function createCategory(input: CreateCategoryInput): Promise<Category> {
  return api.post('/categories', toCategoryPayload(input))
}

// 更新分类
export async function updateCategory(id: number, input: CreateCategoryInput): Promise<Category> {
  return api.put(`/categories/${id}`, toCategoryPayload(input))
}

// 删除分类
export async function deleteCategory(id: number): Promise<void> {
  return api.delete(`/categories/${id}`)
}
