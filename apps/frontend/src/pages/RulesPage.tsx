import { useState } from 'react'
import { useDarkMode } from '../lib/darkModeContext'
import { useRules } from '../lib/ruleContext'
import { Rule } from '../lib/ruleService'
import { PageHeader } from '../components/PageHeader'
import { RuleCard } from '../components/RuleCard'
import { RuleForm } from '../components/RuleForm'
import { EmptyState } from '../components/EmptyState'
import { getColors } from '../styles/colors'

export function RulesPage() {
  const { isDarkMode } = useDarkMode()
  const colors = getColors(isDarkMode)
  const { rules, isLoading, error, createRule, updateRule, deleteRule, toggleRule } = useRules()
  const [selectedRule, setSelectedRule] = useState<Rule | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<Rule | undefined>(undefined)

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

  // Sort rules: enabled first, then by priority (high to low)
  const sortedRules = [...rules].sort((a, b) => {
    if (a.enabled !== b.enabled) return a.enabled ? -1 : 1
    return b.priority - a.priority
  })

  const enabledCount = rules.filter(r => r.enabled).length

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      background: colors.bgSecondary
    }}>
      {/* Header */}
      <PageHeader />

      {/* Main Content */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        maxWidth: '800px',
        margin: '0 auto',
        width: '100%'
      }}>
        {/* Page Header */}
        <div style={{
          padding: '24px 20px',
          borderBottom: `1px solid ${colors.border}`,
          background: colors.bgSecondary
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '8px'
          }}>
            <div>
              <h1 style={{
                fontSize: '24px',
                fontWeight: '600',
                color: colors.textPrimary,
                margin: 0
              }}>
                Rules
              </h1>
              <p style={{
                fontSize: '14px',
                color: colors.textSecondary,
                margin: '8px 0 0 0'
              }}>
                Define behavioral guidelines that all agents will follow.
                {rules.length > 0 && ` ${enabledCount} of ${rules.length} active.`}
              </p>
            </div>
            <button
              onClick={handleCreateRule}
              className="btn btn-primary"
              style={{
                padding: '10px 20px',
                fontSize: '14px'
              }}
            >
              + New Rule
            </button>
          </div>
        </div>

        {/* Rules List */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px'
        }}>
          {isLoading ? (
            <div style={{
              padding: '60px 40px',
              textAlign: 'center',
              color: colors.textSecondary,
              fontSize: '14px'
            }}>
              Loading rules...
            </div>
          ) : error ? (
            <div style={{
              padding: '40px 20px',
              textAlign: 'center',
              color: '#c66',
              fontSize: '14px'
            }}>
              Error: {error}
            </div>
          ) : rules.length === 0 ? (
            <EmptyState
              title="No rules yet"
              description="Create rules to guide how agents help you. For example: 'Don't schedule meetings before 9am' or 'Always use 30-minute focus blocks'."
            />
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              {sortedRules.map(rule => (
                <div key={rule.id} style={{ position: 'relative' }}>
                  <RuleCard
                    rule={rule}
                    isSelected={selectedRule?.id === rule.id}
                    onClick={() => setSelectedRule(selectedRule?.id === rule.id ? null : rule)}
                    onToggle={(enabled) => handleToggleRule(rule, enabled)}
                  />

                  {/* Action buttons when selected */}
                  {selectedRule?.id === rule.id && (
                    <div style={{
                      display: 'flex',
                      gap: '8px',
                      marginTop: '8px',
                      paddingLeft: '16px'
                    }}>
                      <button
                        onClick={() => handleEditRule(rule)}
                        style={{
                          padding: '6px 12px',
                          fontSize: '12px',
                          background: 'transparent',
                          color: colors.textSecondary,
                          border: `1px solid ${colors.border}`,
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteRule(rule)}
                        style={{
                          padding: '6px 12px',
                          fontSize: '12px',
                          background: 'transparent',
                          color: '#c66',
                          border: '1px solid #c66',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info Footer */}
        {rules.length > 0 && (
          <div style={{
            padding: '16px 20px',
            borderTop: `1px solid ${colors.border}`,
            background: colors.bgSecondary
          }}>
            <p style={{
              fontSize: '12px',
              color: colors.textSecondary,
              margin: 0,
              textAlign: 'center'
            }}>
              Rules are injected into every agent's context. Higher priority rules take precedence.
            </p>
          </div>
        )}
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
