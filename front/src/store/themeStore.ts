/**
 * 主题 Store - 使用轻量级 createStore
 */

export type Theme = 'light' | 'dark' | 'auto'

interface ThemeState {
  theme: Theme
  resolved: 'light' | 'dark'  // 实际生效的主题
}

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'auto') {
    return getSystemTheme()
  }
  return theme
}

// 创建带持久化的主题 Store
const { getState, setState, subscribe, hydrate } = (() => {
  const STORAGE_KEY = 'theme-storage'
  
  // 从 localStorage 恢复
  let initial: ThemeState = {
    theme: 'auto',
    resolved: getSystemTheme(),
  }
  
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      initial = {
        theme: parsed.theme || 'auto',
        resolved: resolveTheme(parsed.theme || 'auto'),
      }
    }
  } catch {
    // ignore
  }

  let state = initial
  const listeners = new Set<() => void>()

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // ignore
    }
  }

  function applyTheme(t: 'light' | 'dark') {
    document.documentElement.classList.remove('light', 'dark')
    document.documentElement.classList.add(t)
  }

  return {
    getState: () => state,
    
    setState: (updater: (prev: ThemeState) => ThemeState) => {
      const prev = state
      const next = updater(prev)
      if (Object.is(next, prev)) return
      state = next
      persist()
      applyTheme(state.resolved)
      listeners.forEach(l => l())
    },
    
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    
    hydrate: () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) {
          const parsed = JSON.parse(saved)
          state = {
            theme: parsed.theme || 'auto',
            resolved: resolveTheme(parsed.theme || 'auto'),
          }
          applyTheme(state.resolved)
        }
      } catch {
        // ignore
      }
    },
  }
})()

// 监听系统主题变化
if (typeof window !== 'undefined') {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  mq.addEventListener('change', () => {
    const current = getState()
    if (current.theme === 'auto') {
      setState(s => ({ ...s, resolved: getSystemTheme() }))
    }
  })
}

// 初始化时应用主题
if (typeof document !== 'undefined') {
  hydrate()
}

export const themeStore = {
  getState,
  setState,
  subscribe,
  
  // 便捷方法
  setTheme: (theme: Theme) => {
    setState(s => ({ ...s, theme, resolved: resolveTheme(theme) }))
  },
  
  toggle: () => {
    const current = getState().theme
    const next: Theme = current === 'light' ? 'dark' : current === 'dark' ? 'auto' : 'light'
    setState(s => ({ ...s, theme: next, resolved: resolveTheme(next) }))
  },
  
  isDark: () => getState().resolved === 'dark',
}
