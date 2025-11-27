{/* This file controls the agent interaction panel on the calendar page */}

import { useState } from 'react'
import { useDarkMode } from '../lib/darkModeContext'
import { useInteractions } from '../hooks/useInteractions'
import { getColors } from '../styles/colors'

interface AgentInteractionsProps {
  onInteractionResponse?: ((message: string) => void) | null;
}

export function AgentInteractions({ onInteractionResponse }: AgentInteractionsProps) {
  const { isDarkMode } = useDarkMode()
  const colors = getColors(isDarkMode)
  const { interactions, respondToInteraction, generateSuggestions, dismissInteraction } = useInteractions()
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [generatingId, setGeneratingId] = useState<'generating' | null>(null)
  const [dismissingId, setDismissingId] = useState<string | null>(null)

  const handleResponse = async (interactionId: string, response: string) => {
    setLoadingId(interactionId)
    try {
      console.log('[AgentInteractions] Responding to interaction:', interactionId, 'response:', response)
      console.log('[AgentInteractions] Chat callback available?', !!onInteractionResponse)
      await respondToInteraction(interactionId, response, onInteractionResponse || undefined)
    } finally {
      setLoadingId(null)
    }
  }

  const handleDismiss = async (interactionId: string) => {
    setDismissingId(interactionId)
    try {
      await dismissInteraction(interactionId)
    } finally {
      setDismissingId(null)
    }
  }

  const handleGenerateSuggestions = async () => {
    setGeneratingId('generating')
    try {
      await generateSuggestions()
    } finally {
      setGeneratingId(null)
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
        padding: '20px 20px 10px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h3 style={{ fontSize: '20px', fontWeight: '600', margin: 0, color: colors.textPrimary }}>
          Interactions
        </h3>
        <button
          onClick={handleGenerateSuggestions}
          disabled={generatingId === 'generating'}
          style={{
            padding: '6px 12px',
            fontSize: '12px',
            backgroundColor: '#4f46e5',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: generatingId === 'generating' ? 'not-allowed' : 'pointer',
            opacity: generatingId === 'generating' ? 0.6 : 1,
            fontWeight: '500'
          }}
          title="Generate new suggestions based on your calendar, tasks, and goals"
        >
          {generatingId === 'generating' ? 'Generating...' : 'Generate'}
        </button>
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
                  border: `1px solid ${colors.border}`,
                  position: 'relative'
                }}
              >
                {/* Dismiss button */}
                <button
                  onClick={() => handleDismiss(interaction.id)}
                  disabled={dismissingId === interaction.id}
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    background: 'transparent',
                    border: 'none',
                    color: colors.textTertiary,
                    cursor: dismissingId === interaction.id ? 'not-allowed' : 'pointer',
                    fontSize: '16px',
                    padding: '4px 8px',
                    opacity: dismissingId === interaction.id ? 0.5 : 0.7
                  }}
                  title="Dismiss this suggestion"
                >
                  ✕
                </button>

                <p style={{ fontSize: '13px', margin: '0 0 10px 0', color: colors.textPrimary, paddingRight: '20px' }}>
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
