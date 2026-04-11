import { useDarkMode } from '@/hooks/useDarkMode'

export default function ThemeToggle() {
  const { theme, isDark, toggleTheme } = useDarkMode()

  const icons = {
    light: '☀️',
    dark: '🌙',
    system: '💻',
  }

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
      title={`当前: ${theme === 'light' ? '浅色' : theme === 'dark' ? '深色' : '跟随系统'}`}
    >
      <span className="text-xl">{icons[theme]}</span>
    </button>
  )
}
