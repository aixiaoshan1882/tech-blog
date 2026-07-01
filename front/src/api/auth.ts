/**
 * 认证 API
 */

import { api } from './client'
import { authStore } from '@/store/authStore'
import type { User } from '@/types'

export interface LoginInput {
  email: string
  password: string
}

export interface RegisterInput {
  email: string
  password: string
  nickname: string
  verify_code?: string
}

export interface AuthResponse {
  token: string
  user: User
}

export interface RegisterResponse {
  is_admin: boolean
}

// 登录
export async function login(input: LoginInput): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>('/auth/login', input)
  authStore.setAuth(response.token, response.user)
  return response
}

// 注册
export async function register(input: RegisterInput): Promise<RegisterResponse> {
  return api.post<RegisterResponse>('/auth/register', input)
}

// 登出
export function logout(): void {
  authStore.logout()
}

// 获取当前用户
export async function getCurrentUser(): Promise<User> {
  const user = await api.get<User>('/auth/me')
  // 同步更新 store
  const token = authStore.getToken()
  if (token) {
    authStore.setAuth(token, user)
  }
  return user
}

// 发送验证码
export async function sendVerifyCode(email: string): Promise<void> {
  return api.post('/auth/forgot-password', { email })
}

// 重置密码
export async function resetPassword(token: string, password: string): Promise<void> {
  return api.post('/auth/reset-password', { token, new_password: password })
}

// 更新个人资料
export async function updateProfile(data: { nickname?: string; avatar?: string }): Promise<User> {
  const user = await api.put<User>('/auth/profile', data)
  const currentToken = authStore.getToken()
  if (currentToken) {
    authStore.setAuth(currentToken, user)
  }
  return user
}

// 修改密码
export async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  return api.post('/auth/change-password', {
    old_password: oldPassword,
    new_password: newPassword,
  })
}
