import { useState, useEffect, useRef } from 'react'
import { useTheme } from '../../lib/themeContext'
import { getColors } from '../../styles/colors'

export interface SuggestionNote {
  id: string
  title: string
  aspect_color?: string | undefined
  aspect_name?: string | undefined
}

interface WikiLinkSuggestionProps {
  query: string
  notes: SuggestionNote[]
  onSelect: (title: string) => void
  onClose: () => void
  position: { top: number; left: number }
}

export function WikiLinkSuggestion({ query, notes, onSelect, onClose, position }: WikiLinkSuggestionProps) {
  const { theme, isDarkMode } = useTheme()
  const colors = getColors(theme)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const filtered = notes.filter(n =>
    n.title.toLowerCase().includes(query.toLowerCase())
  )

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(i => Math.min(i + 1, filtered.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(i => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (filtered[selectedIndex]) {
          onSelect(filtered[selectedIndex].title)
        } else if (query.trim()) {
          onSelect(query.trim())
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [filtered, selectedIndex, query, onSelect, onClose])

  if (filtered.length === 0 && !query.trim()) {
    return null
  }

  return (
    <div
      ref={listRef}
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        background: isDarkMode ? '#1f2937' : '#ffffff',
        border: `1px solid ${colors.border}`,
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        zIndex: 100,
        maxHeight: '200px',
        overflow: 'auto',
        minWidth: '200px',
        maxWidth: '300px',
      }}
    >
      {filtered.map((note, index) => (
        <button
          key={note.id}
          onMouseDown={(e) => {
            e.preventDefault()
            onSelect(note.title)
          }}
          style={{
            width: '100%',
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: index === selectedIndex
              ? (isDarkMode ? '#374151' : '#f0f0f0')
              : 'transparent',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left',
            fontSize: '13px',
            color: colors.textPrimary,
            borderBottom: `1px solid ${colors.border}`,
          }}
        >
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: note.aspect_color || '#6b7280',
            flexShrink: 0,
          }} />
          <span style={{
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {note.title}
          </span>
          <span style={{
            fontSize: '11px',
            color: colors.textTertiary,
            flexShrink: 0,
          }}>
            {note.aspect_name || ''}
          </span>
        </button>
      ))}
      {query.trim() && !filtered.some(n => n.title.toLowerCase() === query.toLowerCase()) && (
        <button
          onMouseDown={(e) => {
            e.preventDefault()
            onSelect(query.trim())
          }}
          style={{
            width: '100%',
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: filtered.length === 0
              ? (isDarkMode ? '#374151' : '#f0f0f0')
              : 'transparent',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left',
            fontSize: '13px',
            color: colors.textSecondary,
            fontStyle: 'italic',
          }}
        >
          Create "{query.trim()}"
        </button>
      )}
    </div>
  )
}
