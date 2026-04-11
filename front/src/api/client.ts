/**
 * API 客户端 - 参考 MCP 客户端架构
 * 特点：类型安全、自动重试、统一错误处理
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

// 判断是否可重试
function isRetryable(error: ApiError): boolean {
  // 网络错误、5xx 错误可重试
  return error.status === 0 || error.status >= 500
}

// 延迟函数（指数退避）
async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 创建 API 请求函数
 */
function createRequester(config: ApiConfig) {
  async function request<T>(
    method: string,
    path: string,
    body?: unknown,
    options: { params?: Record<string, string> } = {}
  ): Promise<T> {
    let lastError: ApiError

    for (let attempt = 0; attempt < config.retries; attempt++) {
      try {
        // 修复 URL 构建：确保 baseURL 以 / 结尾，path 不以 / 开头
        const base = config.baseURL.endsWith('/') ? config.baseURL : config.baseURL + '/'
        const cleanPath = path.startsWith('/') ? path.slice(1) : path
        const url = new URL(base + cleanPath)
        
        // 添加查询参数
        if (options.params) {
          Object.entries(options.params).forEach(([k, v]) => {
            url.searchParams.set(k, v)
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
          signal: AbortSignal.timeout(config.timeout),
        })

        // 解析响应
        let data: ApiResponse<T>
        try {
          data = await response.json()
        } catch {
          throw new ApiError('响应解析失败', -1, response.status)
        }

        // 处理业务错误
        if (data.code !== 200) {
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
        if (error instanceof ApiError) {
          // 401 不重试
          if (error.status === 401) throw error
          
          // 可重试的错误
          if (isRetryable(error) && attempt < config.retries - 1) {
            lastError = error
            // 指数退避: 1s, 2s, 4s
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
      }
    }

    throw lastError!
  }

  return {
    get: <T>(path: string, params?: Record<string, string>) =>
      request<T>('GET', path, undefined, { params }),
    
    post: <T>(path: string, body: unknown) =>
      request<T>('POST', path, body),
    
    put: <T>(path: string, body: unknown) =>
      request<T>('PUT', path, body),
    
    patch: <T>(path: string, body: unknown) =>
      request<T>('PATCH', path, body),
    
    delete: <T>(path: string) =>
      request<T>('DELETE', path),
  }
}

export const api = createRequester(defaultConfig)
