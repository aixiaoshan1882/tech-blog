/**
 * 注册页
 */

import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '@/api'

export default function Register() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [nickname, setNickname] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  
  // 验证码相关
  const [captchaToken, setCaptchaToken] = useState('')
  const [captchaQuestion, setCaptchaQuestion] = useState('')
  const [captchaImage, setCaptchaImage] = useState('')
  const [captchaAnswer, setCaptchaAnswer] = useState('')
  const [loadingCaptcha, setLoadingCaptcha] = useState(false)

  // 加载验证码
  const loadCaptcha = async () => {
    setLoadingCaptcha(true)
    try {
      const res = await api.get('/auth/captcha') as any
      if (res.code === 200) {
        setCaptchaToken(res.data.token)
        setCaptchaQuestion(res.data.question)
        setCaptchaImage(res.data.image)
      }
    } catch (err) {
      console.error('加载验证码失败', err)
    }
    setLoadingCaptcha(false)
  }

  useEffect(() => {
    loadCaptcha()
  }, [])

  const validateForm = () => {
    if (!email) {
      setError('请输入邮箱')
      return false
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('请输入有效的邮箱地址')
      return false
    }
    if (!nickname || nickname.length < 2) {
      setError('昵称至少需要2个字符')
      return false
    }
    if (nickname.length > 30) {
      setError('昵称不能超过30个字符')
      return false
    }
    if (password.length < 6) {
      setError('密码长度至少为6位')
      return false
    }
    if (password !== confirmPassword) {
      setError('两次密码输入不一致')
      return false
    }
    if (!captchaAnswer) {
      setError('请输入验证码')
      return false
    }
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!validateForm()) return

    setLoading(true)
    try {
      const res = await api.post('/auth/register', {
        email,
        password,
        nickname,
        captcha_token: captchaToken,
        captcha_answer: captchaAnswer
      }) as any
      
      if (res.code === 200) {
        setSuccess(true)
        setTimeout(() => navigate('/login'), 2000)
      } else {
        // 如果需要验证码，刷新验证码
        if (res.require_captcha) {
          loadCaptcha()
          setCaptchaAnswer('')
        }
        setError(res.detail || '注册失败，请稍后重试')
      }
    } catch (err: any) {
      const detail = err.response?.data?.detail || err.message
      // 如果需要验证码
      if (err.response?.data?.require_captcha) {
        loadCaptcha()
        setCaptchaAnswer('')
      }
      setError(detail || '注册失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center px-4 py-12">
        <div className="text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
            <span className="text-4xl">🎉</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">注册成功！</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">正在跳转到登录页...</p>
          <Link to="/login" className="text-blue-600 hover:text-blue-700 font-medium">
            直接登录 →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-200px)] flex items-center justify-center px-4 py-12">
      {/* Background decoration */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse" />
        <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 relative overflow-hidden">
          {/* Top gradient bar */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-green-500 via-blue-500 to-purple-500" />

          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <span className="text-3xl">✨</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              创建账号
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-2">
              加入我们，开始你的技术之旅
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
              <span>❌</span>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                📧 邮箱地址
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label htmlFor="nickname" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                👤 昵称
              </label>
              <input
                id="nickname"
                type="text"
                value={nickname}
                onChange={e => setNickname(e.target.value)}
                required
                minLength={2}
                maxLength={30}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="你的昵称（2-30个字符）"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                🔑 密码
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-4 py-3 pr-12 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="至少6位字符"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showPassword ? '🙈' : '👁'}
                </button>
              </div>
              <div className="mt-1.5 flex gap-1">
                {[1, 2, 3].map((level) => (
                  <div
                    key={level}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      password.length >= level * 2
                        ? level === 1 ? 'bg-red-500' : level === 2 ? 'bg-yellow-500' : 'bg-green-500'
                        : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                  />
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                ✅ 确认密码
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="再次输入密码"
              />
              {confirmPassword && password !== confirmPassword && (
                <p className="mt-1 text-xs text-red-500">⚠️ 两次密码不一致</p>
              )}
            </div>

            {/* 验证码 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                🔐 安全验证
              </label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">{captchaQuestion}</span>
                    <button
                      type="button"
                      onClick={loadCaptcha}
                      disabled={loadingCaptcha}
                      className="text-xs text-blue-600 hover:text-blue-700 disabled:opacity-50"
                    >
                      🔄 换一道
                    </button>
                  </div>
                  <input
                    type="text"
                    value={captchaAnswer}
                    onChange={e => setCaptchaAnswer(e.target.value.replace(/\D/g, ''))}
                    required
                    maxLength={10}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="输入答案"
                  />
                </div>
              </div>
              {captchaImage && (
                <p className="mt-2 text-xs text-gray-500">
                  💡 请计算上方数学题的结果
                </p>
              )}
            </div>

            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                id="agree"
                required
                className="mt-1 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="agree" className="text-xs text-gray-500 dark:text-gray-400">
                我已阅读并同意{' '}
                <a href="/terms" className="text-blue-600 hover:underline">《服务条款》</a>
                和{' '}
                <a href="/privacy" className="text-blue-600 hover:underline">《隐私政策》</a>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-green-500 to-blue-600 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:-translate-y-0.5"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  注册中...
                </span>
              ) : (
                '注册 ✨'
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              已有账号？{' '}
              <Link to="/login" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 font-semibold hover:underline">
                立即登录 →
              </Link>
            </p>
          </div>

          {/* 安全提示 */}
          <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center mb-2">🛡️ 安全注册</p>
            <div className="text-xs text-gray-600 dark:text-gray-300 space-y-1">
              <p>• 图形验证码防爬虫</p>
              <p>• IP注册频率限制</p>
              <p>• 临时邮箱禁止注册</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
