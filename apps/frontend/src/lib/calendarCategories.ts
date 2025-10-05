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

export function getCategoryColor(category?: string, fallback: string = '#6B7280'): string {
  if (!category) {
    return fallback;
  }

  return CATEGORY_COLORS[category] ?? fallback;
}
