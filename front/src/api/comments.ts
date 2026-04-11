/**
 * 评论 API
 */

import { api } from './client'
import type { Comment, PaginatedResponse } from '@/types'

export interface CreateCommentInput {
  postId: number
  content: string
  parentId?: number
}

export interface CommentFilters {
  page?: number
  pageSize?: number
  postId?: number
  status?: string
}

// 获取评论列表
export async function getComments(filters: CommentFilters = {}): Promise<PaginatedResponse<Comment>> {
  return api.get('/comments', {
    page: String(filters.page || 1),
    pageSize: String(filters.pageSize || 20),
    ...(filters.postId && { postId: String(filters.postId) }),
    ...(filters.status && { status: filters.status }),
  })
}

// 获取文章的评论
export async function getPostComments(postId: number): Promise<Comment[]> {
  return api.get(`/posts/${postId}/comments`)
}

// 创建评论
export async function createComment(input: CreateCommentInput): Promise<Comment> {
  return api.post('/comments', {
    post_id: input.postId,
    content: input.content,
    parent_id: input.parentId || 0,
    nickname: '用户', // 默认昵称
  })
}

// 更新评论
export async function updateComment(id: number, content: string): Promise<Comment> {
  return api.put(`/comments/${id}`, { content })
}

// 删除评论
export async function deleteComment(id: number): Promise<void> {
  return api.delete(`/comments/${id}`)
}

// 审核评论
export async function moderateComment(id: number, status: 'approved' | 'spam'): Promise<Comment> {
  return api.patch(`/comments/${id}/moderate`, { status })
}
