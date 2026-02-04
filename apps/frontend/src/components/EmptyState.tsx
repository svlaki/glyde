import { useDarkMode } from '../lib/darkModeContext'
import { fontSize, fontWeight } from '../styles/typography'

interface EmptyStateProps {
  title: string
  description?: string
  icon?: string
  action?: {
    label: string
    onClick: () => void
  }
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  const { isDarkMode } = useDarkMode()

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '60px 20px',
      textAlign: 'center'
    }}>
      {icon && (
        <div style={{
          fontSize: '48px',
          marginBottom: '16px',
          opacity: 0.5
        }}>
          {icon}
        </div>
      )}
      <h3 style={{
        fontSize: fontSize.lg,
        fontWeight: fontWeight.semibold,
        color: isDarkMode ? '#999' : '#666',
        margin: '0 0 8px 0'
      }}>
        {title}
      </h3>
      {description && (
        <p style={{
          fontSize: fontSize.base,
          color: isDarkMode ? '#666' : '#999',
          margin: '0 0 24px 0',
          maxWidth: '400px'
        }}>
          {description}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="btn btn-primary"
          style={{
            padding: '10px 20px',
            fontSize: fontSize.base
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
