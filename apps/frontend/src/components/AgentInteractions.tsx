import { useDarkMode } from '../lib/darkModeContext'

export function AgentInteractions() {
  const { isDarkMode } = useDarkMode()
  const interactions = [
    { id: '1', question: 'Schedule a meeting with the team?', type: 'yes_no' },
    { id: '2', question: 'Move workout to tomorrow?', type: 'yes_no' }
  ]

  return (
    <div style={{
      height: '100%',
      background: isDarkMode ? '#0a0a0a' : '#fafafa',
      overflow: 'auto'
    }}>
      {/* Header */}
      <div style={{
        padding: '15px 20px',
        borderBottom: isDarkMode ? '1px solid #2a2a2a' : '1px solid #e5e5e5',
        background: isDarkMode ? '#1a1a1a' : '#fff'
      }}>
        <h3 style={{ fontSize: '14px', fontWeight: '600', margin: 0, color: isDarkMode ? '#fff' : '#000' }}>
          Agent Suggestions
        </h3>
      </div>

      {/* Interactions */}
      <div style={{ padding: '15px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {interactions.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '20px',
            color: '#999',
            fontSize: '13px'
          }}>
            No pending suggestions
          </div>
        ) : (
          interactions.map(interaction => (
            <div
              key={interaction.id}
              style={{
                background: isDarkMode ? '#1a1a1a' : '#fff',
                padding: '12px',
                borderRadius: '8px',
                border: isDarkMode ? '1px solid #2a2a2a' : '1px solid #e5e5e5'
              }}
            >
              <p style={{ fontSize: '13px', margin: '0 0 10px 0', color: isDarkMode ? '#fff' : '#000' }}>
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
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
