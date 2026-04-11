/**
 * 轻量级 Store 实现
 * 参考 Claude Code 的 createStore 模式
 * 特点：无依赖、类型安全、订阅高效
 */

type Listener = () => void
type OnChange<T> = (args: { newState: T; oldState: T }) => void

export type Store<T> = {
  getState: () => T
  setState: (updater: (prev: T) => T) => void
  subscribe: (listener: Listener) => () => void
}

/**
 * 创建轻量级 Store
 * @param initialState 初始状态
 * @param onChange 状态变更回调
 */
export function createStore<T>(
  initialState: T,
  onChange?: OnChange<T>,
): Store<T> {
  let state = initialState
  const listeners = new Set<Listener>()

  return {
    getState: () => state,

    setState: (updater: (prev: T) => T) => {
      const prev = state
      const next = updater(prev)
      // 使用 Object.is 进行精确比较，避免不必要的更新
      if (Object.is(next, prev)) return
      state = next
      onChange?.({ newState: next, oldState: prev })
      // 通知所有监听器
      for (const listener of listeners) listener()
    },

    subscribe: (listener: Listener) => {
      listeners.add(listener)
      // 返回取消订阅函数
      return () => listeners.delete(listener)
    },
  }
}

/**
 * 创建带持久化的 Store
 * @param key localStorage 的键名
 * @param initialState 初始状态
 * @param onChange 状态变更回调
 */
export function createPersistedStore<T>(
  key: string,
  initialState: T,
  onChange?: OnChange<T>,
): Store<T> & { hydrate: () => void } {
  // 从 localStorage 恢复状态
  const restored = (() => {
    try {
      const saved = localStorage.getItem(key)
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })()

  const store = createStore<T>(
    restored ?? initialState,
    (args) => {
      // 自动持久化
      try {
        localStorage.setItem(key, JSON.stringify(args.newState))
      } catch {
        // localStorage 满或不可用时静默失败
      }
      onChange?.(args)
    }
  )

  return {
    ...store,
    // 手动触发恢复（用于初始化时）
    hydrate: () => {
      const saved = localStorage.getItem(key)
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          store.setState(() => parsed)
        } catch {
          // ignore
        }
      }
    },
  }
}

/**
 * 派生 Store：从现有 Store 派生新 Store
 */
export function deriveStore<T, D>(
  source: Store<T>,
  derive: (state: T) => D,
): Store<D> & { track(): () => void } {
  let derived = derive(source.getState())

  return {
    getState: () => derived,

    setState: (_updater: (prev: D) => D) => {
      // 派生状态不能直接修改
      throw new Error('Derived store is read-only')
    },

    subscribe: (listener: Listener) => {
      // 当源状态变化时，重新计算派生状态
      return source.subscribe(() => {
        derived = derive(source.getState())
        listener()
      })
    },

    // 手动追踪变化
    track: () => source.subscribe(() => {
      derived = derive(source.getState())
    }),
  }
}
