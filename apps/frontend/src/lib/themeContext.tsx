import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { ThemeFamily, ThemeMode, ThemeName } from '../styles/colors'
import { themeFamilies, resolveTheme, getColors } from '../styles/colors'

interface ThemeContextType {
  theme: ThemeName
  family: ThemeFamily
  mode: ThemeMode
  setFamily: (family: ThemeFamily) => void
  setMode: (mode: ThemeMode) => void
  isDarkMode: boolean
  toggleDarkMode: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [family, setFamilyState] = useState<ThemeFamily>(() => {
    try {
      const saved = localStorage.getItem('themeFamily')
      if (saved && themeFamilies.includes(saved as ThemeFamily)) {
        return saved as ThemeFamily
      }
      return 'classic'
    } catch {
      return 'classic'
    }
  })

  const [mode, setModeState] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem('themeMode')
      if (saved === 'light' || saved === 'dark') return saved
      // Migrate old preference
      const oldDarkMode = localStorage.getItem('darkMode')
      if (oldDarkMode === 'true') return 'dark'
      return 'light'
    } catch {
      return 'light'
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem('themeFamily', family)
      localStorage.setItem('themeMode', mode)
      // Keep old key in sync
      localStorage.setItem('darkMode', (mode === 'dark').toString())
    } catch {
      // Ignore localStorage errors
    }
    // Set color-scheme so browser-native scrollbars match the mode
    document.documentElement.style.colorScheme = mode

    // Set html + body background so the area behind the iOS keyboard matches the theme
    const colors = getColors(resolveTheme(family, mode))
    document.documentElement.style.backgroundColor = colors.bgSecondary
    document.body.style.backgroundColor = colors.bgSecondary

    // Sync key CSS variables so shadcn components (calendar, popover, etc.) match the theme
    const root = document.documentElement
    root.style.setProperty('--color-background', colors.bgPrimary)
    root.style.setProperty('--color-foreground', colors.textPrimary)
    root.style.setProperty('--color-muted', colors.bgTertiary)
    root.style.setProperty('--color-muted-foreground', colors.textTertiary)
    root.style.setProperty('--color-popover', colors.bgPrimary)
    root.style.setProperty('--color-popover-foreground', colors.textPrimary)
    root.style.setProperty('--color-border', colors.border)
    root.style.setProperty('--color-input', colors.border)
    root.style.setProperty('--color-primary', colors.accent)
    root.style.setProperty('--color-primary-foreground', colors.bgPrimary)
    root.style.setProperty('--color-accent', colors.bgHover)
    root.style.setProperty('--color-accent-foreground', colors.textPrimary)
  }, [family, mode])

  const theme = resolveTheme(family, mode)
  const isDarkMode = mode === 'dark'

  const setFamily = (f: ThemeFamily) => {
    if (themeFamilies.includes(f)) setFamilyState(f)
  }

  const setMode = (m: ThemeMode) => {
    if (m === 'light' || m === 'dark') setModeState(m)
  }

  const toggleDarkMode = () => {
    setModeState(prev => prev === 'light' ? 'dark' : 'light')
  }

  return (
    <ThemeContext.Provider value={{ theme, family, mode, setFamily, setMode, isDarkMode, toggleDarkMode }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
