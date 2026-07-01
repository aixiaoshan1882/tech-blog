/**
 * API 客户端 - 安全增强版
 * 特点：类型安全、自动重试、请求去重、详细错误处理
 */

import { authStore } from '@/store/authStore'

// API 响应结构
export interface ApiResponse<T = unknown> {
  code: number
  msg: string
  data: T
}

// 分页响应
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

export type { PaginatedResponse as PageRes }

// API 错误类
export class ApiError extends Error {
  constructor(
    message: string,
    public code: number,
    public status: number
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// 配置
interface ApiConfig {
  baseURL: string
  timeout: number
  retries: number
}

const defaultConfig: ApiConfig = {
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8787/api',
  timeout: 10000,
  retries: 3,
}

// 请求去重 Map
const pendingRequests = new Map<string, AbortController>()

// 判断是否可重试
function isRetryable(error: ApiError): boolean {
  // 网络错误、5xx 错误可重试
  return error.status === 0 || error.status >= 500
}

// 延迟函数（指数退避）
async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// 生成请求唯一标识
function generateRequestKey(method: string, path: string, body?: unknown): string {
  return `${method}:${path}:${JSON.stringify(body || {})}`
}

// 清理 URL 危险字符
function sanitizeUrlPart(str: string): string {
  if (typeof str !== 'string') return ''
  return str.replace(/[<>'"`;]/g, '').substring(0, 200)
}

/**
 * 创建 API 请求函数
 */
function createRequester(config: ApiConfig) {
  async function request<T>(
    method: string,
    path: string,
    body?: unknown,
    options: { params?: Record<string, string>; deduplicate?: boolean } = {}
  ): Promise<T> {
    // 生成请求 key
    const requestKey = generateRequestKey(method, path, body)
    
    // 检查是否有相同请求在进行中
    if (options.deduplicate && pendingRequests.has(requestKey)) {
      console.warn('检测到重复请求，已忽略:', requestKey)
      throw new ApiError('请求重复，已忽略', -2, 0)
    }
    
    let lastError: ApiError

    try {
      for (let attempt = 0; attempt < config.retries; attempt++) {
        const controller = new AbortController()
        let timeoutId: ReturnType<typeof setTimeout> | undefined
        let timedOut = false
        if (options.deduplicate) {
          pendingRequests.set(requestKey, controller)
        }

        try {
          timeoutId = setTimeout(() => {
            timedOut = true
            controller.abort()
          }, config.timeout)

        // 安全处理 URL 构建
        const base = config.baseURL.endsWith('/') ? config.baseURL : config.baseURL + '/'
        const cleanPath = sanitizeUrlPart(path.startsWith('/') ? path.slice(1) : path)
        const url = new URL(base + cleanPath)
        
        // 添加查询参数（安全处理）
        if (options.params) {
          Object.entries(options.params).forEach(([k, v]) => {
            url.searchParams.set(sanitizeUrlPart(k), sanitizeUrlPart(String(v)))
          })
        }

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        }

        // 添加 Token
        const token = authStore.getToken()
        if (token) {
          headers['Authorization'] = `Bearer ${token}`
        }

        const response = await fetch(url.toString(), {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        })

        // 解析响应
        let data: ApiResponse<T> | { detail?: string; msg?: string }
        try {
          data = await response.json()
        } catch {
          throw new ApiError('响应解析失败', -1, response.status)
        }

        if (!response.ok) {
          const errorData = data as Partial<ApiResponse<T>> & { detail?: string }
          const message = errorData.detail || errorData.msg || response.statusText || '请求失败'
          if (response.status === 401) {
            authStore.logout()
            window.location.href = '/login'
            throw new ApiError('登录已过期', -1, 401)
          }
          throw new ApiError(message, -1, response.status)
        }

        if (!('code' in data)) {
          return data as T
        }

        // 处理业务错误
        if (data.code !== 200) {
          // 根据错误码分类处理
          if (data.code === 401) {
            authStore.logout()
            window.location.href = '/login'
            throw new ApiError('登录已过期', -1, 401)
          }
          if (data.code === 403) {
            throw new ApiError('无权限操作', -1, 403)
          }
          if (data.code === 429) {
            throw new ApiError('操作太频繁，请稍后', -1, 429)
          }
          throw new ApiError(data.msg || '请求失败', data.code, response.status)
        }

        // 401 未授权
        if (response.status === 401) {
          authStore.logout()
          window.location.href = '/login'
          throw new ApiError('登录已过期', -1, 401)
        }

        return data.data

      } catch (error) {
        // 用户取消请求
        if (error instanceof Error && error.name === 'AbortError') {
          throw new ApiError(timedOut ? '请求超时，请稍后重试' : '请求已取消', -2, timedOut ? 408 : 0)
        }

        if (error instanceof ApiError) {
          // 401/403 不重试
          if (error.status === 401 || error.status === 403) throw error
          
          // 可重试的错误
          if (isRetryable(error) && attempt < config.retries - 1) {
            lastError = error
            await delay(Math.pow(2, attempt) * 1000)
            continue
          }
          throw error
        }
        
        // 网络错误
        const apiError = new ApiError(
          error instanceof Error ? error.message : '网络错误',
          -1,
          0
        )
        
        if (attempt < config.retries - 1) {
          lastError = apiError
          await delay(Math.pow(2, attempt) * 1000)
          continue
        }
        
        throw apiError
      } finally {
        if (timeoutId) clearTimeout(timeoutId)
      }
    }

    throw lastError!
    } finally {
      if (options.deduplicate) {
        pendingRequests.delete(requestKey)
      }
    }
  }

  return {
    get: <T>(path: string, params?: Record<string, string>, deduplicate?: boolean) =>
      request<T>('GET', path, undefined, { params, deduplicate }),
    
    post: <T>(path: string, body: unknown, deduplicate?: boolean) =>
      request<T>('POST', path, body, { deduplicate }),
    
    put: <T>(path: string, body: unknown) =>
      request<T>('PUT', path, body),
    
    patch: <T>(path: string, body: unknown) =>
      request<T>('PATCH', path, body),
    
    delete: <T>(path: string) =>
      request<T>('DELETE', path),
  }
}

export const api = createRequester(defaultConfig)

// 清理所有待处理请求
export function clearPendingRequests(): void {
  pendingRequests.forEach(controller => controller.abort())
  pendingRequests.clear()
}
