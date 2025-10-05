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
  const { user } = useAuth()
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
      const { categories: data, error: fetchError } = await fetchUserCategories(user)

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

  const getCategoryColor = (nameOrId: string): string => {
    // Try by ID first
    let category = getCategoryById(nameOrId)

    // Fallback to name
    if (!category) {
      category = getCategoryByName(nameOrId)
    }

    // Return color or default gray
    return category?.color || '#6b7280'
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
