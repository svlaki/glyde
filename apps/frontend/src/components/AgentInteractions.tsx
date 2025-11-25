{/* This file controls the agent interaction panel on the calendar page */}

import { useState } from 'react'
import { useDarkMode } from '../lib/darkModeContext'
import { useInteractions } from '../hooks/useInteractions'
import { getColors } from '../styles/colors'

export function AgentInteractions() {
  const { isDarkMode } = useDarkMode()
  const colors = getColors(isDarkMode)
  const { interactions, respondToInteraction } = useInteractions()
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const handleResponse = async (interactionId: string, response: string) => {
    setLoadingId(interactionId)
    try {
      await respondToInteraction(interactionId, response)
    } finally {
      setLoadingId(null)
    }
  }

  const getButtonOptions = (interaction: any) => {
    if (interaction.type === 'yes_no') {
      return [
        { label: 'Yes', value: 'yes' },
        { label: 'No', value: 'no' }
      ]
    } else if (interaction.type === 'multiple_choice' && interaction.options) {
      return interaction.options.map((option: string) => ({
        label: option,
        value: option
      }))
    } else if (interaction.type === 'confirmation') {
      return [
        { label: 'Confirm', value: 'confirmed' },
        { label: 'Cancel', value: 'cancelled' }
      ]
    }
    return []
  }

  return (
    <div style={{
      height: '100%',
      background: colors.bgPrimary,
      overflow: 'auto'
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 20px 10px 20px'
      }}>
        <h3 style={{ fontSize: '20px', fontWeight: '600', margin: 0, color: colors.textPrimary }}>
          Interactions
        </h3>
      </div>

      {/* Interactions */}
      <div style={{ padding: '15px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {interactions.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '20px',
            color: colors.textTertiary,
            fontSize: '13px'
          }}>
            No pending suggestions
          </div>
        ) : (
          interactions.map(interaction => {
            const buttons = getButtonOptions(interaction)
            return (
              <div
                key={interaction.id}
                style={{
                  background: colors.bgSecondary,
                  padding: '12px',
                  borderRadius: '8px',
                  border: `1px solid ${colors.border}`
                }}
              >
                <p style={{ fontSize: '13px', margin: '0 0 10px 0', color: colors.textPrimary }}>
                  {interaction.question}
                </p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {buttons.map(button => (
                    <button
                      key={button.value}
                      onClick={() => handleResponse(interaction.id, button.value)}
                      disabled={loadingId === interaction.id}
                      className="btn btn-primary"
                      style={{
                        flex: buttons.length <= 2 ? 1 : 'auto',
                        padding: '6px 12px',
                        fontSize: '12px',
                        opacity: loadingId === interaction.id ? 0.6 : 1,
                        cursor: loadingId === interaction.id ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {loadingId === interaction.id ? '...' : button.label}
                    </button>
                  ))}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
