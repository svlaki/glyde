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
