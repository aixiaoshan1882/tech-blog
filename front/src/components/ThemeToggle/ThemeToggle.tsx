import { themeStore } from '@/store/themeStore';
import { useStore } from '@/hooks/useStore';

export default function ThemeToggle() {
  const state = useStore(themeStore);

  const toggleTheme = () => {
    const next = state.theme === 'light' ? 'dark' : state.theme === 'dark' ? 'auto' : 'light';
    themeStore.setTheme(next);
  };

  const labels: Record<string, string> = { light: '☀️', dark: '🌙', auto: '🖥️' };

  return (
    <button
      onClick={toggleTheme}
      className="text-xl"
      title={`当前: ${state.theme}`}
    >
      {labels[state.theme]}
    </button>
  );
}