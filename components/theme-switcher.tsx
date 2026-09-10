'use client'
import { useEffect, useState } from 'react'
import { Palette } from 'lucide-react'
import { THEMES, THEME_KEY, type Theme } from './themes.ts'

export function ThemeSwitcher() {
  const [theme, setTheme] = useState<Theme | ''>('')

  useEffect(() => {
    try { setTheme((localStorage.getItem(THEME_KEY) as Theme) ?? '') } catch { /* blocked storage */ }
  }, [])

  const apply = (next: string) => {
    setTheme(next as Theme)
    const root = document.documentElement
    if (next) root.setAttribute('data-theme', next)
    else root.removeAttribute('data-theme')     // fall back to the OS preference
    try { next ? localStorage.setItem(THEME_KEY, next) : localStorage.removeItem(THEME_KEY) } catch { /* ignore */ }
  }

  return (
    <label className="flex items-center gap-1.5 text-sm" title="Theme">
      <Palette className="h-4 w-4 opacity-60" aria-hidden />
      <span className="sr-only">Theme</span>
      <select
        className="select select-sm select-ghost w-36"
        value={theme}
        onChange={(e) => apply(e.target.value)}
      >
        <option value="">system</option>
        {THEMES.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
    </label>
  )
}

/**
 * Applies the saved theme before first paint. Without this the page renders in the
 * default theme and then snaps to the chosen one — a visible flash on every navigation.
 */
export function ThemeScript() {
  const js = `try{var t=localStorage.getItem('${THEME_KEY}');if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}`
  return <script dangerouslySetInnerHTML={{ __html: js }} />
}
