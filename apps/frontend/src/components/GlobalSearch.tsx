// Global search component with keyboard shortcut (Cmd/Ctrl + K)

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../lib/authContext'
import { useTheme } from '../lib/themeContext'
import { getColors, hexToRgba } from '../styles/colors'
import { fontSize, fontWeight } from '../styles/typography'
import {
  searchAll,
  SearchResult,
  SearchResultType,
  getTypeIcon,
  getTypeLabel
} from '../lib/searchService'

interface GlobalSearchProps {
  onSelectEvent?: (eventId: string) => void
  onSelectTask?: (taskId: string) => void
  onSelectGoal?: (goalId: string) => void
  /** When true, renders the search UI inline without its own backdrop/modal wrapper */
  inline?: boolean
  /** Called when the search is closed (useful in inline mode for parent to dismiss) */
  onClose?: () => void
}

export function GlobalSearch({
  onSelectEvent,
  onSelectTask,
  onSelectGoal,
  inline = false,
  onClose
}: GlobalSearchProps) {
  const { user, session } = useAuth()
  const { theme, isDarkMode } = useTheme()
  const colors = getColors(theme)

  const [isOpen, setIsOpen] = useState(inline)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [activeFilters, setActiveFilters] = useState<SearchResultType[]>(['event', 'task', 'goal'])

  const inputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Handle keyboard shortcut (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K (Mac) or Ctrl+K (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(true)
      }
      // Escape to close
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault()
        closeSearch()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    if (!query || query.length < 2) {
      setResults([])
      return
    }

    debounceRef.current = setTimeout(async () => {
      if (!user || !session) return

      setLoading(true)
      const { results: searchResults } = await searchAll(
        user,
        session.access_token,
        query,
        { types: activeFilters, limit: 15 }
      )
      setResults(searchResults)
      setSelectedIndex(0)
      setLoading(false)
    }, 300)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [query, activeFilters, user, session])

  // Handle keyboard navigation in results
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && results.length > 0) {
      e.preventDefault()
      handleSelectResult(results[selectedIndex])
    }
  }, [results, selectedIndex])

  // Scroll selected item into view
  useEffect(() => {
    if (resultsRef.current && results.length > 0) {
      const selectedElement = resultsRef.current.children[selectedIndex] as HTMLElement
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [selectedIndex, results.length])

  const closeSearch = () => {
    setIsOpen(false)
    setQuery('')
    setResults([])
    setSelectedIndex(0)
    onClose?.()
  }

  const handleSelectResult = (result: SearchResult) => {
    switch (result.type) {
      case 'event':
        onSelectEvent?.(result.id)
        break
      case 'task':
        onSelectTask?.(result.id)
        break
      case 'goal':
        onSelectGoal?.(result.id)
        break
    }
    closeSearch()
  }

  const toggleFilter = (type: SearchResultType) => {
    setActiveFilters(prev => {
      if (prev.includes(type)) {
        // Don't allow removing all filters
        if (prev.length === 1) return prev
        return prev.filter(t => t !== type)
      }
      return [...prev, type]
    })
  }

  if (!isOpen && !inline) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          background: colors.bgTertiary,
          border: `1px solid ${colors.border}`,
          borderRadius: '6px',
          color: colors.textSecondary,
          fontSize: fontSize.sm,
          cursor: 'pointer',
          transition: 'all 0.15s'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = colors.bgHover
          e.currentTarget.style.borderColor = colors.textTertiary
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = colors.bgTertiary
          e.currentTarget.style.borderColor = colors.border
        }}
      >
        <span style={{ fontSize: fontSize.base }}></span>
        <span>Search...</span>
        <span style={{
          padding: '2px 6px',
          background: colors.bgSecondary,
          borderRadius: '4px',
          fontSize: fontSize.xs,
          fontWeight: fontWeight.medium
        }}>
          ⌘K
        </span>
      </button>
    )
  }

  const searchUI = (
    <div
      style={{
        background: colors.bgPrimary,
        borderRadius: '12px',
        boxShadow: inline ? 'none' : '0 20px 60px rgba(0, 0, 0, 0.3)',
        overflow: 'hidden'
      }}
    >
      {/* Search Input */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '16px 20px',
        borderBottom: `1px solid ${colors.border}`
      }}>
        <span style={{ fontSize: '18px', marginRight: '12px' }}>🔍</span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search events, tasks, and goals..."
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontSize: '16px',
            color: colors.textPrimary
          }}
        />
        {loading && (
          <span style={{ color: colors.textSecondary, fontSize: fontSize.xs }}>
            Searching...
          </span>
        )}
        <button
          onClick={closeSearch}
          style={{
            marginLeft: '12px',
            padding: '4px 8px',
            background: colors.bgTertiary,
            border: 'none',
            borderRadius: '4px',
            color: colors.textSecondary,
            fontSize: fontSize.xs,
            cursor: 'pointer'
          }}
        >
          ESC
        </button>
      </div>

      {/* Filter Pills */}
      <div style={{
        display: 'flex',
        gap: '8px',
        padding: '12px 20px',
        borderBottom: `1px solid ${colors.border}`
      }}>
        {(['event', 'task', 'goal'] as SearchResultType[]).map(type => (
          <button
            key={type}
            onClick={() => toggleFilter(type)}
            style={{
              padding: '4px 12px',
              background: activeFilters.includes(type)
                ? (isDarkMode ? '#d0d0d0' : '#000')
                : colors.bgTertiary,
              color: activeFilters.includes(type)
                ? (isDarkMode ? '#2a2a2a' : '#fff')
                : colors.textSecondary,
              border: 'none',
              borderRadius: '16px',
              fontSize: fontSize.xs,
              fontWeight: fontWeight.medium,
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
          >
            {getTypeIcon(type)} {getTypeLabel(type)}s
          </button>
        ))}
      </div>

      {/* Results */}
      <div
        ref={resultsRef}
        style={{
          maxHeight: '400px',
          overflowY: 'auto',
          padding: results.length > 0 ? '8px' : '0'
        }}
      >
        {query.length >= 2 && results.length === 0 && !loading && (
          <div style={{
            padding: '40px 20px',
            textAlign: 'center',
            color: colors.textSecondary
          }}>
            No results found for "{query}"
          </div>
        )}

        {query.length < 2 && (
          <div style={{
            padding: '40px 20px',
            textAlign: 'center',
            color: colors.textTertiary,
            fontSize: fontSize.sm
          }}>
            Type at least 2 characters to search
          </div>
        )}

        {results.map((result, index) => (
          <div
            key={`${result.type}-${result.id}`}
            onClick={() => handleSelectResult(result)}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              padding: '12px 16px',
              background: index === selectedIndex ? colors.bgHover : 'transparent',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'background 0.1s'
            }}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            {/* Type Icon */}
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              background: result.categoryColor
                ? hexToRgba(result.categoryColor, 0.15)
                : colors.bgTertiary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: fontSize.base,
              flexShrink: 0
            }}>
              {getTypeIcon(result.type)}
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '2px'
              }}>
                <span style={{
                  fontSize: fontSize.base,
                  fontWeight: fontWeight.medium,
                  color: colors.textPrimary,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {result.title}
                </span>
                {result.priority && result.priority !== 'low' && (
                  <span style={{
                    fontSize: fontSize.xs,
                    padding: '2px 6px',
                    borderRadius: '3px',
                    background: result.priority === 'urgent' ? '#fee' : result.priority === 'high' ? '#fef0e6' : '#fff9e6',
                    color: result.priority === 'urgent' ? '#c00' : result.priority === 'high' ? '#c60' : '#880',
                    fontWeight: fontWeight.medium
                  }}>
                    {result.priority}
                  </span>
                )}
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: fontSize.xs,
                color: colors.textSecondary
              }}>
                <span style={{
                  padding: '1px 6px',
                  background: colors.bgTertiary,
                  borderRadius: '3px',
                  fontSize: fontSize.xs,
                  textTransform: 'uppercase',
                  fontWeight: fontWeight.medium
                }}>
                  {getTypeLabel(result.type)}
                </span>
                {result.category && (
                  <span style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    {result.categoryColor && (
                      <span style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: result.categoryColor
                      }} />
                    )}
                    {result.category}
                  </span>
                )}
                <span>•</span>
                <span>{result.preview}</span>
              </div>
            </div>

            {/* Enter hint for selected */}
            {index === selectedIndex && (
              <span style={{
                padding: '2px 6px',
                background: colors.bgTertiary,
                borderRadius: '4px',
                fontSize: fontSize.xs,
                color: colors.textSecondary,
                alignSelf: 'center'
              }}>
                ↵
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        padding: '12px 20px',
        borderTop: `1px solid ${colors.border}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: fontSize.xs,
        color: colors.textTertiary
      }}>
        <div style={{ display: 'flex', gap: '16px' }}>
          <span>↑↓ Navigate</span>
          <span>↵ Select</span>
          <span>ESC Close</span>
        </div>
        {results.length > 0 && (
          <span>{results.length} result{results.length !== 1 ? 's' : ''}</span>
        )}
      </div>
    </div>
  )

  // Inline mode: render search UI directly without backdrop/fixed positioning
  if (inline) {
    return searchUI
  }

  // Standalone mode: render with backdrop and fixed positioning
  return (
    <>
      <div
        onClick={closeSearch}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 1000,
          backdropFilter: 'blur(2px)'
        }}
      />
      <div
        style={{
          position: 'fixed',
          top: '15%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: '600px',
          zIndex: 1001
        }}
      >
        {searchUI}
      </div>
    </>
  )
}
