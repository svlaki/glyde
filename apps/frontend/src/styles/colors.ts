// Modular theme system
// Each theme family has a light and dark variant
// To add a new theme: add a family to ThemeFamily, both variants to themes, and a label to familyLabels

export type ThemeFamily = 'classic' | 'nord' | 'tokyo' | 'ember' | 'ocean' | 'solar' | 'midnight' | 'forest' | 'sakura' | 'cyber' | 'dune'
export type ThemeMode = 'light' | 'dark'
export type ThemeName = `${ThemeFamily}-${ThemeMode}`

export interface ColorPalette {
  bgPrimary: string
  bgSecondary: string
  bgTertiary: string
  bgHover: string
  border: string
  borderLight: string
  textPrimary: string
  textSecondary: string
  textTertiary: string
  accent: string
  error: string
  errorLight: string
  success: string
  successLight: string
  warning: string
  warningLight: string
}

export const themes: Record<ThemeName, ColorPalette> = {

  // ── Classic ────────────────────────────────────────────────────────
  // Warm cream and charcoal - the original Glyde palette

  'classic-light': {
    bgPrimary: '#fdfbf7',
    bgSecondary: '#fffefc',
    bgTertiary: '#f7f4ef',
    bgHover: '#f2efe9',
    border: '#e8e4de',
    borderLight: '#f0ede8',
    textPrimary: '#2c2825',
    textSecondary: '#5e5852',
    textTertiary: '#8f8882',
    accent: '#2c2825',
    error: '#ef4444',
    errorLight: '#fef2f2',
    success: '#22c55e',
    successLight: '#f0fdf4',
    warning: '#f59e0b',
    warningLight: '#fffbeb',
  },

  'classic-dark': {
    bgPrimary: '#1c1b1a',
    bgSecondary: '#262422',
    bgTertiary: '#302d2b',
    bgHover: '#3a3735',
    border: '#45413e',
    borderLight: '#3b3836',
    textPrimary: '#f2efe9',
    textSecondary: '#beb6b0',
    textTertiary: '#8f8882',
    accent: '#f2efe9',
    error: '#f87171',
    errorLight: '#450a0a',
    success: '#4ade80',
    successLight: '#052e16',
    warning: '#fbbf24',
    warningLight: '#451a03',
  },

  // ── Nord ───────────────────────────────────────────────────────────
  // Arctic, north-bluish palette - clean and frosty
  // https://www.nordtheme.com

  'nord-light': {
    bgPrimary: '#eceff4',
    bgSecondary: '#e5e9f0',
    bgTertiary: '#d8dee9',
    bgHover: '#cdd4e0',
    border: '#c0c8d8',
    borderLight: '#d8dee9',
    textPrimary: '#2e3440',
    textSecondary: '#3b4252',
    textTertiary: '#4c566a',
    accent: '#5e81ac',
    error: '#bf616a',
    errorLight: '#f2dfe0',
    success: '#a3be8c',
    successLight: '#e5efe0',
    warning: '#ebcb8b',
    warningLight: '#f5eeda',
  },

  'nord-dark': {
    bgPrimary: '#2e3440',
    bgSecondary: '#3b4252',
    bgTertiary: '#434c5e',
    bgHover: '#4c566a',
    border: '#4c566a',
    borderLight: '#434c5e',
    textPrimary: '#eceff4',
    textSecondary: '#d8dee9',
    textTertiary: '#81a1c1',
    accent: '#88c0d0',
    error: '#bf616a',
    errorLight: '#3b2a2e',
    success: '#a3be8c',
    successLight: '#2e3b2a',
    warning: '#ebcb8b',
    warningLight: '#3b3728',
  },

  // ── Tokyo ────────────────────────────────────────────────────────
  // Neon-lit indigo nights - electric purple accents on deep violet

  'tokyo-light': {
    bgPrimary: '#f0eef6',
    bgSecondary: '#f5f3fa',
    bgTertiary: '#e4e0f0',
    bgHover: '#d8d2e8',
    border: '#c8c0dc',
    borderLight: '#d8d2e8',
    textPrimary: '#1a1b2e',
    textSecondary: '#3b3d5e',
    textTertiary: '#6c6f93',
    accent: '#7853b5',
    error: '#e5456b',
    errorLight: '#fce4ea',
    success: '#41b883',
    successLight: '#e2f5ec',
    warning: '#e0a528',
    warningLight: '#faf1db',
  },

  'tokyo-dark': {
    bgPrimary: '#1a1b2e',
    bgSecondary: '#1e1f35',
    bgTertiary: '#282a40',
    bgHover: '#33354e',
    border: '#3e4060',
    borderLight: '#33354e',
    textPrimary: '#c8ceee',
    textSecondary: '#9aa0c8',
    textTertiary: '#565c80',
    accent: '#bb9af7',
    error: '#f7768e',
    errorLight: '#2d1b24',
    success: '#73daca',
    successLight: '#1a2d2a',
    warning: '#e0af68',
    warningLight: '#2d2718',
  },

  // ── Ember ───────────────────────────────────────────────────────
  // Molten crimson - glowing red coals on scorched black

  'ember-light': {
    bgPrimary: '#fdf0f0',
    bgSecondary: '#fef4f4',
    bgTertiary: '#f5e0e0',
    bgHover: '#ecd0d0',
    border: '#dbb8b8',
    borderLight: '#ecd0d0',
    textPrimary: '#2a1215',
    textSecondary: '#5c2830',
    textTertiary: '#8c5560',
    accent: '#c62828',
    error: '#b71c1c',
    errorLight: '#fce4e4',
    success: '#2e7d32',
    successLight: '#e8f5e9',
    warning: '#e65100',
    warningLight: '#fff3e0',
  },

  'ember-dark': {
    bgPrimary: '#1a0c0c',
    bgSecondary: '#241212',
    bgTertiary: '#301a1a',
    bgHover: '#3e2424',
    border: '#502e2e',
    borderLight: '#3e2424',
    textPrimary: '#f0d4d4',
    textSecondary: '#c09090',
    textTertiary: '#7a5555',
    accent: '#ef5350',
    error: '#ff7070',
    errorLight: '#2d1414',
    success: '#66bb6a',
    successLight: '#1a2b1a',
    warning: '#ffa726',
    warningLight: '#2d2014',
  },

  // ── Ocean ───────────────────────────────────────────────────────
  // Deep sea blues - bioluminescent teal on abyssal navy

  'ocean-light': {
    bgPrimary: '#eef5f8',
    bgSecondary: '#f3f8fa',
    bgTertiary: '#dceef4',
    bgHover: '#cce4ee',
    border: '#b0d0e0',
    borderLight: '#cce4ee',
    textPrimary: '#0d2b3e',
    textSecondary: '#1e4d65',
    textTertiary: '#4e7e95',
    accent: '#0a7ea4',
    error: '#d32f2f',
    errorLight: '#fce4e4',
    success: '#2e7d6a',
    successLight: '#e0f2ee',
    warning: '#c87f18',
    warningLight: '#f8f0dd',
  },

  'ocean-dark': {
    bgPrimary: '#0c1a24',
    bgSecondary: '#102230',
    bgTertiary: '#18303f',
    bgHover: '#243d4e',
    border: '#304d5e',
    borderLight: '#243d4e',
    textPrimary: '#d4eaf5',
    textSecondary: '#8bb8ce',
    textTertiary: '#4e7e95',
    accent: '#4fc3f7',
    error: '#ef5350',
    errorLight: '#2d1616',
    success: '#66bb9a',
    successLight: '#122b22',
    warning: '#f0b860',
    warningLight: '#2d2612',
  },

  // ── Solar ──────────────────────────────────────────────────────────
  // Sunrise (light) / Sunset (dark) - warm amber and plum

  'solar-light': {
    bgPrimary: '#fdf6f0',
    bgSecondary: '#fef9f4',
    bgTertiary: '#f5ebe0',
    bgHover: '#eddfd0',
    border: '#e0d0be',
    borderLight: '#eddfd0',
    textPrimary: '#3d2c1e',
    textSecondary: '#6b5442',
    textTertiary: '#9a8574',
    accent: '#c76f30',
    error: '#c93c37',
    errorLight: '#fce8e7',
    success: '#5a8a3c',
    successLight: '#eaf3e4',
    warning: '#c48820',
    warningLight: '#f9f0dd',
  },

  'solar-dark': {
    bgPrimary: '#1a1019',
    bgSecondary: '#231620',
    bgTertiary: '#2e1e2a',
    bgHover: '#3d2836',
    border: '#4a3344',
    borderLight: '#3d2836',
    textPrimary: '#f5e6d3',
    textSecondary: '#c9a88e',
    textTertiary: '#8b6b5a',
    accent: '#e8976d',
    error: '#e54d6b',
    errorLight: '#331828',
    success: '#7ec89d',
    successLight: '#1a2b20',
    warning: '#f0c060',
    warningLight: '#33281a',
  },

  // ── Midnight ───────────────────────────────────────────────────────
  // Cool blue steel - crisp and electric

  'midnight-light': {
    bgPrimary: '#f0f3f8',
    bgSecondary: '#f6f8fb',
    bgTertiary: '#e4e9f2',
    bgHover: '#d6dde9',
    border: '#c4cfe0',
    borderLight: '#d6dde9',
    textPrimary: '#1a2332',
    textSecondary: '#3d4f65',
    textTertiary: '#7889a0',
    accent: '#2563eb',
    error: '#dc2626',
    errorLight: '#fce8e8',
    success: '#16a34a',
    successLight: '#e4f5ec',
    warning: '#ca8a04',
    warningLight: '#fef9e7',
  },

  'midnight-dark': {
    bgPrimary: '#0d1117',
    bgSecondary: '#161b22',
    bgTertiary: '#21262d',
    bgHover: '#30363d',
    border: '#30363d',
    borderLight: '#21262d',
    textPrimary: '#e6edf3',
    textSecondary: '#8b949e',
    textTertiary: '#484f58',
    accent: '#58a6ff',
    error: '#f85149',
    errorLight: '#2d1214',
    success: '#3fb950',
    successLight: '#122117',
    warning: '#d29922',
    warningLight: '#2d2412',
  },

  // ── Forest ─────────────────────────────────────────────────────────
  // Deep woodland greens with earthy undertones

  'forest-light': {
    bgPrimary: '#eef5eb',
    bgSecondary: '#f3f9f0',
    bgTertiary: '#dcebd5',
    bgHover: '#cde0c4',
    border: '#b3cfaa',
    borderLight: '#cde0c4',
    textPrimary: '#1a2916',
    textSecondary: '#34502a',
    textTertiary: '#5c7f4e',
    accent: '#3d7a30',
    error: '#c53030',
    errorLight: '#fce8e8',
    success: '#2d8a4e',
    successLight: '#ddf2e5',
    warning: '#a87818',
    warningLight: '#f5edda',
  },

  'forest-dark': {
    bgPrimary: '#1a1f1a',
    bgSecondary: '#212821',
    bgTertiary: '#2a332a',
    bgHover: '#354035',
    border: '#3d4a3d',
    borderLight: '#354035',
    textPrimary: '#dde5d9',
    textSecondary: '#a8b5a0',
    textTertiary: '#6b7a63',
    accent: '#8fbf7a',
    error: '#d4605a',
    errorLight: '#2d1a18',
    success: '#7bc47b',
    successLight: '#1a2b1a',
    warning: '#d4a84b',
    warningLight: '#2b2615',
  },

  // ── Sakura ──────────────────────────────────────────────────────
  // Cherry blossom - soft blush pinks and deep plum

  'sakura-light': {
    bgPrimary: '#fdf2f6',
    bgSecondary: '#fef6f9',
    bgTertiary: '#f5e0ea',
    bgHover: '#edd0dd',
    border: '#ddb8cc',
    borderLight: '#edd0dd',
    textPrimary: '#2d1524',
    textSecondary: '#5c3050',
    textTertiary: '#8c6080',
    accent: '#d63384',
    error: '#c62828',
    errorLight: '#fce4e4',
    success: '#2e7d6a',
    successLight: '#e0f2ee',
    warning: '#c87f18',
    warningLight: '#f8f0dd',
  },

  'sakura-dark': {
    bgPrimary: '#1a0e16',
    bgSecondary: '#241420',
    bgTertiary: '#301c2a',
    bgHover: '#3e2838',
    border: '#503446',
    borderLight: '#3e2838',
    textPrimary: '#f0d8e8',
    textSecondary: '#c090b0',
    textTertiary: '#7a5570',
    accent: '#f06292',
    error: '#ef5350',
    errorLight: '#2d1418',
    success: '#66bb9a',
    successLight: '#122b22',
    warning: '#f0b860',
    warningLight: '#2d2612',
  },

  // ── Cyber ───────────────────────────────────────────────────────
  // Neon cyberpunk - electric cyan and hot magenta on void black

  'cyber-light': {
    bgPrimary: '#f0f4f8',
    bgSecondary: '#f5f8fb',
    bgTertiary: '#e0e8f0',
    bgHover: '#d0dce8',
    border: '#b8c8d8',
    borderLight: '#d0dce8',
    textPrimary: '#0a1628',
    textSecondary: '#1e3450',
    textTertiary: '#4a6580',
    accent: '#00acc1',
    error: '#e91e63',
    errorLight: '#fce4ec',
    success: '#00c853',
    successLight: '#e0f8ea',
    warning: '#ff9100',
    warningLight: '#fff3e0',
  },

  'cyber-dark': {
    bgPrimary: '#0a0a12',
    bgSecondary: '#10101c',
    bgTertiary: '#1a1a28',
    bgHover: '#252535',
    border: '#303045',
    borderLight: '#252535',
    textPrimary: '#e0e4f0',
    textSecondary: '#8890b0',
    textTertiary: '#505570',
    accent: '#00e5ff',
    error: '#ff4081',
    errorLight: '#2d1020',
    success: '#69f0ae',
    successLight: '#0a2d1a',
    warning: '#ffab40',
    warningLight: '#2d2010',
  },

  // ── Dune ────────────────────────────────────────────────────────
  // Desert sandstone - warm terracotta and sage on sun-bleached earth

  'dune-light': {
    bgPrimary: '#f8f2ea',
    bgSecondary: '#fcf7f0',
    bgTertiary: '#ede4d6',
    bgHover: '#e2d6c4',
    border: '#d0c0a8',
    borderLight: '#e2d6c4',
    textPrimary: '#2c2418',
    textSecondary: '#5c4e38',
    textTertiary: '#8a7c66',
    accent: '#a0522d',
    error: '#c62828',
    errorLight: '#fce4e4',
    success: '#6b8e50',
    successLight: '#ecf2e4',
    warning: '#b8860b',
    warningLight: '#f5ecd8',
  },

  'dune-dark': {
    bgPrimary: '#1a1610',
    bgSecondary: '#221e16',
    bgTertiary: '#2e2820',
    bgHover: '#3c342a',
    border: '#4d4236',
    borderLight: '#3c342a',
    textPrimary: '#e8dcc8',
    textSecondary: '#b8a888',
    textTertiary: '#7a6e58',
    accent: '#cd8b62',
    error: '#d4605a',
    errorLight: '#2d1a14',
    success: '#8fae72',
    successLight: '#1e2b18',
    warning: '#d4a84b',
    warningLight: '#2b2615',
  },
}

// Theme families for the picker
export const themeFamilies: ThemeFamily[] = ['classic', 'nord', 'tokyo', 'ember', 'ocean', 'solar', 'midnight', 'forest', 'sakura', 'cyber', 'dune']

// Display labels for each family
export const familyLabels: Record<ThemeFamily, string> = {
  classic: 'Classic',
  nord: 'Nord',
  tokyo: 'Tokyo',
  ember: 'Ember',
  ocean: 'Ocean',
  solar: 'Solar',
  midnight: 'Midnight',
  forest: 'Forest',
  sakura: 'Sakura',
  cyber: 'Cyber',
  dune: 'Dune',
}

// Resolve a family + mode into a flat ThemeName key
export const resolveTheme = (family: ThemeFamily, mode: ThemeMode): ThemeName => `${family}-${mode}`

// All flat theme names (for validation)
export const themeNames = Object.keys(themes) as ThemeName[]

export const getColors = (theme: ThemeName): ColorPalette => themes[theme]

// Utility function to convert hex color to rgba with opacity
export const hexToRgba = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
