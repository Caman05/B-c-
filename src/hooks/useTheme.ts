import { useState, useEffect } from 'react';
import { themeService, ThemeMode } from '../services/themeService';

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>(() => themeService.getTheme());

  useEffect(() => {
    const handleThemeChange = (e: any) => {
      const newTheme = e.detail?.theme || themeService.getTheme();
      setThemeState(newTheme);
    };

    window.addEventListener('be_ca_theme_changed', handleThemeChange);
    return () => {
      window.removeEventListener('be_ca_theme_changed', handleThemeChange);
    };
  }, []);

  const toggleTheme = () => {
    const next = themeService.toggleTheme();
    setThemeState(next);
    return next;
  };

  const setTheme = (mode: ThemeMode) => {
    themeService.setTheme(mode);
    setThemeState(mode);
  };

  return {
    theme,
    isDark: theme === 'dark',
    toggleTheme,
    setTheme,
  };
}
