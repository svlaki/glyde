import { CSSProperties, ElementType, forwardRef, ReactNode } from 'react'
import { usePlatform } from '@/hooks/usePlatform'
import { useDarkMode } from '@/lib/darkModeContext'
import { getTypography } from '@/styles/typography'
import { getColors } from '@/styles/colors'

/**
 * Typography variant names matching getTypography() output
 */
export type TypographyVariant =
  | 'displayLg'
  | 'displayMd'
  | 'displaySm'
  | 'headingLg'
  | 'headingMd'
  | 'headingSm'
  | 'bodyLg'
  | 'bodyMd'
  | 'bodySm'
  | 'labelLg'
  | 'labelMd'
  | 'labelSm'
  | 'mono'
  | 'inputText'
  | 'errorText'
  | 'helperText'
  | 'placeholderText'

/**
 * Semantic color names for text
 */
export type TextColor =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'accent'
  | 'error'
  | 'success'
  | 'warning'
  | 'inherit'

/**
 * Default HTML element for each typography variant
 */
const variantElementMap: Record<TypographyVariant, ElementType> = {
  displayLg: 'h1',
  displayMd: 'h2',
  displaySm: 'h3',
  headingLg: 'h4',
  headingMd: 'h5',
  headingSm: 'h6',
  bodyLg: 'p',
  bodyMd: 'p',
  bodySm: 'p',
  labelLg: 'span',
  labelMd: 'span',
  labelSm: 'span',
  mono: 'code',
  inputText: 'span',
  errorText: 'span',
  helperText: 'span',
  placeholderText: 'span',
}

interface TextProps {
  /** Typography variant to apply */
  variant?: TypographyVariant
  /** HTML element to render as */
  as?: ElementType
  /** Semantic text color */
  color?: TextColor
  /** Additional inline styles */
  style?: CSSProperties
  /** Child content */
  children?: ReactNode
  /** Additional class name */
  className?: string
  /** HTML id attribute */
  id?: string
  /** HTML title attribute */
  title?: string
  /** Click handler */
  onClick?: () => void
}

/**
 * Polymorphic Text component for consistent typography
 *
 * Features:
 * - Renders appropriate HTML element based on variant (or use `as` to override)
 * - Responsive typography via usePlatform()
 * - Dark mode aware via useDarkMode()
 * - Semantic color props
 *
 * @example
 * <Text variant="headingMd">Section Title</Text>
 * <Text variant="labelMd" color="secondary">Form Label</Text>
 * <Text variant="errorText" color="error">Validation error</Text>
 * <Text as="span" variant="bodySm" color="tertiary">Helper text</Text>
 */
export const Text = forwardRef<HTMLElement, TextProps>(
  (
    {
      variant = 'bodyMd',
      as,
      color = 'primary',
      style,
      children,
      className,
      ...props
    },
    ref
  ) => {
    const { isMobile } = usePlatform()
    const { isDarkMode } = useDarkMode()

    const typography = getTypography(isMobile)
    const colors = getColors(isDarkMode)

    const Component = as || variantElementMap[variant]

    const colorValue = getColorValue(color, colors)

    const combinedStyle: CSSProperties = {
      ...typography[variant],
      color: colorValue,
      margin: 0,
      ...style,
    }

    return (
      <Component ref={ref} style={combinedStyle} className={className} {...props}>
        {children}
      </Component>
    )
  }
)

Text.displayName = 'Text'

/**
 * Get the actual color value from semantic color name
 */
function getColorValue(
  color: TextColor,
  colors: ReturnType<typeof getColors>
): string | undefined {
  switch (color) {
    case 'primary':
      return colors.textPrimary
    case 'secondary':
      return colors.textSecondary
    case 'tertiary':
      return colors.textTertiary
    case 'accent':
      return colors.accent
    case 'error':
      return colors.error
    case 'success':
      return colors.success
    case 'warning':
      return colors.warning
    case 'inherit':
      return 'inherit'
    default:
      return colors.textPrimary
  }
}

export default Text
