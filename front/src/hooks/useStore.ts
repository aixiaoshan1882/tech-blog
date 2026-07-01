/**
 * useStore Hook - 将 Store 连接到 React
 */

import { useState, useEffect, useCallback, useRef, useSyncExternalStore } from 'react'
import type { Store } from '@/store/createStore'

/**
 * 将普通 Store 转换为 React Hook
 */
export function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(
    store.subscribe,
    store.getState,
    store.getState
  )
}

/**
 * 使用带选择器的 Store Hook（避免不必要的重渲染）
 */
export function useStoreSelector<T, S>(
  store: Store<T>,
  selector: (state: T) => S,
  equalityFn?: (a: S, b: S) => boolean
): S {
  const [selected, setSelected] = useState<S>(() => selector(store.getState()))

  useEffect(() => {
    let current = selected
    const unsubscribe = store.subscribe(() => {
      const next = selector(store.getState())
      // 使用相等函数或 Object.is 比较
      const isEqual = equalityFn ? equalityFn(current, next) : Object.is(current, next)
      if (!isEqual) {
        current = next
        setSelected(next)
      }
    })
    return unsubscribe
  }, [store, selector, equalityFn])

  return selected
}

/**
 * 异步数据加载 Hook
 */
export function useAsync<T>(
  asyncFn: () => Promise<T>,
  deps: unknown[] = []
): {
  data: T | null
  loading: boolean
  error: Error | null
  refetch: () => void
} {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const execute = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await asyncFn()
      setData(result)
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    execute()
  }, [execute])

  return { data, loading, error, refetch: execute }
}

/**
 * 分页 Hook
 */
export function usePagination<T>(
  fetchFn: (page: number, pageSize: number) => Promise<{ items: T[]; total: number }>,
  pageSize: number = 10
) {
  const [items, setItems] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const requestIdRef = useRef(0)

  const load = useCallback(async (pageNum: number) => {
    const requestId = ++requestIdRef.current
    setLoading(true)
    setError(null)
    try {
      const result = await fetchFn(pageNum, pageSize)
      if (requestId !== requestIdRef.current) return
      setItems(result.items)
      setTotal(result.total)
      setPage(pageNum)
      setHasMore(pageNum * pageSize < result.total)
    } catch (e) {
      if (requestId !== requestIdRef.current) return
      setError(e instanceof Error ? e : new Error(String(e)))
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false)
      }
    }
  }, [fetchFn, pageSize])

  const goToPage = useCallback((pageNum: number) => {
    load(pageNum)
  }, [load])

  const nextPage = useCallback(() => {
    if (hasMore) {
      goToPage(page + 1)
    }
  }, [page, hasMore, goToPage])

  const prevPage = useCallback(() => {
    if (page > 1) {
      goToPage(page - 1)
    }
  }, [page, goToPage])

  // 初始加载
  useEffect(() => {
    load(1)
  }, [load])

  return {
    items,
    loading,
    error,
    page,
    total,
    pageSize,
    hasMore,
    goToPage,
    nextPage,
    prevPage,
  }
}
