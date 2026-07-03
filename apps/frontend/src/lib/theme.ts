export const THEME_STORAGE_KEY = 'xcash-theme';

export type Theme = 'light' | 'dark';

export function getPreferredTheme(): Theme {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  applyFavicon(theme);
}

export function applyFavicon(theme: Theme) {
  const link = document.querySelector<HTMLLinkElement>('link[data-xcash-favicon]');
  if (!link) {
    return;
  }
  link.href = theme === 'dark' ? '/favicon-dark.svg' : '/favicon.svg';
}
