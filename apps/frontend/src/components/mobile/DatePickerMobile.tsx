import * as Dialog from '@radix-ui/react-dialog'
import { Calendar } from '@/components/ui/calendar'
import { Button } from '@/components/ui/button'
import { useDarkMode } from '../../lib/darkModeContext'
import { getColors } from '../../styles/colors'

interface DatePickerMobileProps {
  value: Date
  onChange: (date: Date) => void
  isOpen: boolean
  onClose: () => void
}

export function DatePickerMobile({ value, onChange, isOpen, onClose }: DatePickerMobileProps) {
  const { isDarkMode } = useDarkMode()
  const colors = getColors(isDarkMode)

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      // Preserve the time from the original value
      const newDate = new Date(value)
      newDate.setFullYear(date.getFullYear(), date.getMonth(), date.getDate())
      onChange(newDate)
      onClose()
    }
  }

  const handleTodayClick = () => {
    const today = new Date()
    const newDate = new Date(value)
    newDate.setFullYear(today.getFullYear(), today.getMonth(), today.getDate())
    onChange(newDate)
    onClose()
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: 1200
          }}
        />
        <Dialog.Content
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: colors.bgSecondary,
            borderRadius: '16px',
            padding: '16px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)',
            zIndex: 1201,
            outline: 'none'
          }}
        >
          <Dialog.Title className="sr-only">Select Date</Dialog.Title>

          <style>{`
            .rdp {
              --rdp-cell-size: 40px;
              --rdp-accent-color: ${isDarkMode ? '#fff' : '#000'};
              --rdp-background-color: ${colors.bgHover};
              margin: 0;
            }
            .rdp-months {
              justify-content: center;
            }
            .rdp-month {
              background: transparent;
            }
            .rdp-caption {
              display: flex;
              align-items: center;
              justify-content: space-between;
              padding: 0 0.5rem;
              margin-bottom: 0.5rem;
            }
            .rdp-caption_label {
              font-size: 1rem;
              font-weight: 600;
              color: ${colors.textPrimary};
            }
            .rdp-nav {
              display: flex;
              gap: 0.25rem;
            }
            .rdp-nav_button {
              width: 32px;
              height: 32px;
              background: transparent;
              border: 1px solid ${colors.border};
              border-radius: 6px;
              cursor: pointer;
              display: flex;
              align-items: center;
              justify-content: center;
              color: ${colors.textPrimary};
            }
            .rdp-nav_button:hover {
              background: ${colors.bgHover};
            }
            .rdp-table {
              border-collapse: collapse;
            }
            .rdp-head_cell {
              font-size: 0.75rem;
              font-weight: 600;
              color: ${colors.textSecondary};
              text-transform: uppercase;
              padding: 0.5rem 0;
            }
            .rdp-cell {
              padding: 2px;
            }
            .rdp-day {
              width: 40px;
              height: 40px;
              font-size: 0.875rem;
              border-radius: 50%;
              border: none;
              background: transparent;
              color: ${colors.textPrimary};
              cursor: pointer;
              transition: background-color 0.15s;
            }
            .rdp-day:hover:not(.rdp-day_selected) {
              background: ${colors.bgHover};
            }
            .rdp-day_selected {
              background: ${isDarkMode ? '#fff' : '#000'} !important;
              color: ${isDarkMode ? '#000' : '#fff'} !important;
              font-weight: 600;
            }
            .rdp-day_today:not(.rdp-day_selected) {
              border: 1px solid ${colors.textSecondary};
              font-weight: 600;
            }
            .rdp-day_outside {
              color: ${colors.textTertiary};
            }
          `}</style>

          <Calendar
            mode="single"
            selected={value}
            onSelect={handleSelect}
            defaultMonth={value}
          />

          <Button
            variant="outline"
            onClick={handleTodayClick}
            style={{
              width: '100%',
              marginTop: '12px',
              background: colors.bgPrimary,
              borderColor: colors.border,
              color: colors.textPrimary
            }}
          >
            Today
          </Button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
