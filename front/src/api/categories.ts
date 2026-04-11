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

// 获取所有分类
export async function getCategories(): Promise<Category[]> {
  return api.get('/categories')
}

// 获取单个分类
export async function getCategory(slugOrId: string): Promise<Category> {
  return api.get(`/categories/${slugOrId}`)
}

// 创建分类
export async function createCategory(input: CreateCategoryInput): Promise<Category> {
  return api.post('/categories', input)
}

// 更新分类
export async function updateCategory(id: number, input: CreateCategoryInput): Promise<Category> {
  return api.put(`/categories/${id}`, input)
}

// 删除分类
export async function deleteCategory(id: number): Promise<void> {
  return api.delete(`/categories/${id}`)
}
