import { useState, useEffect } from 'react'

type Theme = 'light' | 'dark' | 'system'

export function useDarkMode() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('theme') as Theme) || 'system'
    }
    return 'system'
  })

  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const root = document.documentElement
    
    const updateTheme = () => {
      let dark = false
      
      if (theme === 'dark') {
        dark = true
      } else if (theme === 'system') {
        dark = window.matchMedia('(prefers-color-scheme: dark)').matches
      }
      
      setIsDark(dark)
      root.classList.toggle('dark', dark)
      localStorage.setItem('theme', theme)
    }

    updateTheme()

    // 监听系统主题变化
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => updateTheme()
    mediaQuery.addEventListener('change', handler)

    return () => mediaQuery.removeEventListener('change', handler)
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => {
      if (prev === 'light') return 'dark'
      if (prev === 'dark') return 'system'
      return 'light'
    })
  }

  return { theme, isDark, setTheme, toggleTheme }
}
