// Icon button components for New, Edit, Delete, and Save actions

import { useTheme } from '../../lib/themeContext'
import { getColors } from '../../styles/colors'

// Size configurations: desktop = 36px, mobile = 32px
const SIZES = {
  desktop: { button: '36px', icon: 14 },
  mobile: { button: '32px', icon: 12 }
}

// Plus icon for "New" action
const PlusIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
)

// Pencil icon for "Edit" action
const PencilIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    <path d="m15 5 4 4" />
  </svg>
)

// Trash icon for "Delete" action
const TrashIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18" />
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
  </svg>
)

// Check icon for "Save" action
const CheckIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

// Refresh icon for "Refresh" action
const RefreshIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
    <path d="M16 16h5v5" />
  </svg>
)

// Share icon for "Share" action
const ShareIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" stroke="none">
    <path d="M13.5 3a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zM15 3a3 3 0 1 0-5.878.87L6.467 5.54a3 3 0 1 0 0 4.92l2.655 1.67A3 3 0 1 0 12 13.5a3 3 0 0 0-.645-1.87l-2.655-1.67a3.01 3.01 0 0 0 0-.92l2.655-1.67A3 3 0 0 0 15 3zM4.5 9.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm8 5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/>
  </svg>
)

// Clear/X icon for "Clear" action
const ClearIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
  </svg>
)

interface IconButtonProps {
  onClick: (e: React.MouseEvent) => void
  disabled?: boolean
  title?: string
  mobile?: boolean
}

export function NewButton({ onClick, disabled, title = 'New', mobile = false }: IconButtonProps) {
  const { theme, isDarkMode } = useTheme()
  const colors = getColors(theme)
  const size = mobile ? SIZES.mobile : SIZES.desktop

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        width: size.button,
        height: size.button,
        padding: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: colors.bgTertiary,
        color: colors.textSecondary,
        border: `1px solid ${colors.border}`,
        borderRadius: '6px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = colors.bgHover
          e.currentTarget.style.color = colors.textPrimary
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = colors.bgTertiary
          e.currentTarget.style.color = colors.textSecondary
        }
      }}
    >
      <PlusIcon size={size.icon} />
    </button>
  )
}

export function EditButton({ onClick, disabled, title = 'Edit', mobile = false }: IconButtonProps) {
  const { theme, isDarkMode } = useTheme()
  const colors = getColors(theme)
  const size = mobile ? SIZES.mobile : SIZES.desktop

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        width: size.button,
        height: size.button,
        padding: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: colors.bgTertiary,
        color: colors.textSecondary,
        border: `1px solid ${colors.border}`,
        borderRadius: '6px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = colors.bgHover
          e.currentTarget.style.color = colors.textPrimary
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = colors.bgTertiary
          e.currentTarget.style.color = colors.textSecondary
        }
      }}
    >
      <PencilIcon size={size.icon} />
    </button>
  )
}

export function DeleteButton({ onClick, disabled, title = 'Delete', mobile = false }: IconButtonProps) {
  const { theme, isDarkMode } = useTheme()
  const colors = getColors(theme)
  const size = mobile ? SIZES.mobile : SIZES.desktop

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        width: size.button,
        height: size.button,
        padding: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: colors.bgTertiary,
        color: isDarkMode ? '#f87171' : '#dc2626',
        border: `1px solid ${colors.border}`,
        borderRadius: '6px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = isDarkMode ? 'rgba(248, 113, 113, 0.15)' : 'rgba(220, 38, 38, 0.1)'
          e.currentTarget.style.borderColor = isDarkMode ? '#f87171' : '#dc2626'
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = colors.bgTertiary
          e.currentTarget.style.borderColor = colors.border
        }
      }}
    >
      <TrashIcon size={size.icon} />
    </button>
  )
}

export function SaveButton({ onClick, disabled, title = 'Save', mobile = false }: IconButtonProps) {
  const { theme, isDarkMode } = useTheme()
  const colors = getColors(theme)
  const size = mobile ? SIZES.mobile : SIZES.desktop

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        width: size.button,
        height: size.button,
        padding: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: colors.bgTertiary,
        color: isDarkMode ? '#4ade80' : '#16a34a',
        border: `1px solid ${colors.border}`,
        borderRadius: '6px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = isDarkMode ? 'rgba(74, 222, 128, 0.15)' : 'rgba(22, 163, 74, 0.1)'
          e.currentTarget.style.borderColor = isDarkMode ? '#4ade80' : '#16a34a'
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = colors.bgTertiary
          e.currentTarget.style.borderColor = colors.border
        }
      }}
    >
      <CheckIcon size={size.icon} />
    </button>
  )
}

export function RefreshButton({ onClick, disabled, title = 'Refresh', mobile = false }: IconButtonProps & { spinning?: boolean }) {
  const { theme, isDarkMode } = useTheme()
  const colors = getColors(theme)
  const size = mobile ? SIZES.mobile : SIZES.desktop

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        width: size.button,
        height: size.button,
        padding: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: colors.bgTertiary,
        color: colors.textSecondary,
        border: `1px solid ${colors.border}`,
        borderRadius: '6px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = colors.bgHover
          e.currentTarget.style.color = colors.textPrimary
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = colors.bgTertiary
          e.currentTarget.style.color = colors.textSecondary
        }
      }}
    >
      <RefreshIcon size={size.icon} />
    </button>
  )
}

export function ShareButton({ onClick, disabled, title = 'Share', mobile = false }: IconButtonProps) {
  const { theme, isDarkMode } = useTheme()
  const colors = getColors(theme)
  const size = mobile ? SIZES.mobile : SIZES.desktop

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        width: size.button,
        height: size.button,
        padding: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: colors.bgTertiary,
        color: colors.textSecondary,
        border: `1px solid ${colors.border}`,
        borderRadius: '6px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = colors.bgHover
          e.currentTarget.style.color = colors.textPrimary
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = colors.bgTertiary
          e.currentTarget.style.color = colors.textSecondary
        }
      }}
    >
      <ShareIcon size={size.icon} />
    </button>
  )
}

export function ClearButton({ onClick, disabled, title = 'Clear', mobile = false }: IconButtonProps) {
  const { theme, isDarkMode } = useTheme()
  const colors = getColors(theme)
  const size = mobile ? SIZES.mobile : SIZES.desktop

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        width: size.button,
        height: size.button,
        padding: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: colors.bgTertiary,
        color: colors.textSecondary,
        border: `1px solid ${colors.border}`,
        borderRadius: '6px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = colors.bgHover
          e.currentTarget.style.color = colors.textPrimary
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = colors.bgTertiary
          e.currentTarget.style.color = colors.textSecondary
        }
      }}
    >
      <ClearIcon size={size.icon} />
    </button>
  )
}

// =============================================================================
// TEXT BUTTONS - Same aesthetic as icon buttons but with text labels
// =============================================================================

interface TextButtonProps {
  onClick: (e: React.MouseEvent) => void
  disabled?: boolean
  children: React.ReactNode
  mobile?: boolean
  type?: 'button' | 'submit'
  variant?: 'default' | 'primary' | 'danger'
}

export function TextButton({
  onClick,
  disabled,
  children,
  mobile = false,
  type = 'button',
  variant = 'default'
}: TextButtonProps) {
  const { theme, isDarkMode } = useTheme()
  const colors = getColors(theme)
  const height = mobile ? '32px' : '36px'
  const fontSize = mobile ? '12px' : '13px'

  // Variant-specific colors
  const getVariantColors = () => {
    switch (variant) {
      case 'primary':
        return {
          color: isDarkMode ? '#4ade80' : '#16a34a',
          hoverBg: isDarkMode ? 'rgba(74, 222, 128, 0.15)' : 'rgba(22, 163, 74, 0.1)',
          hoverBorder: isDarkMode ? '#4ade80' : '#16a34a'
        }
      case 'danger':
        return {
          color: isDarkMode ? '#f87171' : '#dc2626',
          hoverBg: isDarkMode ? 'rgba(248, 113, 113, 0.15)' : 'rgba(220, 38, 38, 0.1)',
          hoverBorder: isDarkMode ? '#f87171' : '#dc2626'
        }
      default:
        return {
          color: colors.textSecondary,
          hoverBg: colors.bgHover,
          hoverBorder: colors.border
        }
    }
  }

  const variantColors = getVariantColors()

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        height,
        padding: '0 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        background: colors.bgTertiary,
        color: variantColors.color,
        border: `1px solid ${colors.border}`,
        borderRadius: '6px',
        fontSize,
        fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.15s',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = variantColors.hoverBg
          if (variant !== 'default') {
            e.currentTarget.style.borderColor = variantColors.hoverBorder
          }
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = colors.bgTertiary
          e.currentTarget.style.borderColor = colors.border
        }
      }}
    >
      {children}
    </button>
  )
}

// Convenience wrappers for common text buttons
export function SaveTextButton({
  onClick,
  disabled,
  loading = false,
  mobile = false,
  isCreate = false
}: Omit<TextButtonProps, 'children' | 'variant'> & { loading?: boolean; isCreate?: boolean }) {
  return (
    <TextButton
      type="submit"
      onClick={onClick}
      disabled={disabled || loading}
      mobile={mobile}
      variant="primary"
    >
      {loading ? 'Saving...' : isCreate ? 'Create' : 'Save'}
    </TextButton>
  )
}

export function CancelTextButton({
  onClick,
  disabled,
  mobile = false
}: Omit<TextButtonProps, 'children' | 'variant'>) {
  return (
    <TextButton
      onClick={onClick}
      disabled={disabled}
      mobile={mobile}
      variant="default"
    >
      Cancel
    </TextButton>
  )
}

export function DeleteTextButton({
  onClick,
  disabled,
  loading = false,
  mobile = false
}: Omit<TextButtonProps, 'children' | 'variant'> & { loading?: boolean }) {
  return (
    <TextButton
      onClick={onClick}
      disabled={disabled || loading}
      mobile={mobile}
      variant="danger"
    >
      {loading ? 'Deleting...' : 'Delete'}
    </TextButton>
  )
}
