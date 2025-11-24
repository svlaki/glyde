import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useAuth } from './authContext'
import { fetchUserCategories, Category } from './categoryService'

interface CategoryContextType {
  categories: Category[]
  loading: boolean
  error: string | null
  refreshCategories: () => Promise<void>
  getCategoryById: (id: string) => Category | undefined
  getCategoryByName: (name: string) => Category | undefined
  getCategoryColor: (nameOrId: string) => string
}

const CategoryContext = createContext<CategoryContextType | undefined>(undefined)

export function CategoryProvider({ children }: { children: ReactNode }) {
  const { user, session } = useAuth()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadCategories = async () => {
    if (!user) {
      setCategories([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const { categories: data, error: fetchError } = await fetchUserCategories(user, session?.access_token)

      if (fetchError) {
        setError(fetchError)
        setCategories([])
      } else {
        setCategories(data)
        setError(null)
      }
    } catch (err) {
      console.error('Failed to load categories:', err)
      setError('Failed to load categories')
      setCategories([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCategories()
  }, [user?.id])

  const getCategoryById = (id: string): Category | undefined => {
    return categories.find(c => c.id === id)
  }

  const getCategoryByName = (name: string): Category | undefined => {
    return categories.find(c => c.name === name)
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

  const getCategoryColor = (nameOrId: string): string => {
    // Try by ID first
    let category = getCategoryById(nameOrId)

    // Fallback to name
    if (!category) {
      category = getCategoryByName(nameOrId)
    }

    // If category found in database, use its color
    if (category?.color) {
      return category.color
    }

    // Otherwise, assign a color from the palette using hash
    // This ensures the same category name always gets the same color
    const hash = hashString(nameOrId?.toLowerCase() || 'default')
    const colorIndex = hash % (colorPalette.length - 1) // Exclude last (gray) for hashing
    return colorPalette[colorIndex]
  }

  const value: CategoryContextType = {
    categories,
    loading,
    error,
    refreshCategories: loadCategories,
    getCategoryById,
    getCategoryByName,
    getCategoryColor
  }

  return (
    <CategoryContext.Provider value={value}>
      {children}
    </CategoryContext.Provider>
  )
}

export function useCategories(): CategoryContextType {
  const context = useContext(CategoryContext)
  if (context === undefined) {
    throw new Error('useCategories must be used within a CategoryProvider')
  }
  return context
}
