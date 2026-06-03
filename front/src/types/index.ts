/**
 * 类型定义 - 适配后端返回的扁平结构
 */

// 文章 (后端返回的扁平结构)
export interface Post {
  id: number
  title: string
  slug: string
  content: string
  excerpt?: string
  cover?: string
  coverImage?: string  // 兼容别名前缀
  is_public: number
  view_count: number
  likeCount?: number
  commentCount?: number
  viewCount?: number
  created_at: string
  publishedAt?: string
  updated_at?: string
  // 扁平化的关联数据
  category_id: number
  category_name?: string
  category_slug?: string
  // 嵌套的关联对象 (转换后的)
  category?: Category
  tags: Tag[]
  author?: User
}

export interface Category {
  id: number
  name: string
  slug: string
  description?: string
  postCount?: number
  children?: Category[]
}

export interface Tag {
  id: number
  name: string
  slug: string
  postCount?: number
}

// 评论
export interface Comment {
  id: number
  content: string
  author: User
  post: { id: number; title: string }
  parent?: { id: number }
  status: 'pending' | 'approved' | 'spam'
  createdAt: string
  replies?: Comment[]
}

// 用户
export interface User {
  id: number
  email: string
  nickname: string
  avatar?: string
  role: 'admin' | 'author' | 'reader'
  createdAt: string
}

// 搜索 (匹配 Worker API 返回格式)
export interface SearchResult {
  items: Post[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

// 分页响应
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

// 统计数据
export interface Stats {
  totalPosts: number
  totalViews: number
  totalComments: number
  totalCategories: number
  totalTags: number
}

/**
 * 将后端返回的扁平 Post 转换为嵌套结构
 */
export function transformPost(raw: any): Post {
  return {
    ...raw,
    // 统一字段名
    coverImage: raw.coverImage || raw.cover,
    viewCount: raw.viewCount || raw.view_count,
    likeCount: raw.likeCount || raw.like_count,
    commentCount: raw.commentCount || raw.comment_count,
    publishedAt: raw.publishedAt || raw.published_at,
    // 转换 category
    category: raw.category || {
      id: raw.category_id,
      name: raw.category_name,
      slug: raw.category_slug,
    },
    // 标签已经是数组
    tags: raw.tags || [],
  }
}

/**
 * 批量转换文章列表
 */
export function transformPosts(rawList: any[]): Post[] {
  return rawList.map(transformPost)
}
