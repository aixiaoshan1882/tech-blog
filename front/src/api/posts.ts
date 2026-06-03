/**
 * 文章 API
 */

import { api } from './client'
import type { Post, PaginatedResponse } from '@/types'

export interface CreatePostInput {
  title: string
  slug: string
  content: string
  excerpt?: string
  coverImage?: string
  status?: 'draft' | 'published' | 'archived'
  categoryId: number
  tagIds?: number[]
}

export interface UpdatePostInput extends Partial<CreatePostInput> {}

export interface PostFilters {
  page?: number
  pageSize?: number
  categoryId?: number
  categorySlug?: string
  tagId?: number
  tagSlug?: string
  status?: string
  keyword?: string
}

// Worker 返回的原始数据（扁平结构）
interface RawPost {
  id: number
  title: string
  slug: string
  content: string
  excerpt?: string
  cover?: string
  category_id: number
  category_name?: string
  category_slug?: string
  is_public: number
  view_count: number
  like_count: number
  comment_count: number
  created_at: string
  updated_at: string
  tags?: { id: number; name: string; slug: string }[]
}

// 转换 Worker 返回的扁平数据为嵌套结构
function transformPost(raw: RawPost): Post {
  return {
    id: raw.id,
    title: raw.title,
    slug: raw.slug,
    content: raw.content,
    excerpt: raw.excerpt,
    coverImage: raw.cover,
    is_public: raw.is_public,
    view_count: raw.view_count,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
    category: raw.category_id ? {
      id: raw.category_id,
      name: raw.category_name || '',
      slug: raw.category_slug || '',
    } : undefined,
    category_id: raw.category_id,
    category_name: raw.category_name,
    category_slug: raw.category_slug,
    tags: raw.tags || [],
    author: {
      id: 1,
      email: 'admin@tech-blog.com',
      nickname: '博主',
      role: 'admin',
      createdAt: raw.created_at,
    },
    viewCount: raw.view_count,
    likeCount: raw.like_count || 0,
    commentCount: raw.comment_count || 0,
    publishedAt: raw.created_at,
  }
}

// 获取文章列表
export async function getPosts(filters: PostFilters = {}): Promise<PaginatedResponse<Post>> {
  const result = await api.get<{ items: RawPost[]; total: number; page: number; limit: number; hasMore: boolean }>('/posts', {
    page: String(filters.page || 1),
    limit: String(filters.pageSize || 10),
    ...(filters.categorySlug && { category: filters.categorySlug }),
    ...(filters.categoryId && { categoryId: String(filters.categoryId) }),
    ...(filters.tagSlug && { tag: filters.tagSlug }),
    ...(filters.tagId && { tagId: String(filters.tagId) }),
    ...(filters.status && { status: filters.status }),
    ...(filters.keyword && { keyword: filters.keyword }),
  })
  return {
    ...result,
    pageSize: result.limit,
    items: result.items.map(transformPost),
  }
}

// 获取已发布的文章列表（前台用）
export async function getPublishedPosts(filters: Omit<PostFilters, 'status'> = {}): Promise<PaginatedResponse<Post>> {
  return getPosts({ ...filters, status: 'published' })
}

// 获取单篇文章
export async function getPost(slugOrId: string): Promise<Post> {
  const raw = await api.get<RawPost>(`/posts/${slugOrId}`)
  return transformPost(raw)
}

// 创建文章
export async function createPost(input: CreatePostInput): Promise<Post> {
  return api.post('/posts', input)
}

// 更新文章
export async function updatePost(id: number, input: UpdatePostInput): Promise<Post> {
  return api.put(`/posts/${id}`, input)
}

// 删除文章
export async function deletePost(id: number): Promise<void> {
  return api.delete(`/posts/${id}`)
}

// 获取热门文章
export async function getHotPosts(limit: number = 5): Promise<Post[]> {
  const result = await api.get<RawPost[]>('/posts/hot', { limit: String(limit) })
  return result.map(transformPost)
}

// 获取最新文章
export async function getLatestPosts(limit: number = 5): Promise<Post[]> {
  const result = await api.get<RawPost[]>('/posts/latest', { limit: String(limit) })
  return result.map(transformPost)
}

// 点赞文章
export async function likePost(id: number): Promise<{ like_count: number }> {
  return api.post(`/posts/${id}/like`, {})
}
