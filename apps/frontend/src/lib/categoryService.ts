import { User } from '@supabase/supabase-js'
import { post } from './apiClient'

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

export async function fetchUserCategories(
  user: User
): Promise<{ categories: Category[], error: string | null }> {
  try {
    if (!user) {
      return { categories: [], error: 'User not authenticated' }
    }

    const response = await post<{ categories?: Category[]; error?: string }>(
      '/api/categories',
      { user_id: user.id }
    )

    if (!response.ok) {
      return { categories: [], error: response.error || 'Failed to fetch categories' }
    }

    const categories = Array.isArray(response.data?.categories) ? response.data!.categories : []
    return { categories, error: null }
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

    const response = await post<{ category?: Category; error?: string }>(
      '/api/categories/create',
      {
        user_id: user.id,
        ...categoryData
      }
    )

    if (!response.ok) {
      return { category: null, error: response.error || 'Failed to create category' }
    }

    if (!response.data?.category) {
      return { category: null, error: 'Category payload missing from response' }
    }

    return { category: response.data.category, error: null }
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

    const response = await post<{ category?: Category; error?: string }>(
      '/api/categories/update',
      {
        user_id: user.id,
        category_id: categoryId,
        ...updates
      }
    )

    if (!response.ok) {
      return { category: null, error: response.error || 'Failed to update category' }
    }

    if (!response.data?.category) {
      return { category: null, error: 'Category payload missing from response' }
    }

    return { category: response.data.category, error: null }
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

    const response = await post<{ success: boolean; message?: string; error?: string }>(
      '/api/categories/delete',
      {
        user_id: user.id,
        category_id: categoryId
      }
    )

    if (!response.ok) {
      return { success: false, error: response.error || 'Failed to delete category' }
    }

    return {
      success: Boolean(response.data?.success),
      message: response.data?.message,
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

    const response = await post<{ color?: string; error?: string }>(
      '/api/categories/color',
      {
        user_id: user.id,
        category_name: categoryName
      }
    )

    if (!response.ok) {
      return { color: null, error: response.error || 'Failed to fetch category color' }
    }

    if (!response.data || typeof response.data.color !== 'string') {
      return { color: null, error: 'Category color missing from response' }
    }

    return { color: response.data.color, error: null }
  } catch (error) {
    console.error('Error fetching category color:', error)
    return { color: null, error: 'Failed to fetch category color' }
  }
}
