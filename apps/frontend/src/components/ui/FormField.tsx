import { CSSProperties, ReactNode } from 'react'
import { Text } from './Text'
import { useTheme } from '@/lib/themeContext'
import { getColors } from '@/styles/colors'

interface FormFieldProps {
  /** Field label text */
  label?: string
  /** Whether the field is required */
  required?: boolean
  /** Error message to display */
  error?: string
  /** Helper text to display below the field */
  helperText?: string
  /** The form input element(s) */
  children: ReactNode
  /** Additional styles for the container */
  style?: CSSProperties
  /** HTML id for the label's htmlFor attribute */
  htmlFor?: string
  /** Additional class name */
  className?: string
}

/**
 * Standardized form field wrapper with consistent typography
 *
 * Provides:
 * - Label with labelMd typography
 * - Required indicator
 * - Error message with errorText typography and error color
 * - Helper text with helperText typography and tertiary color
 *
 * @example
 * <FormField label="Location" required error={errors.location} helperText="Enter venue address">
 *   <input style={{ ...getTypography(isMobile).inputText }} />
 * </FormField>
 */
export function FormField({
  label,
  required,
  error,
  helperText,
  children,
  style,
  htmlFor,
  className,
}: FormFieldProps) {
  const { theme, isDarkMode } = useTheme()
  const colors = getColors(theme)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        ...style,
      }}
      className={className}
    >
      {label && (
        <label
          htmlFor={htmlFor}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <Text variant="labelMd" color="secondary" as="span">
            {label}
          </Text>
          {required && (
            <Text variant="labelMd" color="error" as="span">
              *
            </Text>
          )}
        </label>
      )}

      {children}

      {error && (
        <Text variant="errorText" color="error">
          {error}
        </Text>
      )}

      {helperText && !error && (
        <Text variant="helperText" color="tertiary">
          {helperText}
        </Text>
      )}
    </div>
  )
}

/**
 * Get input styles for form fields
 * Call this with the typography system to get consistent input styling
 */
export function getInputStyles(
  colors: ReturnType<typeof getColors>,
  hasError?: boolean
): CSSProperties {
  return {
    width: '100%',
    padding: '12px 14px',
    fontSize: '16px', // Fixed for iOS zoom prevention
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
    lineHeight: 1.5,
    color: colors.textPrimary,
    backgroundColor: colors.bgSecondary,
    border: `1px solid ${hasError ? colors.error : colors.border}`,
    borderRadius: '8px',
    outline: 'none',
    transition: 'border-color 0.15s ease',
  }
}

export default FormField
