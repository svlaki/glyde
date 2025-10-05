import { createTheme, MantineColorsTuple } from '@mantine/core'

// Custom brand color palette
const brandColors: MantineColorsTuple = [
  '#EEF2FF',
  '#E0E7FF',
  '#C7D2FE',
  '#A5B4FC',
  '#818CF8',
  '#6366F1',
  '#4F46E5',
  '#4338CA',
  '#3730A3',
  '#312E81',
]

export const theme = createTheme({
  primaryColor: 'brand',
  colors: {
    brand: brandColors,
  },
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  headings: {
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontWeight: '600',
  },
  defaultRadius: 'md',
  cursorType: 'pointer',

  // Component-specific defaults
  components: {
    Button: {
      defaultProps: {
        radius: 'md',
      },
    },
    Card: {
      defaultProps: {
        radius: 'lg',
        withBorder: true,
      },
    },
    Modal: {
      defaultProps: {
        radius: 'lg',
        centered: true,
      },
    },
    TextInput: {
      defaultProps: {
        radius: 'md',
      },
    },
    Select: {
      defaultProps: {
        radius: 'md',
      },
    },
  },

  // Custom properties for our app
  other: {
    eventColors: {
      work: '#3B82F6',
      personal: '#10B981',
      health: '#F59E0B',
      learning: '#8B5CF6',
      default: '#6b7280',
    },
  },
})
