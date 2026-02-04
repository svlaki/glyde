import { useState } from 'react'
import { useDarkMode } from '../lib/darkModeContext'
import { useRules } from '../lib/ruleContext'
import { Rule } from '../lib/ruleService'
import { RuleCard } from './RuleCard'
import { RuleForm } from './RuleForm'
import { EmptyState } from './EmptyState'
import { getColors } from '../styles/colors'
import { fontSize, fontWeight, lineHeight } from '../styles/typography'
import { usePlatform } from '../hooks/usePlatform'
import { NewButton, EditButton, DeleteButton } from './ui/IconButtons'

export function RulesSection() {
  const { isDarkMode } = useDarkMode()
  const { isMobile } = usePlatform()
  const colors = getColors(isDarkMode)
  const { rules, isLoading, error, createRule, updateRule, deleteRule, toggleRule } = useRules()

  const [selectedRule, setSelectedRule] = useState<Rule | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<Rule | undefined>(undefined)
  // For mobile: track whether showing list or detail view
  const [showingDetail, setShowingDetail] = useState(false)

  // Sort rules: enabled first, then by priority (high to low)
  const sortedRules = [...rules].sort((a, b) => {
    if (a.enabled !== b.enabled) return a.enabled ? -1 : 1
    return b.priority - a.priority
  })

  const enabledCount = rules.filter(r => r.enabled).length

  const handleCreateRule = () => {
    setEditingRule(undefined)
    setIsFormOpen(true)
  }

  const handleEditRule = (rule: Rule) => {
    setEditingRule(rule)
    setIsFormOpen(true)
  }

  const handleDeleteRule = async (rule: Rule) => {
    if (!confirm(`Delete this rule?\n\n"${rule.rule_text}"`)) return

    const result = await deleteRule(rule.id)
    if (!result.success) {
      alert(result.error || 'Failed to delete rule')
    } else {
      if (selectedRule?.id === rule.id) {
        setSelectedRule(null)
      }
      if (isMobile) {
        setShowingDetail(false)
      }
    }
  }

  const handleToggleRule = async (rule: Rule, enabled: boolean) => {
    const result = await toggleRule(rule.id, enabled)
    if (!result.success) {
      alert(result.error || 'Failed to toggle rule')
    }
  }

  const handleSaveRule = async (data: { rule_text: string; description?: string; priority?: number }) => {
    if (editingRule) {
      const result = await updateRule(editingRule.id, data)
      if (!result.success) {
        throw new Error(result.error || 'Failed to update rule')
      }
    } else {
      const result = await createRule(data)
      if (!result.success) {
        throw new Error(result.error || 'Failed to create rule')
      }
    }
    setIsFormOpen(false)
  }

  // Handle rule selection - on mobile, switch to detail view
  const handleRuleClick = (rule: Rule) => {
    if (selectedRule?.id === rule.id) {
      setSelectedRule(null)
    } else {
      setSelectedRule(rule)
      if (isMobile) {
        setShowingDetail(true)
      }
    }
  }

  // Handle back button on mobile detail view
  const handleBackToList = () => {
    setShowingDetail(false)
  }

  // Mobile layout - list OR detail
  if (isMobile) {
    return (
      <div style={{
        background: colors.bgPrimary,
        border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        borderRadius: '6px',
        overflow: 'hidden'
      }}>
        {/* Section Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          background: colors.bgPrimary,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          {showingDetail && selectedRule ? (
            <>
              <button
                onClick={handleBackToList}
                style={{
                  padding: '6px 12px',
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.normal,
                  background: 'transparent',
                  color: colors.textSecondary,
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                ← Back
              </button>
              <h2 style={{
                fontSize: fontSize.base,
                fontWeight: fontWeight.normal,
                color: colors.textPrimary,
                margin: 0,
                flex: 1,
                textAlign: 'center'
              }}>
                Rule Details
              </h2>
              <div style={{ width: '60px' }} /> {/* Spacer for centering */}
            </>
          ) : (
            <>
              <h2 style={{
                fontSize: fontSize.base,
                fontWeight: fontWeight.normal,
                color: colors.textPrimary,
                margin: 0
              }}>
                Rules {rules.length > 0 && <span style={{ color: colors.textSecondary, fontWeight: fontWeight.light }}>({enabledCount}/{rules.length})</span>}
              </h2>
              <NewButton
                onClick={handleCreateRule}
                title="New rule"
                              />
            </>
          )}
        </div>

        {/* Mobile Content - List OR Detail */}
        {showingDetail && selectedRule ? (
          <div style={{
            padding: '20px',
            background: colors.bgPrimary
          }}>
            <RuleDetailPanel
              rule={selectedRule}
              colors={colors}
              onEdit={() => handleEditRule(selectedRule)}
              onDelete={() => handleDeleteRule(selectedRule)}
              onToggle={(enabled) => handleToggleRule(selectedRule, enabled)}
            />
          </div>
        ) : (
          <div style={{
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            {isLoading ? (
              <div style={{
                padding: '40px',
                textAlign: 'center',
                color: colors.textSecondary,
                fontSize: fontSize.base
              }}>
                Loading rules...
              </div>
            ) : error ? (
              <div style={{
                padding: '20px',
                textAlign: 'center',
                color: '#ef4444',
                fontSize: fontSize.base
              }}>
                Error: {error}
              </div>
            ) : rules.length === 0 ? (
              <EmptyState
                title="No rules yet"
                description="Create rules to guide how agents help you"
              />
            ) : (
              sortedRules.map(rule => (
                <RuleCard
                  key={rule.id}
                  rule={rule}
                  isSelected={selectedRule?.id === rule.id}
                  onClick={() => handleRuleClick(rule)}
                  onToggle={(enabled) => handleToggleRule(rule, enabled)}
                />
              ))
            )}
          </div>
        )}

        {/* Rule Form Modal */}
        <RuleForm
          rule={editingRule}
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          onSave={handleSaveRule}
        />
      </div>
    )
  }

  // Desktop layout - side by side
  return (
    <div style={{
      background: colors.bgPrimary,
      border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
      borderRadius: '6px',
      overflow: 'hidden'
    }}>
      {/* Section Header */}
      <div style={{
        padding: '20px',
        borderBottom: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        background: colors.bgPrimary,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h2 style={{
          fontSize: fontSize.base,
          fontWeight: fontWeight.normal,
          color: colors.textPrimary,
          margin: 0
        }}>
          Rules {rules.length > 0 && <span style={{ color: colors.textSecondary, fontWeight: fontWeight.light }}>({enabledCount}/{rules.length} active)</span>}
        </h2>
        <NewButton
          onClick={handleCreateRule}
          title="New rule"
                  />
      </div>

      {/* Rules Content */}
      <div style={{
        display: 'flex',
        minHeight: '300px',
        maxHeight: '500px'
      }}>
        {/* Left - Rules List */}
        <div style={{
          width: '350px',
          borderRight: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          background: colors.bgPrimary,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            {isLoading ? (
              <div style={{
                padding: '40px',
                textAlign: 'center',
                color: colors.textSecondary,
                fontSize: fontSize.base
              }}>
                Loading rules...
              </div>
            ) : error ? (
              <div style={{
                padding: '20px',
                textAlign: 'center',
                color: '#ef4444',
                fontSize: fontSize.base
              }}>
                Error: {error}
              </div>
            ) : rules.length === 0 ? (
              <EmptyState
                title="No rules yet"
                description="Create rules to guide how agents help you"
              />
            ) : (
              sortedRules.map(rule => (
                <RuleCard
                  key={rule.id}
                  rule={rule}
                  isSelected={selectedRule?.id === rule.id}
                  onClick={() => setSelectedRule(selectedRule?.id === rule.id ? null : rule)}
                  onToggle={(enabled) => handleToggleRule(rule, enabled)}
                />
              ))
            )}
          </div>
        </div>

        {/* Right - Rule Details */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '24px',
          background: colors.bgPrimary
        }}>
          <RuleDetailPanel
            rule={selectedRule}
            colors={colors}
            onEdit={() => selectedRule && handleEditRule(selectedRule)}
            onDelete={() => selectedRule && handleDeleteRule(selectedRule)}
            onToggle={(enabled) => selectedRule && handleToggleRule(selectedRule, enabled)}
          />
        </div>
      </div>

      {/* Rule Form Modal */}
      <RuleForm
        rule={editingRule}
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSave={handleSaveRule}
      />
    </div>
  )
}

// Detail panel component for rule details
function RuleDetailPanel({
  rule,
  colors,
  onEdit,
  onDelete,
  onToggle
}: {
  rule: Rule | null
  colors: ReturnType<typeof getColors>
  onEdit: () => void
  onDelete: () => void
  onToggle: (enabled: boolean) => void
}) {
  if (!rule) {
    return (
      <EmptyState
        title="Select a rule"
        description="Choose a rule from the list to view details"
      />
    )
  }

  return (
    <div>
      {/* Rule Text */}
      <p style={{
        fontSize: fontSize.base,
        fontWeight: fontWeight.normal,
        color: colors.textPrimary,
        margin: '0 0 16px 0',
        lineHeight: lineHeight.normal
      }}>
        {rule.rule_text}
      </p>

      {/* Meta info */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
        marginBottom: '16px'
      }}>
        <span style={{
          padding: '4px 8px',
          fontSize: fontSize.xs,
          fontWeight: fontWeight.medium,
          background: rule.enabled ? 'rgba(34, 197, 94, 0.1)' : 'rgba(156, 163, 175, 0.1)',
          color: rule.enabled ? '#22c55e' : colors.textSecondary,
          borderRadius: '4px'
        }}>
          {rule.enabled ? 'Active' : 'Disabled'}
        </span>
        <span style={{
          padding: '4px 8px',
          fontSize: fontSize.xs,
          fontWeight: fontWeight.medium,
          background: 'rgba(59, 130, 246, 0.1)',
          color: '#3b82f6',
          borderRadius: '4px'
        }}>
          Priority {rule.priority}
        </span>
        <span style={{
          padding: '4px 8px',
          fontSize: fontSize.xs,
          fontWeight: fontWeight.medium,
          background: rule.source === 'agent' ? 'rgba(168, 85, 247, 0.1)' : 'rgba(156, 163, 175, 0.1)',
          color: rule.source === 'agent' ? '#a855f7' : colors.textSecondary,
          borderRadius: '4px'
        }}>
          {rule.source === 'agent' ? 'AI Created' : 'Manual'}
        </span>
      </div>

      {/* Description */}
      {rule.description && (
        <p style={{
          fontSize: fontSize.sm,
          color: colors.textSecondary,
          margin: '0 0 24px 0',
          lineHeight: lineHeight.normal
        }}>
          {rule.description}
        </p>
      )}

      {/* Toggle */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '24px',
        paddingBottom: '24px',
        borderBottom: `1px solid ${colors.border}`
      }}>
        <span style={{ fontSize: fontSize.sm, color: colors.textSecondary }}>
          {rule.enabled ? 'Enabled' : 'Disabled'}
        </span>
        <button
          onClick={() => onToggle(!rule.enabled)}
          style={{
            width: '40px',
            height: '22px',
            borderRadius: '11px',
            background: rule.enabled ? '#22c55e' : colors.border,
            border: 'none',
            cursor: 'pointer',
            position: 'relative',
            transition: 'background 0.2s'
          }}
        >
          <span style={{
            position: 'absolute',
            top: '2px',
            left: rule.enabled ? '20px' : '2px',
            width: '18px',
            height: '18px',
            borderRadius: '50%',
            background: '#fff',
            transition: 'left 0.2s'
          }} />
        </button>
      </div>

      {/* Action buttons */}
      <div style={{
        display: 'flex',
        gap: '8px'
      }}>
        <EditButton onClick={onEdit} title="Edit rule" />
        <DeleteButton onClick={onDelete} title="Delete rule" />
      </div>
    </div>
  )
}
