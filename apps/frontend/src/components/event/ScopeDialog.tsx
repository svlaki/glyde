import { useDarkMode } from '../../lib/darkModeContext'
import { getColors } from '../../styles/colors'
import { fontSize, fontWeight } from '../../styles/typography'
import { Modal } from '../Modal'

interface ScopeDialogProps {
  isOpen: boolean
  onClose: () => void
  action: 'save' | 'delete'
  isInstance: boolean
  onConfirm: (scope: 'this_instance' | 'entire_series') => void
}

export function ScopeDialog({
  isOpen,
  onClose,
  action,
  isInstance,
  onConfirm
}: ScopeDialogProps) {
  const { isDarkMode } = useDarkMode()
  const colors = getColors(isDarkMode)

  const actionWord = action === 'delete' ? 'delete' : 'update'

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${action === 'delete' ? 'Delete' : 'Update'} Recurring Event`} maxWidth="400px">
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <p style={{ margin: 0, fontSize: fontSize.base, color: colors.textPrimary }}>
          Would you like to {actionWord} this event instance or the entire recurring series?
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {isInstance && (
            <button
              onClick={() => onConfirm('this_instance')}
              style={{
                padding: '16px',
                border: `1px solid ${colors.border}`,
                borderRadius: '6px',
                backgroundColor: colors.bgPrimary,
                color: colors.textPrimary,
                cursor: 'pointer',
                fontSize: fontSize.base,
                fontWeight: fontWeight.medium,
                textAlign: 'left',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = colors.bgHover
                e.currentTarget.style.borderColor = colors.accent
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = colors.bgPrimary
                e.currentTarget.style.borderColor = colors.border
              }}
            >
              <div style={{ fontWeight: fontWeight.semibold, marginBottom: '4px' }}>
                This Instance Only
              </div>
              <div style={{ fontSize: fontSize.xs, color: colors.textSecondary }}>
                Only affects this specific occurrence
              </div>
            </button>
          )}

          <button
            onClick={() => onConfirm('entire_series')}
            style={{
              padding: '16px',
              border: `1px solid ${colors.border}`,
              borderRadius: '6px',
              backgroundColor: colors.bgPrimary,
              color: colors.textPrimary,
              cursor: 'pointer',
              fontSize: fontSize.base,
              fontWeight: fontWeight.medium,
              textAlign: 'left',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = colors.bgHover
              e.currentTarget.style.borderColor = colors.accent
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = colors.bgPrimary
              e.currentTarget.style.borderColor = colors.border
            }}
          >
            <div style={{ fontWeight: fontWeight.semibold, marginBottom: '4px' }}>
              Entire Series
            </div>
            <div style={{ fontSize: fontSize.xs, color: colors.textSecondary }}>
              Affects all instances of this recurring event
            </div>
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '8px' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 16px',
              border: `1px solid ${colors.border}`,
              borderRadius: '6px',
              backgroundColor: 'transparent',
              color: colors.textPrimary,
              cursor: 'pointer',
              fontSize: fontSize.base,
              fontWeight: fontWeight.medium
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  )
}
