export type ThemeMode = 'auto' | 'light' | 'dark'

const STORAGE_KEY_THEME = 'araho_theme'

export function getTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_THEME)
    if (saved === 'light' || saved === 'dark' || saved === 'auto') return saved
  } catch {}
  return 'auto'
}

export function setTheme(mode: ThemeMode): void {
  try {
    localStorage.setItem(STORAGE_KEY_THEME, mode)
  } catch {}
  applyTheme(mode)
  window.dispatchEvent(new CustomEvent('araho_theme_changed', { detail: mode }))
}

export function applyTheme(mode: ThemeMode = getTheme()): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (mode === 'auto') {
    root.removeAttribute('data-theme')
  } else {
    root.setAttribute('data-theme', mode)
  }
}

// Initialise le thème immédiatement au chargement du bundle
if (typeof window !== 'undefined') {
  applyTheme()
}
