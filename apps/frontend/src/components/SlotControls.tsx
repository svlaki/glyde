import { hexToRgba } from '../styles/colors'
import { fontFamily, fontWeight } from '../styles/typography'

interface SlotControlsProps {
  slotId: string
  color: string
  onSwap: (slotId: string) => void
  onConfirm: (slotId: string) => void
  onDismiss: (slotId: string) => void
}

const buttonBase: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '22px',
  height: '22px',
  borderRadius: '4px',
  border: 'none',
  cursor: 'pointer',
  fontSize: '12px',
  fontFamily: fontFamily.sans,
  fontWeight: fontWeight.semibold,
  transition: 'background 0.1s ease, transform 0.1s ease',
  padding: 0,
}

export function SlotControls({ slotId, color, onSwap, onConfirm, onDismiss }: SlotControlsProps) {
  return (
    <div
      style={{
        display: 'flex',
        gap: '4px',
        marginTop: '2px',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Swap (arrows) */}
      <button
        onClick={() => onSwap(slotId)}
        style={{
          ...buttonBase,
          background: hexToRgba(color, 0.15),
          color,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = hexToRgba(color, 0.25)
          e.currentTarget.style.transform = 'scale(1.05)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = hexToRgba(color, 0.15)
          e.currentTarget.style.transform = 'scale(1)'
        }}
        title="Swap to different suggestion"
      >
        &#8644;
      </button>

      {/* Confirm (checkmark) */}
      <button
        onClick={() => onConfirm(slotId)}
        style={{
          ...buttonBase,
          background: hexToRgba('#22c55e', 0.15),
          color: '#22c55e',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = hexToRgba('#22c55e', 0.25)
          e.currentTarget.style.transform = 'scale(1.05)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = hexToRgba('#22c55e', 0.15)
          e.currentTarget.style.transform = 'scale(1)'
        }}
        title="Accept suggestion and create event"
      >
        &#10003;
      </button>

      {/* Dismiss (X) */}
      <button
        onClick={() => onDismiss(slotId)}
        style={{
          ...buttonBase,
          background: hexToRgba('#ef4444', 0.15),
          color: '#ef4444',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = hexToRgba('#ef4444', 0.25)
          e.currentTarget.style.transform = 'scale(1.05)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = hexToRgba('#ef4444', 0.15)
          e.currentTarget.style.transform = 'scale(1)'
        }}
        title="Dismiss suggestion"
      >
        &#10005;
      </button>
    </div>
  )
}
