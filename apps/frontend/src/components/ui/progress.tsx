import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"
import { useTheme } from "../../lib/themeContext"

export interface ProgressProps extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  value?: number
}

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(({ value, ...props }, ref) => {
  const { theme, isDarkMode } = useTheme()

  return (
    <ProgressPrimitive.Root
      ref={ref}
      style={{
        position: 'relative',
        height: '8px',
        width: '100%',
        overflow: 'hidden',
        borderRadius: '999px',
        background: isDarkMode ? '#2a2a2a' : '#e5e5e5'
      }}
      {...props}
    >
      <ProgressPrimitive.Indicator
        style={{
          height: '100%',
          width: '100%',
          background: isDarkMode ? '#fff' : '#000',
          transition: 'transform 0.3s cubic-bezier(0.65, 0, 0.35, 1)',
          transform: `translateX(-${100 - (value || 0)}%)`
        }}
      />
    </ProgressPrimitive.Root>
  )
})

Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }
