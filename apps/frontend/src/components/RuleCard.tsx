import { useDarkMode } from '../lib/darkModeContext'
import { getColors } from '../styles/colors'
import { Rule } from '../lib/ruleService'

interface RuleCardProps {
  rule: Rule
  isSelected: boolean
  onClick: () => void
  onToggle: (enabled: boolean) => void
}

export function RuleCard({ rule, isSelected, onClick, onToggle }: RuleCardProps) {
  const { isDarkMode } = useDarkMode()
  const colors = getColors(isDarkMode)

  const handleToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onToggle(!rule.enabled)
  }

  return (
    <div
      onClick={onClick}
      style={{
        padding: '16px',
        background: colors.bgPrimary,
        border: isSelected
          ? `1px solid ${isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'}`
          : `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        borderRadius: '4px',
        cursor: 'pointer',
        opacity: rule.enabled ? 1 : 0.6
      }}
    >
      {/* Header row with toggle */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: '12px'
      }}>
        {/* Rule Text */}
        <div style={{
          flex: 1,
          fontSize: '14px',
          fontWeight: '400',
          color: colors.textPrimary,
          lineHeight: '1.4'
        }}>
          {rule.rule_text}
        </div>

        {/* Toggle Switch */}
        <div
          onClick={handleToggleClick}
          style={{
            width: '40px',
            height: '22px',
            borderRadius: '11px',
            background: rule.enabled
              ? '#4CAF50'
              : (isDarkMode ? '#555' : '#ccc'),
            cursor: 'pointer',
            position: 'relative',
            transition: 'background 0.2s',
            flexShrink: 0
          }}
        >
          <div style={{
            width: '18px',
            height: '18px',
            borderRadius: '50%',
            background: '#fff',
            position: 'absolute',
            top: '2px',
            left: rule.enabled ? '20px' : '2px',
            transition: 'left 0.2s',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
          }} />
        </div>
      </div>

      {/* Meta info - only show if selected */}
      {isSelected && (
        <div style={{
          marginTop: '12px',
          display: 'flex',
          gap: '16px',
          fontSize: '12px',
          color: colors.textSecondary
        }}>
          <span style={{
            padding: '2px 8px',
            background: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
            borderRadius: '4px'
          }}>
            Priority: {rule.priority}
          </span>
          <span style={{
            padding: '2px 8px',
            background: rule.source === 'agent'
              ? (isDarkMode ? 'rgba(100,149,237,0.2)' : 'rgba(100,149,237,0.1)')
              : (isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'),
            borderRadius: '4px',
            color: rule.source === 'agent' ? '#6495ED' : colors.textSecondary
          }}>
            {rule.source === 'agent' ? 'AI Created' : 'Manual'}
          </span>
        </div>
      )}

      {/* Description - only show if selected and exists */}
      {isSelected && rule.description && (
        <div style={{
          fontSize: '13px',
          color: colors.textSecondary,
          lineHeight: '1.5',
          marginTop: '8px',
          opacity: 0.8
        }}>
          {rule.description}
        </div>
      )}
    </div>
  )
}
