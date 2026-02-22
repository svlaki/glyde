import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../lib/authContext'
import { useTheme } from '../../lib/themeContext'
import { useAspects } from '../../lib/aspectContext'
import { createUserAspect } from '../../lib/aspectService'
import type { Aspect } from '../../lib/aspectService'
import { AspectForm } from '../AspectForm'
import { getColors } from '../../styles/colors'
import { getTypography, fontSize, fontWeight } from '../../styles/typography'

interface AspectDropdownProps {
  value: string
  onChange: (category: string) => void
}

export function AspectDropdown({ value, onChange }: AspectDropdownProps) {
  const { user, session } = useAuth()
  const { theme, isDarkMode } = useTheme()
  const colors = getColors(theme)
  const typography = getTypography(false)
  const { aspects, refreshAspects } = useAspects()

  const [isOpen, setIsOpen] = useState(false)
  const [isAspectFormOpen, setIsAspectFormOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Click-outside to close
  useEffect(() => {
    if (!isOpen) return

    const handleMouseDown = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [isOpen])

  const getAspectColor = (aspectName: string): string => {
    const asp = aspects.find(a => a.name === aspectName)
    return asp?.color || '#999'
  }

  const handleCreateAspect = async (aspectData: Partial<Aspect>) => {
    if (!user || !session) return

    try {
      await createUserAspect(user, aspectData as any, session.access_token)
      await refreshAspects()
      if (aspectData.name) {
        onChange(aspectData.name)
      }
      setIsAspectFormOpen(false)
      setIsOpen(false)
    } catch (error) {
      console.error('Error creating aspect:', error)
      throw error
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '12px 14px',
    fontSize: '16px',
    fontFamily: typography.bodyMd.fontFamily,
    background: colors.bgTertiary,
    color: colors.textPrimary,
    border: `1px solid ${colors.border}`,
    borderRadius: '10px',
    outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s'
  }

  return (
    <>
      <div style={{ position: 'relative' }} ref={dropdownRef}>
        <label style={{
          display: 'block',
          ...typography.labelLg,
          fontWeight: 500,
          color: colors.textSecondary,
          marginBottom: '8px'
        }}>
          Aspect
        </label>
        <div
          onClick={() => setIsOpen(!isOpen)}
          style={{
            ...inputStyle,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            minHeight: '48px'
          }}
        >
          {value ? (
            <>
              <div style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: getAspectColor(value),
                flexShrink: 0
              }} />
              <span style={{ ...typography.bodyMd }}>{value}</span>
            </>
          ) : (
            <span style={{ color: colors.textSecondary }}>Select aspect...</span>
          )}
        </div>

        {isOpen && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              right: 0,
              maxHeight: '250px',
              overflowY: 'auto',
              overflowX: 'hidden',
              border: `1px solid ${colors.border}`,
              borderRadius: '8px',
              background: colors.bgSecondary,
              boxShadow: isDarkMode
                ? '0 8px 24px rgba(0,0,0,0.4)'
                : '0 8px 24px rgba(0,0,0,0.12)',
              zIndex: 1000
            }}
          >
            {/* None option */}
            <div
              onClick={() => {
                onChange('')
                setIsOpen(false)
              }}
              style={{
                padding: '10px 14px',
                cursor: 'pointer',
                fontSize: fontSize.base,
                color: colors.textSecondary,
                transition: 'background 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = colors.bgHover
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              None
            </div>
            {aspects.map(cat => (
              <div
                key={cat.id}
                onClick={() => {
                  onChange(cat.name)
                  setIsOpen(false)
                }}
                style={{
                  padding: '10px 14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: fontSize.base,
                  color: colors.textPrimary,
                  transition: 'background 0.15s ease',
                  borderTop: `1px solid ${colors.borderLight}`
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = colors.bgHover
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: cat.color || '#999',
                  flexShrink: 0
                }} />
                <span>{cat.name}</span>
              </div>
            ))}
            {/* Create new aspect */}
            <div
              onClick={() => {
                setIsAspectFormOpen(true)
                setIsOpen(false)
              }}
              style={{
                padding: '10px 14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: fontSize.base,
                color: isDarkMode ? '#f0f0f0' : '#000',
                fontWeight: fontWeight.medium,
                transition: 'background 0.15s ease',
                borderTop: `2px solid ${colors.border}`
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = colors.bgHover
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <span style={{ fontSize: '18px', flexShrink: 0 }}>+</span>
              <span>New Aspect</span>
            </div>
          </div>
        )}
      </div>

      <AspectForm
        isOpen={isAspectFormOpen}
        onClose={() => setIsAspectFormOpen(false)}
        onSave={handleCreateAspect}
      />
    </>
  )
}
