import { useState } from 'react'
import { format } from 'date-fns'
import { CalendarIcon, ChevronDown } from 'lucide-react'
import { Calendar } from './calendar'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import type { ColorPalette } from '../../styles/colors'

interface DatePickerWebProps {
  value: Date
  onChange: (date: Date) => void
  label?: string
  colors: ColorPalette
  inputStyle: React.CSSProperties
}

export function DatePickerWeb({ value, onChange, colors, inputStyle }: DatePickerWebProps) {
  const [open, setOpen] = useState(false)

  const handleSelect = (selected: Date | undefined) => {
    if (!selected) return
    const updated = new Date(value)
    updated.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate())
    onChange(updated)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          style={{
            ...inputStyle,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CalendarIcon size={16} color={colors.textSecondary} />
            {format(value, 'PPP')}
          </span>
          <ChevronDown size={16} color={colors.textSecondary} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0"
        align="start"
        style={{ zIndex: 1100 }}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Calendar
          mode="single"
          selected={value}
          onSelect={handleSelect}
          defaultMonth={value}
        />
      </PopoverContent>
    </Popover>
  )
}

interface TimeInputWebProps {
  value: Date
  onChange: (date: Date) => void
  label?: string
  id?: string
  colors: ColorPalette
  inputStyle: React.CSSProperties
}

export function TimeInputWeb({ value, onChange, id, inputStyle }: TimeInputWebProps) {
  const timeString = `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const [hours, minutes] = e.target.value.split(':').map(Number)
    if (isNaN(hours) || isNaN(minutes)) return
    const updated = new Date(value)
    updated.setHours(hours, minutes)
    onChange(updated)
  }

  return (
    <input
      type="time"
      id={id}
      value={timeString}
      onChange={handleChange}
      style={{
        ...inputStyle,
        textAlign: 'center',
      }}
    />
  )
}

/* Hide the native time picker icon/button across browsers */
const timePickerStyles = `
  input[type="time"]::-webkit-calendar-picker-indicator {
    display: none;
    -webkit-appearance: none;
  }
  input[type="time"]::-webkit-inner-spin-button {
    display: none;
  }
`

if (typeof document !== 'undefined') {
  const id = 'time-picker-web-styles'
  if (!document.getElementById(id)) {
    const style = document.createElement('style')
    style.id = id
    style.textContent = timePickerStyles
    document.head.appendChild(style)
  }
}
