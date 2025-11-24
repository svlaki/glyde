import { useState, useEffect } from 'react'
import { useCategories } from '../lib/categoryContext'
import { Category } from '../lib/categoryService'
import { getColors } from '../styles/colors'
import { Modal } from './Modal'
import { useDarkMode } from '../lib/darkModeContext'

interface AspectFormProps {
  aspect?: Category
  isOpen: boolean
  onClose: () => void
  onSave: (aspect: Partial<Category>) => Promise<void>
}

// Ordered color palette - aspects will be assigned these colors in sequence
const PRESET_COLORS = [
  '#3b82f6', // Blue (1st)
  '#22c55e', // Green (2nd)
  '#f59e0b', // Amber (3rd)
  '#ec4899', // Pink (4th)
  '#8b5cf6', // Purple (5th)
  '#06b6d4', // Cyan (6th)
  '#f97316', // Orange (7th)
  '#14b8a6', // Teal (8th)
  '#ef4444', // Red (9th)
  '#eab308', // Yellow (10th)
  '#6366f1', // Indigo (11th)
  '#10b981', // Emerald (12th)
  '#84cc16', // Lime (13th)
  '#0ea5e9', // Sky (14th)
  '#a855f7', // Violet (15th)
  '#d946ef', // Fuchsia (16th)
  '#f43f5e'  // Rose (17th)
]

const PRESET_ICONS = ['H', 'W', 'G', 'F', 'M', 'T', 'A', 'B', 'L', 'E', 'P', 'S']

export function AspectForm({ aspect, isOpen, onClose, onSave }: AspectFormProps) {
  const { isDarkMode } = useDarkMode()
  const colors = getColors(isDarkMode)
  const { categories } = useCategories()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState(PRESET_COLORS[0])
  const [icon, setIcon] = useState('')
  const [context, setContext] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (aspect) {
      // Editing existing aspect - use its existing color
      setName(aspect.name || '')
      setDescription(aspect.description || '')
      setColor(aspect.color || PRESET_COLORS[0])
      setIcon(aspect.icon || '')
      setContext(aspect.context || '')
    } else {
      // Creating new aspect - auto-assign next color in sequence
      setName('')
      setDescription('')
      // Assign color based on number of existing aspects (cycles through palette)
      const nextColorIndex = categories.length % PRESET_COLORS.length
      setColor(PRESET_COLORS[nextColorIndex])
      setIcon('')
      setContext('')
    }
  }, [aspect, isOpen, categories.length])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setLoading(true)
    try {
      await onSave({
        id: aspect?.id,
        name: name.trim(),
        description: description.trim() || undefined,
        color,
        icon: icon || undefined,
        context: (typeof context === 'string' && context.trim()) || undefined
      })
      onClose()
    } catch (error) {
      console.error('Error saving aspect:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={aspect ? 'Edit Aspect' : 'Create New Aspect'}
      maxWidth="500px"
    >
      <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Name */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: '500',
                color: colors.textSecondary,
                marginBottom: '6px'
              }}>
                Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: '14px',
                  background: colors.bgPrimary,
                  color: colors.textPrimary,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '6px'
                }}
              />
            </div>

            {/* Description */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: '500',
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
                  fontSize: '14px',
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
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: '500',
                color: colors.textSecondary,
                marginBottom: '6px'
              }}>
                Color
              </label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {PRESET_COLORS.map(presetColor => (
                  <button
                    key={presetColor}
                    type="button"
                    onClick={() => setColor(presetColor)}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '6px',
                      background: presetColor,
                      border: color === presetColor ? `3px solid ${colors.textPrimary}` : 'none',
                      cursor: 'pointer',
                      transition: 'transform 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'scale(1.1)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)'
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Icon */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: '500',
                color: colors.textSecondary,
                marginBottom: '6px'
              }}>
                Icon (optional)
              </label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                {PRESET_ICONS.map(presetIcon => (
                  <button
                    key={presetIcon}
                    type="button"
                    onClick={() => setIcon(presetIcon)}
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '6px',
                      background: icon === presetIcon ? colors.bgHover : colors.bgPrimary,
                      border: `1px solid ${colors.border}`,
                      cursor: 'pointer',
                      fontSize: '20px',
                      transition: 'all 0.2s'
                    }}
                  >
                    {presetIcon}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="Or enter custom text"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: '14px',
                  background: colors.bgPrimary,
                  color: colors.textPrimary,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '6px'
                }}
              />
            </div>

            {/* Context */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: '500',
                color: colors.textSecondary,
                marginBottom: '6px'
              }}>
                Context (optional)
              </label>
              <textarea
                value={context}
                onChange={(e) => setContext(e.target.value)}
                rows={2}
                placeholder="Additional context or notes for this aspect"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: '14px',
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
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                background: colors.bgPrimary,
                color: colors.textSecondary,
                border: `1px solid ${colors.border}`,
                borderRadius: '6px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.5 : 1
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="btn btn-primary"
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                cursor: (loading || !name.trim()) ? 'not-allowed' : 'pointer',
                opacity: (loading || !name.trim()) ? 0.5 : 1
              }}
            >
              {loading ? 'Saving...' : aspect ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
    </Modal>
  )
}
