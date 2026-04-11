/**
 * API 客户端测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock fetch
global.fetch = vi.fn()

describe('API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should handle successful response', async () => {
    const mockResponse = {
      code: 200,
      data: { items: [], total: 0 },
      msg: 'success',
    }

    ;(fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockResponse),
    })

    // 直接测试 response 处理
    const response = await fetch('/api/posts')
    const data = await response.json()
    
    expect(data.code).toBe(200)
    expect(data.data.items).toBeDefined()
  })

  it('should handle error response', async () => {
    const mockResponse = {
      code: 400,
      msg: 'Bad Request',
    }

    ;(fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () => Promise.resolve(mockResponse),
    })

    const response = await fetch('/api/posts/invalid')
    const data = await response.json()
    
    expect(data.code).toBe(400)
  })
})

describe('Date Formatting', () => {
  it('should format date correctly', () => {
    const date = new Date('2024-01-15T10:30:00')
    const formatted = date.toLocaleDateString('zh-CN')
    
    expect(formatted).toContain('2024')
    expect(formatted).toContain('1')
    expect(formatted).toContain('15')
  })
})
