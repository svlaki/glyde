// DEPRECATED: This file is deprecated in favor of useAspects hook
// Use the AspectContext instead for dynamic aspect colors from the backend
// This file will be removed in a future update

/**
 * @deprecated Use useAspects() hook instead
 */
export const CATEGORY_COLORS: Record<string, string> = {
  'Work': '#3b82f6',
  'School': '#8b5cf6',
  'Health & Hygiene': '#ef4444',
  'Social': '#f97316',
  'Family': '#ec4899',
  'Personal': '#10b981',
  'Fitness': '#f59e0b',
  'Hobbies': '#06b6d4',
  'Finance': '#10b981',
  'Shopping': '#78716c',
  'Travel': '#6366f1',
  'Self-Care': '#ec4899'
};

/**
 * @deprecated Use useAspects().getAspectColor() instead
 */
export function getCategoryColor(category?: string, fallback: string = '#6B7280'): string {
  if (!category) {
    return fallback;
  }

  return CATEGORY_COLORS[category] ?? fallback;
}
