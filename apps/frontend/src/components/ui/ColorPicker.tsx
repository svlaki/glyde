import { useState, useRef, useEffect, useCallback } from 'react'
import { HexColorPicker } from 'react-colorful'
import { useTheme } from '../../lib/themeContext'
import { getColors } from '../../styles/colors'
import { fontSize, fontWeight } from '../../styles/typography'

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
}

type Tab = 'grid' | 'spectrum' | 'sliders'

const GRID_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6',
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
  '#f43f5e', '#78716c', '#737373', '#64748b', '#475569',
  '#dc2626', '#ea580c', '#d97706', '#ca8a04', '#65a30d',
  '#16a34a', '#0d9488', '#0891b2', '#0284c7', '#2563eb',
  '#4f46e5', '#7c3aed', '#9333ea', '#c026d3', '#db2777',
  '#e11d48', '#57534e', '#525252', '#334155', '#1e293b',
]

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? {
    r: parseInt(result[1] ?? '0', 16),
    g: parseInt(result[2] ?? '0', 16),
    b: parseInt(result[3] ?? '0', 16)
  } : { r: 0, g: 0, b: 0 }
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const { theme, isDarkMode } = useTheme()
  const colors = getColors(theme)
  const [activeTab, setActiveTab] = useState<Tab>('grid')
  const [isOpen, setIsOpen] = useState(false)
  const [rgb, setRgb] = useState(() => hexToRgb(value))
  const containerRef = useRef<HTMLDivElement>(null)

  // Sync RGB sliders when value changes externally
  useEffect(() => {
    setRgb(hexToRgb(value))
  }, [value])

  // Click-outside to close
  useEffect(() => {
    if (!isOpen) return
    const handleMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [isOpen])

  const handleRgbChange = useCallback((channel: 'r' | 'g' | 'b', val: number) => {
    const next = { ...rgb, [channel]: val }
    setRgb(next)
    onChange(rgbToHex(next.r, next.g, next.b))
  }, [rgb, onChange])

  const tabs: { key: Tab; label: string }[] = [
    { key: 'grid', label: 'Grid' },
    { key: 'spectrum', label: 'Spectrum' },
    { key: 'sliders', label: 'Sliders' },
  ]

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '6px 0',
    fontSize: fontSize.xs,
    fontWeight: active ? fontWeight.semibold : fontWeight.medium,
    color: active ? colors.textPrimary : colors.textTertiary,
    background: active ? (isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)') : 'transparent',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  })

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* Trigger swatch */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '8px',
          border: `1.5px solid ${colors.border}`,
          background: value,
          cursor: 'pointer',
          padding: 0,
          transition: 'box-shadow 0.15s ease',
          boxShadow: isOpen ? `0 0 0 2px ${isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'}` : 'none',
        }}
      />

      {/* Popover */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          left: 0,
          zIndex: 1000,
          width: '260px',
          background: colors.bgPrimary,
          border: `1px solid ${colors.border}`,
          borderRadius: '12px',
          boxShadow: isDarkMode
            ? '0 8px 30px rgba(0,0,0,0.5)'
            : '0 8px 30px rgba(0,0,0,0.12)',
          overflow: 'hidden',
        }}>
          {/* Tab bar */}
          <div style={{
            display: 'flex',
            gap: '2px',
            padding: '6px 6px 0',
            background: colors.bgSecondary,
          }}>
            {tabs.map(t => (
              <button
                key={t.key}
                type="button"
                onClick={() => setActiveTab(t.key)}
                style={tabStyle(activeTab === t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div style={{ padding: '10px' }}>
            {/* Grid tab */}
            {activeTab === 'grid' && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(10, 1fr)',
                gap: '3px',
              }}>
                {GRID_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => onChange(c)}
                    style={{
                      width: '100%',
                      aspectRatio: '1',
                      borderRadius: '4px',
                      border: value.toLowerCase() === c.toLowerCase()
                        ? '2px solid white'
                        : '1px solid transparent',
                      background: c,
                      cursor: 'pointer',
                      padding: 0,
                      boxShadow: value.toLowerCase() === c.toLowerCase()
                        ? `0 0 0 1px ${c}`
                        : 'none',
                      transition: 'transform 0.1s ease',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.15)' }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
                  />
                ))}
              </div>
            )}

            {/* Spectrum tab */}
            {activeTab === 'spectrum' && (
              <div>
                <HexColorPicker
                  color={value}
                  onChange={onChange}
                  style={{ width: '100%', height: '160px' }}
                />
                {/* Hex input */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginTop: '10px',
                }}>
                  <span style={{
                    fontSize: fontSize.xs,
                    color: colors.textTertiary,
                    fontWeight: fontWeight.medium,
                  }}>HEX</span>
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => {
                      const v = e.target.value
                      if (/^#[0-9a-fA-F]{6}$/.test(v)) {
                        onChange(v)
                      }
                    }}
                    onBlur={(e) => {
                      let v = e.target.value.trim()
                      if (!v.startsWith('#')) v = '#' + v
                      if (/^#[0-9a-fA-F]{6}$/.test(v)) {
                        onChange(v)
                      }
                    }}
                    maxLength={7}
                    style={{
                      flex: 1,
                      padding: '5px 8px',
                      fontSize: fontSize.sm,
                      fontFamily: 'monospace',
                      background: colors.bgSecondary,
                      color: colors.textPrimary,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '6px',
                    }}
                  />
                </div>
              </div>
            )}

            {/* Sliders tab */}
            {activeTab === 'sliders' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {/* Preview swatch */}
                <div style={{
                  height: '32px',
                  borderRadius: '6px',
                  background: value,
                  border: `1px solid ${colors.border}`,
                }} />

                {/* RGB sliders */}
                {(['r', 'g', 'b'] as const).map((channel) => {
                  const label = channel.toUpperCase()
                  const gradientColors = {
                    r: `linear-gradient(to right, ${rgbToHex(0, rgb.g, rgb.b)}, ${rgbToHex(255, rgb.g, rgb.b)})`,
                    g: `linear-gradient(to right, ${rgbToHex(rgb.r, 0, rgb.b)}, ${rgbToHex(rgb.r, 255, rgb.b)})`,
                    b: `linear-gradient(to right, ${rgbToHex(rgb.r, rgb.g, 0)}, ${rgbToHex(rgb.r, rgb.g, 255)})`,
                  }

                  return (
                    <div key={channel} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        width: '14px',
                        fontSize: fontSize.xs,
                        fontWeight: fontWeight.semibold,
                        color: channel === 'r' ? '#ef4444' : channel === 'g' ? '#22c55e' : '#3b82f6',
                      }}>
                        {label}
                      </span>
                      <div style={{ flex: 1, position: 'relative', height: '14px' }}>
                        <div style={{
                          position: 'absolute',
                          inset: 0,
                          borderRadius: '7px',
                          background: gradientColors[channel],
                          border: `1px solid ${colors.border}`,
                        }} />
                        <input
                          type="range"
                          min={0}
                          max={255}
                          value={rgb[channel]}
                          onChange={(e) => handleRgbChange(channel, parseInt(e.target.value))}
                          style={{
                            position: 'absolute',
                            inset: 0,
                            width: '100%',
                            height: '100%',
                            opacity: 0,
                            cursor: 'pointer',
                            margin: 0,
                          }}
                        />
                        {/* Thumb indicator */}
                        <div style={{
                          position: 'absolute',
                          top: '50%',
                          left: `${(rgb[channel] / 255) * 100}%`,
                          transform: 'translate(-50%, -50%)',
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          background: 'white',
                          border: '2px solid rgba(0,0,0,0.3)',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                          pointerEvents: 'none',
                        }} />
                      </div>
                      <input
                        type="number"
                        min={0}
                        max={255}
                        value={rgb[channel]}
                        onChange={(e) => handleRgbChange(channel, parseInt(e.target.value) || 0)}
                        style={{
                          width: '42px',
                          padding: '3px 4px',
                          fontSize: fontSize.xs,
                          fontFamily: 'monospace',
                          background: colors.bgSecondary,
                          color: colors.textPrimary,
                          border: `1px solid ${colors.border}`,
                          borderRadius: '4px',
                          textAlign: 'center',
                        }}
                      />
                    </div>
                  )
                })}

                {/* Hex display */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginTop: '2px',
                }}>
                  <span style={{
                    fontSize: fontSize.xs,
                    color: colors.textTertiary,
                    fontWeight: fontWeight.medium,
                  }}>HEX</span>
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => {
                      const v = e.target.value
                      if (/^#[0-9a-fA-F]{6}$/.test(v)) {
                        onChange(v)
                      }
                    }}
                    onBlur={(e) => {
                      let v = e.target.value.trim()
                      if (!v.startsWith('#')) v = '#' + v
                      if (/^#[0-9a-fA-F]{6}$/.test(v)) {
                        onChange(v)
                      }
                    }}
                    maxLength={7}
                    style={{
                      flex: 1,
                      padding: '5px 8px',
                      fontSize: fontSize.sm,
                      fontFamily: 'monospace',
                      background: colors.bgSecondary,
                      color: colors.textPrimary,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '6px',
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
