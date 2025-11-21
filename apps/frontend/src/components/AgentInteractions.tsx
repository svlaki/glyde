{/* This file controls the agent interaction panel on the calendar page */}

import { useDarkMode } from '../lib/darkModeContext'
import { getColors } from '../styles/colors'

export function AgentInteractions() {
  const { isDarkMode } = useDarkMode()
  const colors = getColors(isDarkMode)
  const interactions = [
    { id: '1', question: 'Example question?', type: 'yes_no' },
    { id: '2', question: 'Another question?', type: 'yes_no' }
  ]

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
          interactions.map(interaction => (
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
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1, padding: '6px 12px', fontSize: '12px' }}
                >
                  Yes
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ flex: 1, padding: '6px 12px', fontSize: '12px' }}
                >
                  No
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ flex: 1, padding: '6px 12px', fontSize: '12px' }}
                >
                  Uh
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
