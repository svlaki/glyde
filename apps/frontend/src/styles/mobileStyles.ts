import { CSSProperties } from 'react'

// Mobile header style constants for uniform headers across all pages
export const mobileHeaderStyles = {
  // Container
  gap: '8px',
  paddingX: '16px',
  paddingTop: 'max(env(safe-area-inset-top), 8px)',
  paddingBottom: '8px',
  marginBottom: '8px',

  // Menu/Back button
  buttonFontSize: '20px',
  buttonPadding: '2px',
  buttonMinSize: '28px',

  // Title
  titleFontSize: '18px',
  titleFontWeight: '700' as const,
  titleLetterSpacing: '-0.02em',
}

// Unified mobile spacing constants for consistent padding across all pages
export const mobileSpacing = {
  // Horizontal padding (responsive)
  paddingX: 'clamp(12px, 2.5vw, 16px)',

  // Vertical padding base (without safe area)
  paddingTop: '12px',
  paddingBottom: '12px',

  // Full padding with safe areas
  paddingTopSafe: 'calc(env(safe-area-inset-top, 0px) + 12px)',
  paddingBottomSafe: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',

  // For pages without tab bar (fullscreen views)
  paddingBottomNoTabs: 'calc(20px + env(safe-area-inset-bottom, 0px))',

  // Negative margin to extend content to edges (for full-width components)
  negativeMarginX: 'calc(-1 * clamp(12px, 2.5vw, 16px))',
}

export const mobileStyles = {
  safeArea: {
    paddingTop: 'env(safe-area-inset-top)',
    paddingBottom: 'env(safe-area-inset-bottom)',
    paddingLeft: 'env(safe-area-inset-left)',
    paddingRight: 'env(safe-area-inset-right)'
  } as CSSProperties,

  scrollContainer: {
    flex: 1,
    overflow: 'auto',
    WebkitOverflowScrolling: 'touch',
    minHeight: 0, // Critical for flexbox scrolling
    msOverflowStyle: 'none',
    scrollbarWidth: 'none'
  } as CSSProperties,

  fullHeight: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  } as CSSProperties,

  touchTarget: {
    minHeight: '44px',
    minWidth: '44px'
  } as CSSProperties
}
