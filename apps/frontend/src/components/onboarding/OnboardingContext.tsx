import { createContext, useContext, useReducer, ReactNode, useCallback } from 'react'
import { DEFAULT_ASPECTS } from '../../lib/onboardingService'
import type { CalendarMapping } from '../../lib/connectionService'

// Types for pre-fill from saved data
export interface PrefillData {
  fullName?: string
  preferredName?: string
  birthday?: string
  gender?: string
  selectedCalendars?: string[]
  otherCalendar?: string
  occupation?: string
  fieldOfStudy?: string
  aspects?: Array<{ name: string; description?: string }> | string[]
  goals?: Array<{ title: string; description?: string }> | string[]
  habits?: string[]
  timezone?: string
}

export interface OnboardingState {
  currentSection: 1 | 2 | 3

  // Section 1: Basic Info
  fullName: string
  preferredName: string
  birthday: string
  gender: string

  // Section 2: Calendar
  selectedCalendars: string[]
  otherCalendar: string
  wantsToImport: boolean
  calendarImportStatus: 'idle' | 'importing' | 'success' | 'error'
  importJobId?: string
  importedEventCount: number

  // Section 2: Google Calendar Connection (new flow)
  googleConnected: boolean
  connectionId: string | null
  calendarMappings: CalendarMapping[]

  // Section 3: Habits & Goals
  occupation: string
  isStudent: boolean
  fieldOfStudy: string
  aspects: string[]
  aspectDescriptions: Record<string, string>
  customAspect: string
  goals: string[]
  goalDescriptions: Record<string, string>
  currentGoal: string
  habits: string[]

  // Auto-detected
  timezone: string
  timezoneConfirmed: boolean

  // UI state
  loading: boolean
  error: string | null
}

type OnboardingAction =
  | { type: 'SET_FIELD'; field: keyof OnboardingState; value: any }
  | { type: 'NEXT_SECTION' }
  | { type: 'PREV_SECTION' }
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'SET_CALENDAR_IMPORT_STATUS'; status: 'idle' | 'importing' | 'success' | 'error'; jobId?: string; eventCount?: number }
  | { type: 'SET_GOOGLE_CONNECTION'; connectionId: string; mappings: CalendarMapping[] }
  | { type: 'SET_CALENDAR_MAPPINGS'; mappings: CalendarMapping[] }
  | { type: 'UPDATE_MAPPING_SYNC'; mappingId: string; isSynced: boolean }
  | { type: 'SET_ASPECT_DESCRIPTION'; aspect: string; description: string }
  | { type: 'SET_GOAL_DESCRIPTION'; goal: string; description: string }
  | { type: 'ADD_GOAL'; goal: string }
  | { type: 'REMOVE_GOAL'; index: number }
  | { type: 'ADD_ASPECT'; aspect: string }
  | { type: 'REMOVE_ASPECT'; aspect: string }
  | { type: 'TOGGLE_HABIT'; habitId: string }
  | { type: 'TOGGLE_CALENDAR'; calendarId: string }
  | { type: 'PREFILL'; data: PrefillData }
  | { type: 'RESET' }

interface OnboardingContextType {
  state: OnboardingState
  dispatch: React.Dispatch<OnboardingAction>
  updateField: <K extends keyof OnboardingState>(field: K, value: OnboardingState[K]) => void
  nextSection: () => void
  prevSection: () => void
  canProceedSection1: () => boolean
  canProceedSection2: () => boolean
  canProceedSection3: () => boolean
  addGoal: () => void
  removeGoal: (index: number) => void
  addAspect: () => void
  removeAspect: (aspect: string) => void
  toggleHabit: (habitId: string) => void
  toggleCalendar: (calendarId: string) => void
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined)

const initialState: OnboardingState = {
  currentSection: 1,
  fullName: '',
  preferredName: '',
  birthday: '',
  gender: '',
  selectedCalendars: [],
  otherCalendar: '',
  wantsToImport: false,
  calendarImportStatus: 'idle',
  importedEventCount: 0,
  googleConnected: false,
  connectionId: null,
  calendarMappings: [],
  occupation: '',
  isStudent: false,
  fieldOfStudy: '',
  aspects: [...DEFAULT_ASPECTS],
  aspectDescriptions: {},
  customAspect: '',
  goals: [],
  goalDescriptions: {},
  currentGoal: '',
  habits: [],
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York',
  timezoneConfirmed: false,
  loading: false,
  error: null,
}

function onboardingReducer(state: OnboardingState, action: OnboardingAction): OnboardingState {
  switch (action.type) {
    case 'SET_FIELD':
      const newState = { ...state, [action.field]: action.value }
      // Auto-detect student status when occupation changes
      if (action.field === 'occupation') {
        const studentKeywords = ['student', 'university', 'college', 'school', 'studying', 'undergraduate', 'graduate', 'phd', 'masters']
        const isStudent = studentKeywords.some(keyword =>
          (action.value as string).toLowerCase().includes(keyword)
        )
        newState.isStudent = isStudent
      }
      return newState

    case 'NEXT_SECTION':
      return { ...state, currentSection: Math.min(3, state.currentSection + 1) as 1 | 2 | 3 }

    case 'PREV_SECTION':
      return { ...state, currentSection: Math.max(1, state.currentSection - 1) as 1 | 2 | 3 }

    case 'SET_LOADING':
      return { ...state, loading: action.loading }

    case 'SET_ERROR':
      return { ...state, error: action.error }

    case 'SET_CALENDAR_IMPORT_STATUS':
      return {
        ...state,
        calendarImportStatus: action.status,
        importJobId: action.jobId,
        importedEventCount: action.eventCount ?? state.importedEventCount
      }

    case 'SET_GOOGLE_CONNECTION':
      return {
        ...state,
        googleConnected: true,
        connectionId: action.connectionId,
        calendarMappings: action.mappings,
      }

    case 'SET_CALENDAR_MAPPINGS':
      return {
        ...state,
        calendarMappings: action.mappings,
      }

    case 'UPDATE_MAPPING_SYNC':
      return {
        ...state,
        calendarMappings: state.calendarMappings.map(m =>
          m.id === action.mappingId
            ? { ...m, is_synced: action.isSynced }
            : m
        ),
      }

    case 'SET_ASPECT_DESCRIPTION': {
      return {
        ...state,
        aspectDescriptions: { ...state.aspectDescriptions, [action.aspect]: action.description },
      }
    }

    case 'SET_GOAL_DESCRIPTION': {
      return {
        ...state,
        goalDescriptions: { ...state.goalDescriptions, [action.goal]: action.description },
      }
    }

    case 'ADD_GOAL':
      if (action.goal.trim() && !state.goals.includes(action.goal.trim())) {
        return { ...state, goals: [...state.goals, action.goal.trim()], currentGoal: '' }
      }
      return state

    case 'REMOVE_GOAL': {
      const removedGoal = state.goals[action.index]
      const { [removedGoal]: _, ...remainingGoalDescs } = state.goalDescriptions
      return {
        ...state,
        goals: state.goals.filter((__, i) => i !== action.index),
        goalDescriptions: remainingGoalDescs,
      }
    }

    case 'ADD_ASPECT':
      if (action.aspect.trim() && !state.aspects.includes(action.aspect.trim())) {
        return { ...state, aspects: [...state.aspects, action.aspect.trim()], customAspect: '' }
      }
      return state

    case 'REMOVE_ASPECT': {
      const { [action.aspect]: _, ...remainingAspectDescs } = state.aspectDescriptions
      return {
        ...state,
        aspects: state.aspects.filter(a => a !== action.aspect),
        aspectDescriptions: remainingAspectDescs,
      }
    }

    case 'TOGGLE_HABIT':
      if (state.habits.includes(action.habitId)) {
        return { ...state, habits: state.habits.filter(h => h !== action.habitId) }
      } else {
        return { ...state, habits: [...state.habits, action.habitId] }
      }

    case 'TOGGLE_CALENDAR':
      if (action.calendarId === 'none') {
        // If selecting 'none', clear other selections
        if (state.selectedCalendars.includes('none')) {
          return { ...state, selectedCalendars: [] }
        }
        return { ...state, selectedCalendars: ['none'], wantsToImport: false }
      }
      // If selecting a calendar, remove 'none' if present
      let newCalendars = state.selectedCalendars.filter(c => c !== 'none')
      if (newCalendars.includes(action.calendarId)) {
        newCalendars = newCalendars.filter(c => c !== action.calendarId)
      } else {
        newCalendars = [...newCalendars, action.calendarId]
      }
      return { ...state, selectedCalendars: newCalendars }

    case 'PREFILL': {
      const d = action.data
      const studentKeywords = ['student', 'university', 'college', 'school', 'studying', 'undergraduate', 'graduate', 'phd', 'masters']

      // Parse aspects: support both string[] and enriched format
      let aspectNames: string[] = state.aspects
      let aspectDescs: Record<string, string> = {}
      if (d.aspects && d.aspects.length > 0) {
        aspectNames = d.aspects.map(a => typeof a === 'string' ? a : a.name)
        for (const a of d.aspects) {
          if (typeof a !== 'string' && a.description) {
            aspectDescs[a.name] = a.description
          }
        }
      }

      // Parse goals: support both string[] and enriched format
      let goalTitles: string[] = state.goals
      let goalDescs: Record<string, string> = {}
      if (d.goals && d.goals.length > 0) {
        goalTitles = d.goals.map(g => typeof g === 'string' ? g : g.title)
        for (const g of d.goals) {
          if (typeof g !== 'string' && g.description) {
            goalDescs[g.title] = g.description
          }
        }
      }

      const occupation = d.occupation || state.occupation
      const isStudent = studentKeywords.some(kw => occupation.toLowerCase().includes(kw))

      return {
        ...state,
        fullName: d.fullName || state.fullName,
        preferredName: d.preferredName || state.preferredName,
        birthday: d.birthday || state.birthday,
        gender: d.gender || state.gender,
        selectedCalendars: d.selectedCalendars && d.selectedCalendars.length > 0 ? d.selectedCalendars : state.selectedCalendars,
        otherCalendar: d.otherCalendar || state.otherCalendar,
        occupation,
        isStudent,
        fieldOfStudy: d.fieldOfStudy || state.fieldOfStudy,
        aspects: aspectNames,
        aspectDescriptions: { ...state.aspectDescriptions, ...aspectDescs },
        goals: goalTitles,
        goalDescriptions: { ...state.goalDescriptions, ...goalDescs },
        habits: d.habits && d.habits.length > 0 ? d.habits : state.habits,
        timezone: d.timezone || state.timezone,
      }
    }

    case 'RESET':
      return initialState

    default:
      return state
  }
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(onboardingReducer, initialState)

  const updateField = useCallback(<K extends keyof OnboardingState>(field: K, value: OnboardingState[K]) => {
    dispatch({ type: 'SET_FIELD', field, value })
  }, [])

  const nextSection = useCallback(() => {
    dispatch({ type: 'NEXT_SECTION' })
  }, [])

  const prevSection = useCallback(() => {
    dispatch({ type: 'PREV_SECTION' })
  }, [])

  const canProceedSection1 = useCallback(() => {
    return (
      state.fullName.trim().length > 0 &&
      state.birthday.length > 0 &&
      state.gender.length > 0
    )
  }, [state.fullName, state.birthday, state.gender])

  const canProceedSection2 = useCallback(() => {
    // Section 2 is always valid - user can skip calendar import
    return true
  }, [])

  const canProceedSection3 = useCallback(() => {
    return (
      state.occupation.trim().length > 0 &&
      state.aspects.length > 0 &&
      state.goals.length > 0
    )
  }, [state.occupation, state.aspects.length, state.goals.length])

  const addGoal = useCallback(() => {
    if (state.currentGoal.trim()) {
      dispatch({ type: 'ADD_GOAL', goal: state.currentGoal })
    }
  }, [state.currentGoal])

  const removeGoal = useCallback((index: number) => {
    dispatch({ type: 'REMOVE_GOAL', index })
  }, [])

  const addAspect = useCallback(() => {
    if (state.customAspect.trim()) {
      dispatch({ type: 'ADD_ASPECT', aspect: state.customAspect })
    }
  }, [state.customAspect])

  const removeAspect = useCallback((aspect: string) => {
    dispatch({ type: 'REMOVE_ASPECT', aspect })
  }, [])

  const toggleHabit = useCallback((habitId: string) => {
    dispatch({ type: 'TOGGLE_HABIT', habitId })
  }, [])

  const toggleCalendar = useCallback((calendarId: string) => {
    dispatch({ type: 'TOGGLE_CALENDAR', calendarId })
  }, [])

  return (
    <OnboardingContext.Provider value={{
      state,
      dispatch,
      updateField,
      nextSection,
      prevSection,
      canProceedSection1,
      canProceedSection2,
      canProceedSection3,
      addGoal,
      removeGoal,
      addAspect,
      removeAspect,
      toggleHabit,
      toggleCalendar
    }}>
      {children}
    </OnboardingContext.Provider>
  )
}

export function useOnboarding() {
  const context = useContext(OnboardingContext)
  if (context === undefined) {
    throw new Error('useOnboarding must be used within an OnboardingProvider')
  }
  return context
}
