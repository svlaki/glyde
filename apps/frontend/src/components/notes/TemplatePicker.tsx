import { useState, useEffect } from 'react'
import { useTheme } from '../../lib/themeContext'
import { useAuth } from '../../lib/authContext'
import { fetchNoteTemplates, applyTemplateVariables } from '../../lib/templateService'
import type { NoteTemplate } from '../../lib/templateService'

interface TemplatePickerProps {
  onSelect: (content: string) => void
  onClose: () => void
  isMobile?: boolean
}

export function TemplatePicker({ onSelect, onClose, isMobile }: TemplatePickerProps) {
  const { isDarkMode } = useTheme()
  const { user, session } = useAuth()
  const [templates, setTemplates] = useState<NoteTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!user || !session?.access_token) return

    fetchNoteTemplates(user, session.access_token).then(result => {
      setTemplates(result.templates)
      setIsLoading(false)
    })
  }, [user, session?.access_token])

  const bgColor = isDarkMode ? '#1f2937' : '#ffffff'
  const borderColor = isDarkMode ? '#374151' : '#e5e7eb'
  const textPrimary = isDarkMode ? '#f3f4f6' : '#111827'
  const textSecondary = isDarkMode ? '#9ca3af' : '#6b7280'
  const hoverBg = isDarkMode ? '#374151' : '#f3f4f6'

  return (
    <div style={{
      background: bgColor,
      border: `1px solid ${borderColor}`,
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      maxHeight: isMobile ? '60vh' : '350px',
      overflow: 'auto',
      width: '100%',
    }}>
      <div style={{
        padding: '10px 12px',
        borderBottom: `1px solid ${borderColor}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{
          fontSize: '12px',
          fontWeight: 600,
          color: textSecondary,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          Choose a template
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: textSecondary,
            cursor: 'pointer',
            fontSize: '16px',
            padding: '0 4px',
          }}
        >
          x
        </button>
      </div>

      {isLoading ? (
        <div style={{ padding: '16px', textAlign: 'center', color: textSecondary, fontSize: '13px' }}>
          Loading templates...
        </div>
      ) : templates.length === 0 ? (
        <div style={{ padding: '16px', textAlign: 'center', color: textSecondary, fontSize: '13px' }}>
          No templates available
        </div>
      ) : (
        <div style={{ padding: '4px' }}>
          <button
            onClick={() => onSelect('')}
            style={{
              width: '100%',
              padding: '10px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              background: 'transparent',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              textAlign: 'left',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = hoverBg)}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <span style={{ fontSize: '13px', fontWeight: 600, color: textPrimary }}>
              Blank Note
            </span>
            <span style={{ fontSize: '12px', color: textSecondary }}>
              Start from scratch
            </span>
          </button>

          {templates.map(t => (
            <button
              key={t.id}
              onClick={() => onSelect(applyTemplateVariables(t.content))}
              style={{
                width: '100%',
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                background: 'transparent',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                textAlign: 'left',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = hoverBg)}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: textPrimary }}>
                  {t.title}
                </span>
                {t.is_system && (
                  <span style={{
                    fontSize: '10px',
                    color: textSecondary,
                    background: isDarkMode ? '#374151' : '#f3f4f6',
                    padding: '1px 6px',
                    borderRadius: '4px',
                  }}>
                    built-in
                  </span>
                )}
              </div>
              <span style={{
                fontSize: '12px',
                color: textSecondary,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {t.content.replace(/[#*_\n]/g, ' ').trim().slice(0, 80)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
