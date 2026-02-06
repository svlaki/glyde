// DEPRECATED: This file is maintained for backward compatibility only.
// Please use aspectContext.tsx instead.
// All category references should be migrated to aspect references.

import { AspectProvider, useAspects } from './aspectContext'
import type { Aspect } from './aspectContext'

// Re-export for backward compatibility
export type Category = Aspect

export const CategoryProvider = AspectProvider

export function useCategories() {
  const aspectContext = useAspects()
  return {
    categories: aspectContext.aspects,
    loading: aspectContext.loading,
    error: aspectContext.error,
    refreshCategories: aspectContext.refreshAspects,
    getCategoryById: aspectContext.getAspectById,
    getCategoryByName: aspectContext.getAspectByName,
    getCategoryColor: aspectContext.getAspectColor
  }
}
