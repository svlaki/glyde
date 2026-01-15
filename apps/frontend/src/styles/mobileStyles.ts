import { CSSProperties } from 'react'

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
    minHeight: '100vh',
    maxHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  } as CSSProperties,

  touchTarget: {
    minHeight: '44px',
    minWidth: '44px'
  } as CSSProperties
}
