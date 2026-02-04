// Color palette for the application

export const colors = {
  light: {
    // Backgrounds - Warmer / Creamier
    bgPrimary: '#fdfbf7',      // Very light cream/off-white
    bgSecondary: '#fffefc',    // Almost white, slightly warm
    bgTertiary: '#f7f4ef',     // Warm light beige for headers/sections
    bgHover: '#f2efe9',        // Slightly darker warm beige

    // Borders - Warm grays/browns
    border: '#e8e4de',
    borderLight: '#f0ede8',

    // Text - Warm dark grays/browns
    textPrimary: '#2c2825',    // Warm charcoal
    textSecondary: '#5e5852',  // Warm medium gray
    textTertiary: '#8f8882',   // Warm light gray

    // Accent
    accent: '#2c2825',         // Same as textPrimary for consistency

    // Semantic colors - Form states
    error: '#ef4444',          // Red for errors
    errorLight: '#fef2f2',     // Light red background
    success: '#22c55e',        // Green for success
    successLight: '#f0fdf4',   // Light green background
    warning: '#f59e0b',        // Amber for warnings
    warningLight: '#fffbeb',   // Light amber background
  },
  dark: {
    // Backgrounds - Warmer dark stones
    bgPrimary: '#1c1b1a',      // Warm dark charcoal
    bgSecondary: '#262422',    // Dark warm gray
    bgTertiary: '#302d2b',     // Lighter warm gray
    bgHover: '#3a3735',        // Hover state

    // Borders
    border: '#45413e',
    borderLight: '#3b3836',

    // Text
    textPrimary: '#f2efe9',    // Warm off-white
    textSecondary: '#beb6b0',  // Warm light gray
    textTertiary: '#8f8882',   // Muted warm gray

    // Accent
    accent: '#f2efe9',         // Same as textPrimary for consistency

    // Semantic colors - Form states
    error: '#f87171',          // Lighter red for dark mode
    errorLight: '#450a0a',     // Dark red background
    success: '#4ade80',        // Lighter green for dark mode
    successLight: '#052e16',   // Dark green background
    warning: '#fbbf24',        // Lighter amber for dark mode
    warningLight: '#451a03',   // Dark amber background
  }
}

export const getColors = (isDarkMode: boolean) => isDarkMode ? colors.dark : colors.light

// Utility function to convert hex color to rgba with opacity
export const hexToRgba = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
