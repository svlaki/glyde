import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useAuth } from './authContext'
import { fetchUserAspects } from './aspectService'
import type { Aspect } from './aspectService'

interface AspectContextType {
  aspects: Aspect[]
  loading: boolean
  error: string | null
  refreshAspects: () => Promise<void>
  getAspectById: (id: string) => Aspect | undefined
  getAspectByName: (name: string) => Aspect | undefined
  getAspectColor: (nameOrId: string) => string
}

const AspectContext = createContext<AspectContextType | undefined>(undefined)

export function AspectProvider({ children }: { children: ReactNode }) {
  const { user, session } = useAuth()
  const [aspects, setAspects] = useState<Aspect[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadAspects = async () => {
    if (!user) {
      setAspects([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const { aspects: data, error: fetchError } = await fetchUserAspects(user, session?.access_token)

      if (fetchError) {
        setError(fetchError)
        setAspects([])
      } else {
        setAspects(data)
        setError(null)
      }
    } catch (err) {
      console.error('Failed to load aspects:', err)
      setError('Failed to load aspects')
      setAspects([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAspects()
  }, [user?.id])

  const getAspectById = (id: string): Aspect | undefined => {
    return aspects.find(a => a.id === id)
  }

  const getAspectByName = (name: string): Aspect | undefined => {
    return aspects.find(a => a.name === name)
  }

  // Custom Color Palette - Replace these with your favorite 30 colors!
  const colorPalette = [
    '#3b82f6', // Blue
    '#10b981', // Green
    '#ef4444', // Red
    '#f59e0b', // Orange
    '#8b5cf6', // Purple
    '#06b6d4', // Cyan
    '#ec4899', // Pink
    '#14b8a6', // Teal
    '#84cc16', // Lime
    '#6366f1', // Indigo
    '#f97316', // Orange-red
    '#a855f7', // Light Purple
    '#22c55e', // Light Green
    '#0ea5e9', // Sky Blue
    '#4f46e5', // Dark Indigo
    '#f43f5e', // Rose
    '#d946ef', // Fuchsia
    '#0891b2', // Dark Cyan
    '#16a34a', // Dark Green
    '#ea580c', // Dark Orange
    '#7c3aed', // Violet
    '#db2777', // Dark Pink
    '#059669', // Emerald
    '#2563eb', // Royal Blue
    '#dc2626', // Crimson
    '#ca8a04', // Yellow
    '#7c2d12', // Brown
    '#4338ca', // Deep Indigo
    '#be123c', // Dark Rose
    '#6b7280'  // Gray (fallback)
  ]

  // Simple hash function to consistently assign colors
  const hashString = (str: string): number => {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }
    return Math.abs(hash)
  }

  const getAspectColor = (nameOrId: string): string => {
    // Try by ID first
    let aspect = getAspectById(nameOrId)

    // Fallback to name
    if (!aspect) {
      aspect = getAspectByName(nameOrId)
    }

    // If aspect found in database, use its color
    if (aspect?.color) {
      return aspect.color
    }

    // Otherwise, assign a color from the palette using hash
    // This ensures the same aspect name always gets the same color
    const hash = hashString(nameOrId?.toLowerCase() || 'default')
    const colorIndex = hash % (colorPalette.length - 1) // Exclude last (gray) for hashing
    return colorPalette[colorIndex]
  }

  const value: AspectContextType = {
    aspects,
    loading,
    error,
    refreshAspects: loadAspects,
    getAspectById,
    getAspectByName,
    getAspectColor
  }

  return (
    <AspectContext.Provider value={value}>
      {children}
    </AspectContext.Provider>
  )
}

export function useAspects(): AspectContextType {
  const context = useContext(AspectContext)
  if (context === undefined) {
    throw new Error('useAspects must be used within an AspectProvider')
  }
  return context
}

// Re-export for backward compatibility during migration
export type { Aspect } from './aspectService'
