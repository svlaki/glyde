import { useState, useEffect } from 'react'
import { useAspects } from '../lib/aspectContext'
import type { Aspect } from '../lib/aspectService'
import { getColors } from '../styles/colors'
import { fontSize, fontWeight } from '../styles/typography'
import { Modal } from './Modal'
import { useTheme } from '../lib/themeContext'
import { SaveTextButton, CancelTextButton } from './ui/IconButtons'

interface AspectFormProps {
  aspect?: Aspect | undefined
  isOpen: boolean
  onClose: () => void
  onSave: (aspect: Partial<Aspect>) => Promise<void>
}

// Preset color palette organized by hue
const PRESET_COLORS = [
  // Reds
  '#fca5a5', '#ef4444', '#b91c1c',
  // Oranges
  '#fdba74', '#f97316', '#c2410c',
  // Ambers
  '#fcd34d', '#f59e0b', '#b45309',
  // Yellows
  '#fde047', '#eab308', '#a16207',
  // Limes
  '#bef264', '#84cc16', '#4d7c0f',
  // Greens
  '#86efac', '#22c55e', '#15803d',
  // Emeralds
  '#6ee7b7', '#10b981', '#047857',
  // Teals
  '#5eead4', '#14b8a6', '#0f766e',
  // Cyans
  '#67e8f9', '#06b6d4', '#0e7490',
  // Skys
  '#7dd3fc', '#0ea5e9', '#0369a1',
  // Blues
  '#93c5fd', '#3b82f6', '#1d4ed8',
  // Indigos
  '#a5b4fc', '#6366f1', '#4338ca',
  // Purples
  '#c4b5fd', '#8b5cf6', '#6d28d9',
  // Fuchsias
  '#f0abfc', '#d946ef', '#a21caf',
  // Pinks
  '#f9a8d4', '#ec4899', '#be185d',
  // Neutrals
  '#d4d4d4', '#737373', '#404040',
]

export function AspectForm({ aspect, isOpen, onClose, onSave }: AspectFormProps) {
  const { theme, isDarkMode } = useTheme()
  const colors = getColors(theme)
  const { aspects } = useAspects()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState(PRESET_COLORS[0])
  const [context, setContext] = useState('')
  const [loading, setLoading] = useState(false)
  const [colorExpanded, setColorExpanded] = useState(false)
  const [hexInput, setHexInput] = useState('')

  useEffect(() => {
    if (aspect) {
      // Editing existing aspect - use its existing color
      setName(aspect.name || '')
      setDescription(aspect.description || '')
      const c = aspect.color || PRESET_COLORS[0]
      setColor(c)
      setHexInput(c)
      setContext(typeof aspect.context === 'string' ? aspect.context : (aspect.context?.text || ''))
    } else {
      // Creating new aspect - auto-assign next color in sequence
      setName('')
      setDescription('')
      const nextColorIndex = aspects.length % PRESET_COLORS.length
      const c = PRESET_COLORS[nextColorIndex]
      setColor(c)
      setHexInput(c)
      setContext('')
    }
    setColorExpanded(false)
  }, [aspect, isOpen, aspects.length])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setLoading(true)
    try {
      const contextValue = typeof context === 'string' && context.trim() ? { text: context.trim() } : undefined
      await onSave({
        ...(aspect?.id ? { id: aspect.id } : {}),
        name: name.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(color ? { color } : {}),
        ...(contextValue ? { context: contextValue } : {})
      })
      onClose()
    } catch (error) {
      console.error('Error saving aspect:', error)
    } finally {
      setLoading(false)
    }
  }

  const nameInput = (
    <input
      type="text"
      value={name}
      onChange={(e) => setName(e.target.value)}
      required
      placeholder="Aspect name"
      style={{
        width: '100%',
        padding: '0',
        fontSize: fontSize.xl,
        fontWeight: fontWeight.semibold,
        background: 'transparent',
        color: colors.textPrimary,
        border: 'none',
        outline: 'none'
      }}
    />
  )

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      headerContent={nameInput}
      maxWidth="500px"
      preventAutoFocus={!!aspect}
    >
      <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Description */}
            <div>
              <label style={{
                display: 'block',
                fontSize: fontSize.sm,
                fontWeight: fontWeight.medium,
                color: colors.textSecondary,
                marginBottom: '6px'
              }}>
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: fontSize.base,
                  background: colors.bgPrimary,
                  color: colors.textPrimary,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '6px',
                  resize: 'vertical'
                }}
              />
            </div>

            {/* Color */}
            <div>
              <button
                type="button"
                onClick={() => setColorExpanded(!colorExpanded)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  marginBottom: colorExpanded ? '10px' : 0,
                }}
              >
                <div style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '6px',
                  background: color,
                  border: `1px solid ${colors.border}`,
                  flexShrink: 0,
                }} />
                <span style={{
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.medium,
                  color: colors.textSecondary,
                }}>
                  Color
                </span>
                <svg
                  width="12" height="12" viewBox="0 0 24 24"
                  fill="none" stroke={colors.textTertiary} strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round"
                  style={{
                    transition: 'transform 0.15s',
                    transform: colorExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {colorExpanded && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* Preset grid */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(9, 1fr)',
                    gap: '6px',
                  }}>
                    {PRESET_COLORS.map(presetColor => (
                      <button
                        key={presetColor}
                        type="button"
                        onClick={() => {
                          setColor(presetColor)
                          setHexInput(presetColor)
                        }}
                        style={{
                          width: '100%',
                          aspectRatio: '1',
                          borderRadius: '6px',
                          background: presetColor,
                          border: color === presetColor
                            ? `2px solid ${colors.textPrimary}`
                            : `1px solid ${colors.border}`,
                          cursor: 'pointer',
                          transition: 'transform 0.12s',
                          boxShadow: color === presetColor ? `0 0 0 2px ${colors.bgPrimary}` : 'none',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'scale(1.15)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'scale(1)'
                        }}
                      />
                    ))}
                  </div>

                  {/* Custom color row */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    paddingTop: '4px',
                    borderTop: `1px solid ${colors.border}`,
                  }}>
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <input
                        type="color"
                        value={color}
                        onChange={(e) => {
                          setColor(e.target.value)
                          setHexInput(e.target.value)
                        }}
                        style={{
                          width: '32px',
                          height: '32px',
                          padding: 0,
                          border: `1px solid ${colors.border}`,
                          borderRadius: '6px',
                          cursor: 'pointer',
                          background: 'none',
                        }}
                        title="Pick a custom color"
                      />
                    </div>
                    <input
                      type="text"
                      value={hexInput}
                      onChange={(e) => {
                        const val = e.target.value
                        setHexInput(val)
                        if (/^#[0-9a-fA-F]{6}$/.test(val)) {
                          setColor(val)
                        }
                      }}
                      placeholder="#000000"
                      maxLength={7}
                      style={{
                        flex: 1,
                        padding: '6px 10px',
                        fontSize: fontSize.sm,
                        fontFamily: 'monospace',
                        background: colors.bgPrimary,
                        color: colors.textPrimary,
                        border: `1px solid ${colors.border}`,
                        borderRadius: '6px',
                        outline: 'none',
                      }}
                    />
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '6px',
                      background: color,
                      border: `1px solid ${colors.border}`,
                      flexShrink: 0,
                    }} />
                  </div>
                </div>
              )}
            </div>

            {/* Context */}
            <div>
              <label style={{
                display: 'block',
                fontSize: fontSize.sm,
                fontWeight: fontWeight.medium,
                color: colors.textSecondary,
                marginBottom: '6px'
              }}>
                Optional additional context
              </label>
              <textarea
                value={context}
                onChange={(e) => setContext(e.target.value)}
                rows={2}
                placeholder="Additional context or notes for this aspect"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: fontSize.base,
                  background: colors.bgPrimary,
                  color: colors.textPrimary,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '6px',
                  resize: 'vertical'
                }}
              />
            </div>
          </div>

          {/* Actions */}
          <div style={{
            display: 'flex',
            gap: '12px',
            marginTop: '24px',
            justifyContent: 'flex-end'
          }}>
            <CancelTextButton
              onClick={onClose}
              disabled={loading}
            />
            <SaveTextButton
              onClick={(e) => handleSubmit(e)}
              disabled={!name.trim()}
              loading={loading}
              isCreate={!aspect}
            />
          </div>
        </form>
    </Modal>
  )
}
