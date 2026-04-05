import { useState, useEffect } from 'react'
import { useTheme } from '../../lib/themeContext'
import { useAuth } from '../../lib/authContext'
import { fetchNoteBacklinks } from '../../lib/notesService'
import type { Backlink } from '../../lib/notesService'

interface BacklinksPanelProps {
  noteId: string
  onNoteClick: (noteId: string) => void
  isMobile?: boolean
}

export function BacklinksPanel({ noteId, onNoteClick, isMobile }: BacklinksPanelProps) {
  const { isDarkMode } = useTheme()
  const { user, session } = useAuth()
  const [backlinks, setBacklinks] = useState<Backlink[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)

  useEffect(() => {
    if (!user || !session?.access_token || !noteId) {
      setBacklinks([])
      return
    }

    let cancelled = false
    setIsLoading(true)

    fetchNoteBacklinks(user, session.access_token, noteId).then(result => {
      if (!cancelled) {
        setBacklinks(result.backlinks)
        setIsLoading(false)
      }
    })

    return () => { cancelled = true }
  }, [noteId, user, session?.access_token])

  if (isLoading && backlinks.length === 0) {
    return null
  }

  if (backlinks.length === 0) {
    return null
  }

  const extractSnippet = (content: string | undefined, maxLen = 120): string => {
    if (!content) return ''
    const plain = content.replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, '$1').replace(/[#*_~`>]/g, '')
    return plain.length > maxLen ? plain.slice(0, maxLen) + '...' : plain
  }

  return (
    <div style={{
      borderTop: `1px solid ${isDarkMode ? '#374151' : '#e5e7eb'}`,
      padding: isMobile ? '12px 0 0' : '12px 20px 0',
      flexShrink: 0,
    }}>
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '4px 0',
          color: isDarkMode ? '#9ca3af' : '#6b7280',
          fontSize: '12px',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        <span style={{
          fontSize: '10px',
          transition: 'transform 0.15s',
          transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
        }}>
          {'\u25BC'}
        </span>
        Backlinks ({backlinks.length})
      </button>

      {!isCollapsed && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          paddingTop: '8px',
          paddingBottom: '12px',
        }}>
          {backlinks.map(bl => (
            <button
              key={bl.id}
              onClick={() => onNoteClick(bl.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                padding: '8px 10px',
                background: isDarkMode ? '#1f2937' : '#f9fafb',
                border: `1px solid ${isDarkMode ? '#374151' : '#e5e7eb'}`,
                borderLeft: `3px solid ${bl.aspect_color || '#6b7280'}`,
                borderRadius: '6px',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}>
                <span style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: isDarkMode ? '#f3f4f6' : '#111827',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1,
                }}>
                  {bl.title}
                </span>
                <span style={{
                  fontSize: '11px',
                  color: bl.aspect_color || '#6b7280',
                  fontWeight: 500,
                  flexShrink: 0,
                }}>
                  {bl.aspect_name}
                </span>
              </div>
              {bl.content && (
                <span style={{
                  fontSize: '12px',
                  color: isDarkMode ? '#9ca3af' : '#6b7280',
                  lineHeight: '1.4',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {extractSnippet(bl.content)}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
