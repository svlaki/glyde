import { User } from '@supabase/supabase-js'

export interface Category {
  id: string
  user_id: string
  name: string
  color: string
  icon?: string
  description?: string
  context?: Record<string, any>
  created_at?: string
  updated_at?: string
}

const API_URL = import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000'

export async function fetchUserCategories(
  user: User
): Promise<{ categories: Category[], error: string | null }> {
  try {
    if (!user) {
      return { categories: [], error: 'User not authenticated' }
    }

    const response = await fetch(`${API_URL}/api/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: user.id
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return { categories: [], error: data.error || 'Failed to fetch categories' }
    }

    return { categories: data.categories || [], error: null }
  } catch (error) {
    console.error('Error fetching categories:', error)
    return { categories: [], error: 'Failed to fetch categories' }
  }
}

export async function createUserCategory(
  user: User,
  categoryData: {
    name: string
    color: string
    icon?: string
    description?: string
    context?: Record<string, any>
  }
): Promise<{ category: Category | null, error: string | null }> {
  try {
    if (!user) {
      return { category: null, error: 'User not authenticated' }
    }

    if (!categoryData.name || !categoryData.color) {
      return { category: null, error: 'Name and color are required' }
    }

    const response = await fetch(`${API_URL}/api/categories/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: user.id,
        ...categoryData
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return { category: null, error: data.error || 'Failed to create category' }
    }

    return { category: data.category, error: null }
  } catch (error) {
    console.error('Error creating category:', error)
    return { category: null, error: 'Failed to create category' }
  }
}

export async function updateUserCategory(
  user: User,
  categoryId: string,
  updates: Partial<Category>
): Promise<{ category: Category | null, error: string | null }> {
  try {
    if (!user) {
      return { category: null, error: 'User not authenticated' }
    }

    const response = await fetch(`${API_URL}/api/categories/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: user.id,
        category_id: categoryId,
        ...updates
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return { category: null, error: data.error || 'Failed to update category' }
    }

    return { category: data.category, error: null }
  } catch (error) {
    console.error('Error updating category:', error)
    return { category: null, error: 'Failed to update category' }
  }
}

export async function deleteUserCategory(
  user: User,
  categoryId: string
): Promise<{ success: boolean, message?: string, error: string | null }> {
  try {
    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    const response = await fetch(`${API_URL}/api/categories/delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: user.id,
        category_id: categoryId
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return { success: false, error: data.error || 'Failed to delete category' }
    }

    return {
      success: data.success,
      message: data.message,
      error: null
    }
  } catch (error) {
    console.error('Error deleting category:', error)
    return { success: false, error: 'Failed to delete category' }
  }
}

export async function getCategoryColor(
  user: User,
  categoryName: string
): Promise<{ color: string | null, error: string | null }> {
  try {
    if (!user) {
      return { color: null, error: 'User not authenticated' }
    }

    if (!categoryName) {
      return { color: null, error: 'Category name is required' }
    }

    const response = await fetch(`${API_URL}/api/categories/color`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: user.id,
        category_name: categoryName
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return { color: null, error: data.error || 'Failed to fetch category color' }
    }

    return { color: data.color, error: null }
  } catch (error) {
    console.error('Error fetching category color:', error)
    return { color: null, error: 'Failed to fetch category color' }
  }
}
