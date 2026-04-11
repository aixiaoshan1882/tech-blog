/**
 * 认证 Store - 使用轻量级 createStore
 */

export interface User {
  id: number
  email: string
  nickname: string
  avatar?: string
  role: 'admin' | 'author' | 'reader'
}

interface AuthState {
  token: string | null
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
}

const STORAGE_KEY = 'auth-storage'

// 恢复状态
function restoreState(): AuthState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      return {
        token: parsed.token || null,
        user: parsed.user || null,
        isAuthenticated: !!(parsed.token && parsed.user),
        isLoading: false,
      }
    }
  } catch {
    // ignore
  }
  return {
    token: null,
    user: null,
    isAuthenticated: false,
    isLoading: false,
  }
}

let state = restoreState()
const listeners = new Set<() => void>()

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      token: state.token,
      user: state.user,
    }))
  } catch {
    // ignore
  }
}

export const authStore = {
  getState: () => state,
  
  setState: (updater: (prev: AuthState) => AuthState) => {
    const prev = state
    const next = updater(prev)
    if (Object.is(next, prev)) return
    state = next
    persist()
    listeners.forEach(l => l())
  },
  
  subscribe: (listener: () => void) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },

  // 设置认证
  setAuth: (token: string, user: User) => {
    state = { token, user, isAuthenticated: true, isLoading: false }
    persist()
    listeners.forEach(l => l())
  },

  // 登出
  logout: () => {
    state = { token: null, user: null, isAuthenticated: false, isLoading: false }
    localStorage.removeItem(STORAGE_KEY)
    listeners.forEach(l => l())
  },

  // 设置加载状态
  setLoading: (isLoading: boolean) => {
    state = { ...state, isLoading }
    listeners.forEach(l => l())
  },

  // 获取 Token
  getToken: () => state.token,

  // 检查是否有权限
  hasRole: (role: User['role']) => {
    if (!state.user) return false
    const hierarchy = { admin: 3, author: 2, reader: 1 }
    return (hierarchy[state.user.role] || 0) >= (hierarchy[role] || 0)
  },
}
