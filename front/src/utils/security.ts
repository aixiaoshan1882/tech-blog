/**
 * 安全工具函数 - XSS 防护和输入验证
 */

/**
 * 转义 HTML 特殊字符
 */
export function escapeHtml(str: string): string {
  if (typeof str !== 'string') return str
  
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  }
  
  return str.replace(/[&<>"'/]/g, char => htmlEscapes[char] || char)
}

/**
 * 移除危险的协议伪协议
 */
export function removeDangerousProtocols(str: string): string {
  if (typeof str !== 'string') return str
  
  return str
    .replace(/javascript:/gi, '')
    .replace(/data:/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/on\w+=/gi, '') // 移除事件处理器属性
}

/**
 * 安全过滤用户输入（用于显示）
 */
export function sanitizeForDisplay(str: string): string {
  if (typeof str !== 'string') return str
  return removeDangerousProtocols(escapeHtml(str))
}

/**
 * 验证邮箱格式
 */
export function isValidEmail(email: string): boolean {
  if (typeof email !== 'string') return false
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return pattern.test(email.trim())
}

/**
 * 验证 URL 格式
 */
export function isValidUrl(url: string): boolean {
  if (typeof url !== 'string') return false
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

/**
 * 验证昵称格式
 */
export function isValidNickname(nickname: string): { valid: boolean; error?: string } {
  if (typeof nickname !== 'string') return { valid: false, error: '昵称格式错误' }
  
  const trimmed = nickname.trim()
  
  if (trimmed.length < 2) {
    return { valid: false, error: '昵称至少2个字符' }
  }
  
  if (trimmed.length > 30) {
    return { valid: false, error: '昵称不能超过30个字符' }
  }
  
  // 不允许纯数字
  if (/^\d+$/.test(trimmed)) {
    return { valid: false, error: '昵称不能为纯数字' }
  }
  
  return { valid: true }
}

/**
 * 验证密码强度
 */
export function isValidPassword(password: string): { valid: boolean; error?: string } {
  if (typeof password !== 'string') return { valid: false, error: '密码格式错误' }
  
  if (password.length < 6) {
    return { valid: false, error: '密码至少6位' }
  }
  
  if (password.length > 128) {
    return { valid: false, error: '密码太长' }
  }
  
  return { valid: true }
}

/**
 * 验证评论内容
 */
export function isValidComment(content: string): { valid: boolean; error?: string } {
  if (typeof content !== 'string') return { valid: false, error: '评论格式错误' }
  
  const trimmed = content.trim()
  
  if (trimmed.length < 2) {
    return { valid: false, error: '评论至少2个字符' }
  }
  
  if (trimmed.length > 2000) {
    return { valid: false, error: '评论不能超过2000字符' }
  }
  
  return { valid: true }
}

/**
 * 验证搜索关键词
 */
export function isValidSearchKeyword(keyword: string): { valid: boolean; error?: string } {
  if (typeof keyword !== 'string') return { valid: false, error: '关键词格式错误' }
  
  const trimmed = keyword.trim()
  
  if (trimmed.length < 2) {
    return { valid: false, error: '关键词至少2个字符' }
  }
  
  if (trimmed.length > 50) {
    return { valid: false, error: '关键词不能超过50字符' }
  }
  
  return { valid: true }
}

/**
 * 限制字符串长度
 */
export function truncate(str: string, maxLength: number): string {
  if (typeof str !== 'string') return ''
  if (str.length <= maxLength) return str
  return str.substring(0, maxLength)
}

/**
 * 安全解析 JSON（带默认值）
 */
export function safeJsonParse<T>(json: string | null | undefined, defaultValue: T): T {
  if (!json) return defaultValue
  try {
    const parsed = JSON.parse(json)
    return parsed as T
  } catch {
    return defaultValue
  }
}

/**
 * 防抖函数
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  
  return function(this: unknown, ...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    timeoutId = setTimeout(() => {
      fn.apply(this, args)
    }, delay)
  }
}

/**
 * 节流函数
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0
  
  return function(this: unknown, ...args: Parameters<T>) {
    const now = Date.now()
    if (now - lastCall >= delay) {
      lastCall = now
      fn.apply(this, args)
    }
  }
}
