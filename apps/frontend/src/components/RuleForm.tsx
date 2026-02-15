import { useState, useEffect } from 'react'
import { useTheme } from '../lib/themeContext'
import { Rule } from '../lib/ruleService'
import { getColors } from '../styles/colors'
import { fontSize, fontWeight } from '../styles/typography'
import { Modal } from './Modal'
import { SaveTextButton, CancelTextButton } from './ui/IconButtons'

interface RuleFormProps {
  rule?: Rule
  isOpen: boolean
  onClose: () => void
  onSave: (data: { rule_text: string; description?: string; priority?: number }) => Promise<void>
}

export function RuleForm({ rule, isOpen, onClose, onSave }: RuleFormProps) {
  const { theme, isDarkMode } = useTheme()
  const colors = getColors(theme)
  const [ruleText, setRuleText] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState(5)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (rule) {
      setRuleText(rule.rule_text || '')
      setDescription(rule.description || '')
      setPriority(rule.priority || 5)
    } else {
      setRuleText('')
      setDescription('')
      setPriority(5)
    }
  }, [rule, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ruleText.trim()) return

    setLoading(true)
    try {
      await onSave({
        rule_text: ruleText.trim(),
        description: description.trim() || undefined,
        priority
      })
      onClose()
    } catch (error) {
      console.error('Error saving rule:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={rule ? 'Edit Rule' : 'Create New Rule'}
    >
      <form onSubmit={handleSubmit} style={{
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        {/* Rule Text */}
        <div>
          <label style={{
            display: 'block',
            fontSize: fontSize.sm,
            fontWeight: fontWeight.medium,
            color: colors.textSecondary,
            marginBottom: '6px'
          }}>
            Rule *
          </label>
          <textarea
            value={ruleText}
            onChange={(e) => setRuleText(e.target.value)}
            required
            rows={3}
            placeholder="e.g., Don't schedule meetings within 30 minutes of lunch"
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
          <p style={{
            fontSize: fontSize.xs,
            color: colors.textSecondary,
            marginTop: '4px'
          }}>
            This rule will be followed by all agents when helping you.
          </p>
        </div>

        {/* Priority */}
        <div>
          <label style={{
            display: 'block',
            fontSize: fontSize.sm,
            fontWeight: fontWeight.medium,
            color: colors.textSecondary,
            marginBottom: '6px'
          }}>
            Priority: {priority}
          </label>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <span style={{ fontSize: fontSize.xs, color: colors.textSecondary }}>Low</span>
            <input
              type="range"
              min="1"
              max="10"
              value={priority}
              onChange={(e) => setPriority(parseInt(e.target.value))}
              style={{
                flex: 1,
                accentColor: colors.textPrimary
              }}
            />
            <span style={{ fontSize: fontSize.xs, color: colors.textSecondary }}>High</span>
          </div>
          <p style={{
            fontSize: fontSize.xs,
            color: colors.textSecondary,
            marginTop: '4px'
          }}>
            Higher priority rules take precedence when there are conflicts.
          </p>
        </div>

        {/* Description */}
        <div>
          <label style={{
            display: 'block',
            fontSize: fontSize.sm,
            fontWeight: fontWeight.medium,
            color: colors.textSecondary,
            marginBottom: '6px'
          }}>
            Description (optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Add context about why this rule exists..."
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

        {/* Actions */}
        <div style={{
          display: 'flex',
          gap: '12px',
          marginTop: '8px',
          justifyContent: 'flex-end',
          paddingTop: '16px',
          borderTop: `1px solid ${colors.border}`
        }}>
          <CancelTextButton
            onClick={onClose}
            disabled={loading}
          />
          <SaveTextButton
            onClick={(e) => handleSubmit(e)}
            disabled={!ruleText.trim()}
            loading={loading}
            isCreate={!rule}
          />
        </div>
      </form>
    </Modal>
  )
}
