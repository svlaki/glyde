import { useState } from 'react'
import { useTheme } from '../../lib/themeContext'
import { getColors } from '../../styles/colors'
import { getTypography, fontFamily } from '../../styles/typography'
import { usePlatform } from '../../hooks/usePlatform'

interface ProfileSectionEditorProps {
  sectionKey: string
  sectionData: Record<string, any>
  onSave: (sectionKey: string, fieldKey: string, value: any) => Promise<void>
  onCancel: () => void
}

function toTitleCase(str: string): string {
  return str
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, c => c.toUpperCase())
}

function FieldEditor({
  fieldKey,
  value,
  onSave,
}: {
  fieldKey: string
  value: any
  onSave: (fieldKey: string, value: any) => Promise<void>
}) {
  const { theme, isDarkMode } = useTheme()
  const { isMobile } = usePlatform()
  const colors = getColors(theme)
  const typography = getTypography(isMobile)

  const [editValue, setEditValue] = useState(() => {
    if (Array.isArray(value)) return value.join(', ')
    if (typeof value === 'object' && value !== null) return JSON.stringify(value, null, 2)
    return String(value ?? '')
  })
  const [saving, setSaving] = useState(false)

  const inputBg = isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
  const inputBorder = isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'

  const inputStyle: React.CSSProperties = {
    ...typography.bodySm,
    color: colors.textPrimary,
    background: inputBg,
    border: `1px solid ${inputBorder}`,
    borderRadius: '4px',
    padding: '6px 10px',
    width: '100%',
    outline: 'none',
    boxSizing: 'border-box',
  }

  async function handleSave() {
    setSaving(true)
    try {
      let parsed: any = editValue
      if (typeof value === 'number') {
        parsed = Number(editValue)
      } else if (typeof value === 'boolean') {
        parsed = editValue === 'true'
      } else if (Array.isArray(value)) {
        parsed = editValue.split(',').map((s: string) => s.trim()).filter(Boolean)
      } else if (typeof value === 'object' && value !== null) {
        parsed = JSON.parse(editValue)
      }
      await onSave(fieldKey, parsed)
    } catch (err) {
      if (err instanceof SyntaxError) {
        await onSave(fieldKey, editValue)
      } else {
        throw err
      }
    } finally {
      setSaving(false)
    }
  }

  function renderInput() {
    if (typeof value === 'boolean') {
      return (
        <button
          onClick={() => setEditValue(prev => prev === 'true' ? 'false' : 'true')}
          style={{
            ...typography.bodySm,
            color: colors.textPrimary,
            background: editValue === 'true'
              ? (isDarkMode ? 'rgba(74,222,128,0.2)' : 'rgba(34,197,94,0.15)')
              : inputBg,
            border: `1px solid ${inputBorder}`,
            borderRadius: '4px',
            padding: '6px 14px',
            cursor: 'pointer',
          }}
        >
          {editValue === 'true' ? 'Yes' : 'No'}
        </button>
      )
    }

    if ((typeof value === 'object' && value !== null && !Array.isArray(value))) {
      return (
        <textarea
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          rows={4}
          style={{ ...inputStyle, resize: 'vertical', fontFamily: fontFamily.mono, ...typography.mono }}
        />
      )
    }

    return (
      <input
        type={typeof value === 'number' ? 'number' : 'text'}
        value={editValue}
        onChange={e => setEditValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
        style={inputStyle}
      />
    )
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: '10px',
      padding: '6px 0',
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ ...typography.labelMd, color: colors.textSecondary, marginBottom: '4px' }}>
          {toTitleCase(fieldKey)}
        </div>
        {renderInput()}
        {Array.isArray(value) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
            {editValue.split(',').map((s: string) => s.trim()).filter(Boolean).map((chip, i) => (
              <span key={i} style={{
                ...typography.labelMd,
                padding: '2px 8px',
                borderRadius: '10px',
                background: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                color: colors.textSecondary,
              }}>
                {chip}
              </span>
            ))}
          </div>
        )}
      </div>
      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          marginTop: '20px',
          padding: '5px 10px',
          borderRadius: '4px',
          border: 'none',
          background: colors.accent,
          color: '#fff',
          cursor: saving ? 'wait' : 'pointer',
          opacity: saving ? 0.6 : 1,
          ...typography.labelMd,
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        {saving ? '...' : '✓'}
      </button>
    </div>
  )
}

export function ProfileSectionEditor({ sectionKey, sectionData, onSave, onCancel }: ProfileSectionEditorProps) {
  const { theme, isDarkMode } = useTheme()
  const { isMobile } = usePlatform()
  const colors = getColors(theme)
  const typography = getTypography(isMobile)

  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const [adding, setAdding] = useState(false)

  const inputBg = isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
  const inputBorder = isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
  const divider = isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'

  async function handleFieldSave(fieldKey: string, value: any) {
    await onSave(sectionKey, fieldKey, value)
  }

  async function handleAddField() {
    if (!newKey.trim()) return
    setAdding(true)
    try {
      await onSave(sectionKey, newKey.trim(), newValue.trim())
      setNewKey('')
      setNewValue('')
    } finally {
      setAdding(false)
    }
  }

  const entries = Object.entries(sectionData || {})

  return (
    <div style={{
      borderTop: `1px solid ${divider}`,
      padding: isMobile ? '10px 0 6px' : '12px 0 8px',
    }}>
      {entries.length === 0 && (
        <div style={{ ...typography.bodySm, color: colors.textTertiary, padding: '8px 0' }}>
          No fields yet. Add one below.
        </div>
      )}

      {entries.map(([key, val]) => (
        <FieldEditor key={key} fieldKey={key} value={val} onSave={handleFieldSave} />
      ))}

      <div style={{
        borderTop: `1px solid ${divider}`,
        marginTop: '8px',
        paddingTop: '10px',
        display: 'flex',
        gap: '8px',
        alignItems: 'flex-end',
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ ...typography.labelMd, color: colors.textTertiary, marginBottom: '3px' }}>
            New field
          </div>
          <input
            placeholder="Key"
            value={newKey}
            onChange={e => setNewKey(e.target.value)}
            style={{
              ...typography.bodySm,
              color: colors.textPrimary,
              background: inputBg,
              border: `1px solid ${inputBorder}`,
              borderRadius: '4px',
              padding: '5px 8px',
              width: '100%',
              outline: 'none',
              boxSizing: 'border-box' as const,
              marginBottom: '4px',
            }}
          />
          <input
            placeholder="Value"
            value={newValue}
            onChange={e => setNewValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddField() }}
            style={{
              ...typography.bodySm,
              color: colors.textPrimary,
              background: inputBg,
              border: `1px solid ${inputBorder}`,
              borderRadius: '4px',
              padding: '5px 8px',
              width: '100%',
              outline: 'none',
              boxSizing: 'border-box' as const,
            }}
          />
        </div>
        <button
          onClick={handleAddField}
          disabled={adding || !newKey.trim()}
          style={{
            padding: '5px 12px',
            borderRadius: '4px',
            border: 'none',
            background: colors.accent,
            color: '#fff',
            cursor: adding ? 'wait' : 'pointer',
            opacity: (adding || !newKey.trim()) ? 0.5 : 1,
            ...typography.labelMd,
            fontWeight: 600,
            flexShrink: 0,
            marginBottom: '1px',
          }}
        >
          {adding ? '...' : '+'}
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
        <button
          onClick={onCancel}
          style={{
            ...typography.labelMd,
            color: colors.textSecondary,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px 8px',
          }}
        >
          Close
        </button>
      </div>
    </div>
  )
}
