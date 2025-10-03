const { colors, shadows, spacing, borderRadius, typography, animations, zIndex } = require('./src/styles/design-tokens.ts');

module.exports = {
  darkMode: 'class',
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',      // app code
    './components/**/*.{js,ts,jsx,tsx}',   // shadcn-ui components
    './pages/**/*.{js,ts,jsx,tsx}',        // pages dir if present
  ],
  theme: {
    extend: {
      colors: {
        primary: colors.primary,
        success: colors.success,
        warning: colors.warning,
        error: colors.error,
        accent: colors.accent,
        neutral: colors.neutral,
      },
      boxShadow: shadows,
      spacing: spacing,
      borderRadius: borderRadius,
      fontFamily: typography.fontFamily,
      fontSize: typography.fontSize,
      fontWeight: typography.fontWeight,
      zIndex: zIndex,
      keyframes: animations.keyframes,
      animation: {
        'fade-in': 'fadeIn 200ms ease-out',
        'slide-up': 'slideUp 300ms ease-out',
        'slide-down': 'slideDown 300ms ease-out',
        'scale-up': 'scaleUp 200ms ease-out',
        'scale-down': 'scaleDown 100ms ease-out',
        'pulse': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin': 'spin 1s linear infinite',
        'bounce': 'bounce 1s infinite',
      },
      transitionDuration: animations.duration,
      transitionTimingFunction: {
        'ease-out-cubic': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [
    require('tw-animate-css'),
    require('@tailwindcss/forms'),
  ],
}
