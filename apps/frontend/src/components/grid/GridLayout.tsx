import { ReactNode } from 'react'
import {
  ResponsiveGridLayout,
  useContainerWidth,
} from 'react-grid-layout'
import type { Layout, ResponsiveLayouts } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import './gridStyles.css'

const BREAKPOINTS = { lg: 1200, md: 996, sm: 768 }
const COLS = { lg: 12, md: 10, sm: 6 }

export const DEFAULT_LAYOUTS: ResponsiveLayouts = {
  lg: [
    { i: 'inbox', x: 0, y: 0, w: 3, h: 14, minW: 2, minH: 6 },
    { i: 'todolist', x: 0, y: 14, w: 3, h: 14, minW: 2, minH: 6 },
    { i: 'calendar', x: 3, y: 0, w: 6, h: 28, minW: 4, minH: 16 },
    { i: 'chatbot', x: 9, y: 0, w: 3, h: 28, minW: 2, minH: 10 },
  ],
  md: [
    { i: 'inbox', x: 0, y: 0, w: 3, h: 14, minW: 2, minH: 6 },
    { i: 'todolist', x: 0, y: 14, w: 3, h: 14, minW: 2, minH: 6 },
    { i: 'calendar', x: 3, y: 0, w: 5, h: 28, minW: 3, minH: 16 },
    { i: 'chatbot', x: 8, y: 0, w: 2, h: 28, minW: 2, minH: 10 },
  ],
  sm: [
    { i: 'calendar', x: 0, y: 0, w: 6, h: 20, minW: 4, minH: 12 },
    { i: 'chatbot', x: 0, y: 20, w: 6, h: 8, minW: 2, minH: 6 },
    { i: 'inbox', x: 0, y: 28, w: 3, h: 10, minW: 2, minH: 6 },
    { i: 'todolist', x: 3, y: 28, w: 3, h: 10, minW: 2, minH: 6 },
  ],
}

interface GridLayoutContainerProps {
  children: ReactNode
  onLayoutChange?: (layout: Layout, allLayouts: ResponsiveLayouts) => void
}

export function GridLayoutContainer({ children, onLayoutChange }: GridLayoutContainerProps) {
  const { width, containerRef, mounted } = useContainerWidth({
    initialWidth: 1280,
  })

  const gridProps = {
    width,
    breakpoints: BREAKPOINTS,
    cols: COLS,
    layouts: DEFAULT_LAYOUTS,
    rowHeight: Math.floor((window.innerHeight - 20) / 28),
    margin: [4, 4] as [number, number],
    containerPadding: [4, 4] as [number, number],
    autoSize: false,
    style: { height: '100%' },
    dragConfig: {
      enabled: false,
      handle: '.widget-drag-handle',
    },
    resizeConfig: {
      enabled: false,
    },
    onLayoutChange,
  }

  return (
    <div ref={containerRef} style={{ height: '100%', width: '100%' }}>
      {mounted && (
        // @ts-expect-error react-grid-layout types incompatible with exactOptionalPropertyTypes
        <ResponsiveGridLayout {...gridProps}>
          {children}
        </ResponsiveGridLayout>
      )}
    </div>
  )
}
