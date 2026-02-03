import { CSSProperties } from 'react'

/**
 * Typography System
 *
 * Consistent font styles for use in React components with inline styles.
 * Mirrors the CSS classes defined in globals.css.
 *
 * Font usage:
 *   - Serif (EB Garamond): All headings (display + heading)
 *   - Sans (Inter): Body text, labels, UI elements
 *
 * Usage:
 *   import { typography } from '../styles/typography'
 *   <h1 style={typography.displayLg}>Hello</h1>
 *   <p style={typography.bodyMd}>Content</p>
 */

// Font families
export const fontFamily = {
  sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
  serif: "'EB Garamond', 'Garamond', Georgia, serif",
  mono: "'SF Mono', 'Fira Code', 'Fira Mono', 'Roboto Mono', monospace",
}

// Font sizes (desktop values - use getTypography for responsive)
export const fontSize = {
  xs: '11px',
  sm: '13px',
  base: '15px',
  lg: '17px',
  xl: '20px',
  '2xl': '24px',
  '3xl': '30px',
  '4xl': '36px',
}

// Mobile font sizes
export const fontSizeMobile = {
  xs: '11px',
  sm: '12px',
  base: '14px',
  lg: '16px',
  xl: '18px',
  '2xl': '22px',
  '3xl': '26px',
  '4xl': '32px',
}

// Line heights
export const lineHeight = {
  tight: 1.25,
  normal: 1.5,
  relaxed: 1.625,
}

// Letter spacing
export const letterSpacing = {
  tight: '-0.02em',
  normal: '0',
  wide: '0.02em',
}

// Font weights
export const fontWeight = {
  light: 300,
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
}

/**
 * Pre-defined typography styles
 * Use these for consistent text styling across the app
 */
export const typography = {
  // Display text (Serif - for hero/brand)
  displayLg: {
    fontFamily: fontFamily.serif,
    fontSize: fontSize['4xl'],
    fontWeight: fontWeight.bold,
    lineHeight: lineHeight.tight,
    letterSpacing: letterSpacing.tight,
  } as CSSProperties,

  displayMd: {
    fontFamily: fontFamily.serif,
    fontSize: fontSize['3xl'],
    fontWeight: fontWeight.bold,
    lineHeight: lineHeight.tight,
    letterSpacing: letterSpacing.tight,
  } as CSSProperties,

  displaySm: {
    fontFamily: fontFamily.serif,
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.semibold,
    lineHeight: lineHeight.tight,
    letterSpacing: letterSpacing.tight,
  } as CSSProperties,

  // Heading text (Serif - for sections)
  headingLg: {
    fontFamily: fontFamily.serif,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    lineHeight: lineHeight.tight,
    letterSpacing: letterSpacing.tight,
  } as CSSProperties,

  headingMd: {
    fontFamily: fontFamily.serif,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    lineHeight: lineHeight.tight,
    letterSpacing: letterSpacing.normal,
  } as CSSProperties,

  headingSm: {
    fontFamily: fontFamily.serif,
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    lineHeight: lineHeight.tight,
    letterSpacing: letterSpacing.normal,
  } as CSSProperties,

  // Body text (Sans - for content)
  bodyLg: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.normal,
    lineHeight: lineHeight.relaxed,
  } as CSSProperties,

  bodyMd: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    fontWeight: fontWeight.normal,
    lineHeight: lineHeight.normal,
  } as CSSProperties,

  bodySm: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.normal,
    lineHeight: lineHeight.normal,
  } as CSSProperties,

  // Label text (Sans - for UI elements)
  labelLg: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    lineHeight: lineHeight.tight,
    letterSpacing: letterSpacing.wide,
  } as CSSProperties,

  labelMd: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    lineHeight: lineHeight.tight,
    letterSpacing: letterSpacing.wide,
  } as CSSProperties,

  labelSm: {
    fontFamily: fontFamily.sans,
    fontSize: '10px',
    fontWeight: fontWeight.medium,
    lineHeight: lineHeight.tight,
    letterSpacing: letterSpacing.wide,
    textTransform: 'uppercase',
  } as CSSProperties,

  // Monospace (for code)
  mono: {
    fontFamily: fontFamily.mono,
    fontSize: fontSize.sm,
    lineHeight: lineHeight.normal,
  } as CSSProperties,
}

/**
 * Get responsive typography based on screen width
 * Useful for components that need to adjust typography for mobile
 */
export function getTypography(isMobile: boolean) {
  const sizes = isMobile ? fontSizeMobile : fontSize

  return {
    displayLg: { ...typography.displayLg, fontSize: sizes['4xl'] },
    displayMd: { ...typography.displayMd, fontSize: sizes['3xl'] },
    displaySm: { ...typography.displaySm, fontSize: sizes['2xl'] },
    headingLg: { ...typography.headingLg, fontSize: sizes.xl },
    headingMd: { ...typography.headingMd, fontSize: sizes.lg },
    headingSm: { ...typography.headingSm, fontSize: sizes.base },
    bodyLg: { ...typography.bodyLg, fontSize: sizes.lg },
    bodyMd: { ...typography.bodyMd, fontSize: sizes.base },
    bodySm: { ...typography.bodySm, fontSize: sizes.sm },
    labelLg: { ...typography.labelLg, fontSize: sizes.sm },
    labelMd: { ...typography.labelMd, fontSize: sizes.xs },
    labelSm: typography.labelSm, // Fixed size
    mono: { ...typography.mono, fontSize: sizes.sm },
  }
}

/**
 * Merge typography style with custom overrides
 */
export function withTypography(
  base: keyof typeof typography,
  overrides?: CSSProperties
): CSSProperties {
  return { ...typography[base], ...overrides }
}
