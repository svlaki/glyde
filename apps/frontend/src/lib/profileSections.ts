export const PROFILE_SECTIONS = [
  {
    key: 'values',
    label: 'Values & Beliefs',
    icon: '',
    description: 'Your core values, life principles, and what matters most to you',
    isJsonb: true,
  },
  {
    key: 'preferences',
    label: 'Preferences',
    icon: '',
    description: 'How you like things done, work environment, communication style',
    isJsonb: true,
  },
  {
    key: 'work_patterns',
    label: 'Work Patterns',
    icon: '',
    description: 'Productivity habits, peak hours, work style, focus patterns',
    isJsonb: true,
  },
  {
    key: 'personality_traits',
    label: 'Personality & Traits',
    icon: '',
    description: 'Communication style, OCEAN traits, how you approach problems',
    isJsonb: true,
  },
  {
    key: 'context_data',
    label: 'Additional Context',
    icon: '',
    description: 'Any other context that helps the AI understand you better',
    isJsonb: true,
  },
  {
    key: 'goals_summary',
    label: 'Goals Summary',
    icon: '',
    description: 'High-level overview of your goals and aspirations',
    isJsonb: false,
  },
] as const

export type ProfileSection = typeof PROFILE_SECTIONS[number]
export type ProfileSectionKey = ProfileSection['key']

export interface ProfileData {
  values?: Record<string, unknown>
  preferences?: Record<string, unknown>
  work_patterns?: Record<string, unknown>
  personality_traits?: Record<string, unknown>
  context_data?: Record<string, unknown>
  goals_summary?: string
}
