import { useState, useRef, useEffect } from 'react'
import { useTheme } from '../../lib/themeContext'
import type { ThemeFamily } from '../../styles/colors'
import { themeFamilies, resolveTheme, getColors, themes } from '../../styles/colors'

interface ThemePickerProps {
  onSelect?: () => void
  inline?: boolean
}

// SVG icons for each theme family - viewBox padded to avoid stroke clipping
const familyIcons: Record<ThemeFamily, (size: number) => JSX.Element> = {
  classic: (s) => (
    <svg width={s} height={s} viewBox="-1 -1 26 26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ overflow: 'visible', flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
  nord: (s) => (
    <svg width={s} height={s} viewBox="-1 -1 26 26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ overflow: 'visible', flexShrink: 0 }}>
      <path d="M17.7 7.7a7.5 7.5 0 1 0 0 8.6" />
      <path d="M21 12h-4" />
    </svg>
  ),
  tokyo: (s) => (
    <svg width={s} height={s} viewBox="-1 -1 26 26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ overflow: 'visible', flexShrink: 0 }}>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  ember: (s) => (
    <svg width={s} height={s} viewBox="-1 -1 26 26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ overflow: 'visible', flexShrink: 0 }}>
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14 0-5.5 3.5-7.5-2.5 5 1.5 4 1.5 8a2.5 2.5 0 0 1-2.5 2.5" />
      <path d="M12 14c1.5 0 2.5 1.12 2.5 2.5S13.5 19 12 19s-2.5-1.12-2.5-2.5S10.5 14 12 14z" />
      <path d="M12 19v3" />
    </svg>
  ),
  ocean: (s) => (
    <svg width={s} height={s} viewBox="-1 -1 26 26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ overflow: 'visible', flexShrink: 0 }}>
      <path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
      <path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
      <path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
    </svg>
  ),
  solar: (s) => (
    <svg width={s} height={s} viewBox="-1 -1 26 26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ overflow: 'visible', flexShrink: 0 }}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  ),
  midnight: (s) => (
    <svg width={s} height={s} viewBox="-1 -1 26 26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ overflow: 'visible', flexShrink: 0 }}>
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
      <path d="M19 3v4" />
      <path d="M21 5h-4" />
    </svg>
  ),
  forest: (s) => (
    <svg width={s} height={s} viewBox="-1 -1 26 26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ overflow: 'visible', flexShrink: 0 }}>
      <path d="M10 10v.2A3 3 0 0 1 8.9 16H5a3 3 0 0 1-1-5.8V10a3 3 0 0 1 6 0Z" />
      <path d="M7 16v6" />
      <path d="M13 19v3" />
      <path d="M15.7 14.4a4 4 0 0 0-6.8-4.2" />
      <path d="M18 13a4 4 0 0 0-3.3-6.9" />
      <path d="M19 13a4 4 0 0 1-3 3.9" />
      <path d="M13 16h-1a4 4 0 0 1-1.1-.1" />
    </svg>
  ),
  sakura: (s) => (
    <svg width={s} height={s} viewBox="-1 -1 26 26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ overflow: 'visible', flexShrink: 0 }}>
      <path d="M12 3c-1.2 0-2.4.6-3 1.7A3.6 3.6 0 0 0 4.6 9c-1 .6-1.7 1.8-1.7 3s.7 2.4 1.7 3c-.3 1.5.2 3 1.5 3.8a3.6 3.6 0 0 0 4.9 1.5c.6 1 1.8 1.7 3 1.7s2.4-.6 3-1.7a3.6 3.6 0 0 0 4.4-4.3A3.6 3.6 0 0 0 23 12a3.6 3.6 0 0 0-1.7-3c.3-1.5-.2-3-1.5-3.8A3.6 3.6 0 0 0 15 3.7 3.6 3.6 0 0 0 12 3z" />
    </svg>
  ),
  cyber: (s) => (
    <svg width={s} height={s} viewBox="-1 -1 26 26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ overflow: 'visible', flexShrink: 0 }}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M9 9h.01" />
      <path d="M15 9h.01" />
      <path d="M9 15h.01" />
      <path d="M15 15h.01" />
      <path d="M9 12h6" />
    </svg>
  ),
  dune: (s) => (
    <svg width={s} height={s} viewBox="-1 -1 26 26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ overflow: 'visible', flexShrink: 0 }}>
      <path d="M2 17c2-3 5-5 8-3s6 0 8-3 4-2 4-2" />
      <path d="M2 21c2-2 5-4 8-2s6-1 8-3 4-1 4-1" />
      <circle cx="17" cy="5" r="3" />
    </svg>
  ),
}

export function ThemePicker({ onSelect, inline = false }: ThemePickerProps) {
  const { theme, family, isDarkMode, setFamily, toggleDarkMode } = useTheme()
  const colors = getColors(theme)
  const [isOpen, setIsOpen] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isOpen])

  const handleSelectFamily = (f: ThemeFamily) => {
    setFamily(f)
    setIsOpen(false)
    onSelect?.()
  }

  const modeToggle = (
    <button
      onClick={(e) => {
        e.stopPropagation()
        toggleDarkMode()
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '32px',
        height: '32px',
        borderRadius: '8px',
        background: colors.bgTertiary,
        border: `1px solid ${colors.border}`,
        color: colors.textSecondary,
        cursor: 'pointer',
        transition: 'all 0.15s',
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = colors.bgHover
        e.currentTarget.style.color = colors.textPrimary
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = colors.bgTertiary
        e.currentTarget.style.color = colors.textSecondary
      }}
      title={isDarkMode ? 'Switch to light' : 'Switch to dark'}
    >
      {isDarkMode ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      )}
    </button>
  )

  // Inline mode: render theme icon grid directly (for drawer menus)
  if (inline) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: '4px',
          borderBottom: `1px solid ${colors.border}`,
        }}>
          <span style={{
            fontSize: '12px',
            color: colors.textTertiary,
          }}>
            {isDarkMode ? 'Dark' : 'Light'}
          </span>
          {modeToggle}
        </div>
        <div style={{
          display: 'flex',
          gap: '4px',
          flexWrap: 'wrap',
        }}>
          {themeFamilies.map(f => (
            <FamilyIconButton
              key={f}
              family={f}
              isSelected={f === family}
              currentColors={colors}
              onSelect={handleSelectFamily}
            />
          ))}
        </div>
      </div>
    )
  }

  // Popover mode: mode toggle above theme icon button
  return (
    <div ref={pickerRef} style={{ position: 'relative' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          {modeToggle}
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: colors.bgTertiary,
            border: `1px solid ${colors.border}`,
            color: colors.textSecondary,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = colors.bgHover
            e.currentTarget.style.color = colors.textPrimary
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = colors.bgTertiary
            e.currentTarget.style.color = colors.textSecondary
          }}
          title="Change theme"
        >
          {familyIcons[family](14)}
        </button>
      </div>

      {isOpen && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          left: 0,
          marginBottom: '8px',
          background: colors.bgSecondary,
          border: `1px solid ${colors.border}`,
          borderRadius: '12px',
          padding: '8px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          zIndex: 1000,
          display: 'flex',
          gap: '4px',
          flexWrap: 'wrap',
          width: 'max-content',
        }}>
          {themeFamilies.map(f => (
            <FamilyIconButton
              key={f}
              family={f}
              isSelected={f === family}
              currentColors={colors}
              onSelect={handleSelectFamily}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface FamilyIconButtonProps {
  family: ThemeFamily
  isSelected: boolean
  currentColors: ReturnType<typeof getColors>
  onSelect: (f: ThemeFamily) => void
}

function FamilyIconButton({ family, isSelected, currentColors, onSelect }: FamilyIconButtonProps) {
  const palette = themes[resolveTheme(family, 'dark')]
  const iconColor = isSelected ? palette.accent : currentColors.textSecondary

  return (
    <button
      onClick={() => onSelect(family)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '32px',
        height: '32px',
        borderRadius: '8px',
        background: isSelected ? currentColors.bgTertiary : 'transparent',
        border: isSelected ? `1px solid ${currentColors.border}` : '1px solid transparent',
        color: iconColor,
        cursor: 'pointer',
        transition: 'all 0.12s',
        overflow: 'visible',
      }}
      onMouseEnter={(e) => {
        if (!isSelected) e.currentTarget.style.background = currentColors.bgHover
      }}
      onMouseLeave={(e) => {
        if (!isSelected) e.currentTarget.style.background = isSelected ? currentColors.bgTertiary : 'transparent'
      }}
      title={family.charAt(0).toUpperCase() + family.slice(1).replace(/([A-Z])/g, ' $1')}
    >
      {familyIcons[family](16)}
    </button>
  )
}
