import * as Dialog from '@radix-ui/react-dialog'
import { Calendar } from '@/components/ui/calendar'

interface DatePickerMobileProps {
  value: Date
  onChange: (date: Date) => void
  isOpen: boolean
  onClose: () => void
}

export function DatePickerMobile({ value, onChange, isOpen, onClose }: DatePickerMobileProps) {
  const handleSelect = (date: Date | undefined) => {
    if (date) {
      // Preserve the time from the original value
      const newDate = new Date(value)
      newDate.setFullYear(date.getFullYear(), date.getMonth(), date.getDate())
      onChange(newDate)
      onClose()
    }
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
            background: '#ffffff',
            borderRadius: '12px',
            padding: '16px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
            zIndex: 1201,
            outline: 'none',
            overflow: 'hidden'
          }}
        >
          <Dialog.Title className="sr-only">Select Date</Dialog.Title>

          {/* Calendar with today highlighted in red */}
          <Calendar
            mode="single"
            selected={value}
            onSelect={handleSelect}
            defaultMonth={value}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
