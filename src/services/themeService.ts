/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ThemeMode = 'light' | 'dark';

const THEME_STORAGE_KEY = 'be_ca_theme';

class ThemeService {
  private currentTheme: ThemeMode = 'light';

  constructor() {
    this.currentTheme = this.readStoredTheme();
    // Apply theme immediately on script execution
    this.applyTheme(this.currentTheme, false);
  }

  /**
   * Read stored theme from localStorage.
   * Defaults strictly to 'light' as mandated:
   * "Nếu chưa từng chọn: → mặc định Light Mode."
   */
  private readStoredTheme(): ThemeMode {
    try {
      if (typeof window === 'undefined') return 'light';
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'dark') return 'dark';
      if (saved === 'light') return 'light';
      return 'light';
    } catch {
      return 'light';
    }
  }

  /**
   * Get current active theme
   */
  public getTheme(): ThemeMode {
    return this.currentTheme;
  }

  /**
   * Check if current active theme is dark
   */
  public isDark(): boolean {
    return this.currentTheme === 'dark';
  }

  /**
   * Set theme ('light' or 'dark') and persist to browser localStorage.
   * Dispatches 'be_ca_theme_changed' custom event so all reactive components update instantly.
   */
  public setTheme(newTheme: ThemeMode): void {
    this.currentTheme = newTheme;
    this.applyTheme(newTheme, true);
  }

  /**
   * Toggle between 'light' and 'dark'
   */
  public toggleTheme(): ThemeMode {
    const next = this.currentTheme === 'dark' ? 'light' : 'dark';
    this.setTheme(next);
    return next;
  }

  /**
   * Apply CSS class to documentElement and dispatch update
   */
  private applyTheme(theme: ThemeMode, notify: boolean): void {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.setAttribute('data-theme', 'light');
      root.style.colorScheme = 'light';
    }

    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore private browsing storage quota exceptions
    }

    if (notify && typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('be_ca_theme_changed', {
          detail: { theme },
        })
      );
    }
  }
}

export const themeService = new ThemeService();
