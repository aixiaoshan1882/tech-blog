/**
 * ProtectedRoute - 需要登录才能访问的路由包装
 */

import { Navigate } from 'react-router-dom'
import { useSyncExternalStore } from 'react'
import { authStore } from '@/store/authStore'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const isAuthenticated = useSyncExternalStore(
    authStore.subscribe,
    () => authStore.getState().isAuthenticated,
    () => false
  )

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
