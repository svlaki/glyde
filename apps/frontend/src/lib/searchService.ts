// Unified search service for events, tasks, and goals

import { User } from '@supabase/supabase-js'
import { fetchExpandedEvents, CalendarEvent } from './calendarService'
import { fetchUserTasks, Task } from './taskService'
import { fetchUserGoals, Goal } from './goalService'

export type SearchResultType = 'event' | 'task' | 'goal'

export interface SearchResult {
  id: string
  type: SearchResultType
  title: string
  description?: string
  date?: string
  endDate?: string
  category?: string
  categoryColor?: string
  status?: string
  priority?: string
  preview: string
  relevanceScore: number
  originalData: CalendarEvent | Task | Goal
}

export interface SearchOptions {
  types?: SearchResultType[]
  dateRange?: { start: Date; end: Date }
  categories?: string[]
  limit?: number
  includeCompleted?: boolean
}

// Calculate relevance score based on query match
function calculateRelevance(query: string, title: string, description?: string): number {
  const lowerQuery = query.toLowerCase()
  const lowerTitle = title.toLowerCase()
  const lowerDesc = (description || '').toLowerCase()

  let score = 0

  // Exact title match
  if (lowerTitle === lowerQuery) {
    score += 100
  }
  // Title starts with query
  else if (lowerTitle.startsWith(lowerQuery)) {
    score += 80
  }
  // Title contains query as word
  else if (lowerTitle.includes(` ${lowerQuery}`) || lowerTitle.includes(`${lowerQuery} `)) {
    score += 60
  }
  // Title contains query
  else if (lowerTitle.includes(lowerQuery)) {
    score += 40
  }
  // Description contains query
  else if (lowerDesc.includes(lowerQuery)) {
    score += 20
  }

  // Boost for each word match
  const queryWords = lowerQuery.split(/\s+/)
  for (const word of queryWords) {
    if (word.length > 2) {
      if (lowerTitle.includes(word)) score += 10
      if (lowerDesc.includes(word)) score += 5
    }
  }

  return score
}

// Convert event to search result
function eventToSearchResult(event: CalendarEvent, query: string): SearchResult {
  const startDate = new Date(event.start_time)
  const endDate = new Date(event.end_time)
  const dateStr = startDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  })
  const timeStr = startDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  })

  return {
    id: event.id,
    type: 'event',
    title: event.title,
    description: event.description,
    date: event.start_time,
    endDate: event.end_time,
    category: event.category_name || event.category,
    categoryColor: event.category_color || event.color,
    preview: `${dateStr} at ${timeStr}`,
    relevanceScore: calculateRelevance(query, event.title, event.description),
    originalData: event
  }
}

// Convert task to search result
function taskToSearchResult(task: Task, query: string): SearchResult {
  let preview = task.status || 'pending'
  if (task.due_date) {
    const dueDate = new Date(task.due_date)
    preview += ` - Due ${dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
  }
  if (task.priority && task.priority !== 'low') {
    preview += ` - ${task.priority}`
  }

  return {
    id: task.id,
    type: 'task',
    title: task.title,
    description: task.description,
    date: task.due_date,
    category: task.category_name || task.category,
    categoryColor: task.category_color || task.color,
    status: task.status,
    priority: task.priority,
    preview,
    relevanceScore: calculateRelevance(query, task.title, task.description),
    originalData: task
  }
}

// Convert goal to search result
function goalToSearchResult(goal: Goal, query: string): SearchResult {
  let preview = goal.status || 'not_started'
  if (goal.progress !== undefined) {
    preview += ` - ${goal.progress}% complete`
  }
  if (goal.target_date) {
    const targetDate = new Date(goal.target_date)
    preview += ` - Target ${targetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
  }

  return {
    id: goal.id,
    type: 'goal',
    title: goal.title,
    description: goal.description,
    date: goal.target_date,
    category: goal.category,
    status: goal.status,
    preview,
    relevanceScore: calculateRelevance(query, goal.title, goal.description),
    originalData: goal
  }
}

// Main search function
export async function searchAll(
  user: User,
  accessToken: string,
  query: string,
  options: SearchOptions = {}
): Promise<{ results: SearchResult[]; error: string | null }> {
  const {
    types = ['event', 'task', 'goal'],
    limit = 20,
    includeCompleted = false
  } = options

  if (!query || query.trim().length < 2) {
    return { results: [], error: null }
  }

  const trimmedQuery = query.trim()
  const results: SearchResult[] = []

  try {
    // Fetch data in parallel
    const promises: Promise<void>[] = []

    if (types.includes('event')) {
      promises.push(
        fetchExpandedEvents(user, accessToken).then(({ events }) => {
          if (events) {
            for (const event of events) {
              const result = eventToSearchResult(event, trimmedQuery)
              if (result.relevanceScore > 0) {
                results.push(result)
              }
            }
          }
        })
      )
    }

    if (types.includes('task')) {
      const filters = includeCompleted ? {} : { status: 'pending' }
      promises.push(
        fetchUserTasks(user, accessToken, filters).then(({ tasks }) => {
          if (tasks) {
            for (const task of tasks) {
              const result = taskToSearchResult(task, trimmedQuery)
              if (result.relevanceScore > 0) {
                results.push(result)
              }
            }
          }
        })
      )
    }

    if (types.includes('goal')) {
      const filters = includeCompleted ? {} : {}
      promises.push(
        fetchUserGoals(user, accessToken, filters).then(({ goals }) => {
          if (goals) {
            for (const goal of goals) {
              // Skip completed/abandoned goals if not including completed
              if (!includeCompleted && (goal.status === 'completed' || goal.status === 'abandoned')) {
                continue
              }
              const result = goalToSearchResult(goal, trimmedQuery)
              if (result.relevanceScore > 0) {
                results.push(result)
              }
            }
          }
        })
      )
    }

    await Promise.all(promises)

    // Sort by relevance score (descending)
    results.sort((a, b) => b.relevanceScore - a.relevanceScore)

    // Limit results
    const limitedResults = results.slice(0, limit)

    return { results: limitedResults, error: null }
  } catch (error) {
    console.error('Search error:', error)
    return { results: [], error: 'Search failed' }
  }
}

// Get type icon for display
export function getTypeIcon(type: SearchResultType): string {
  switch (type) {
    case 'event':
      return '📅'
    case 'task':
      return '✓'
    case 'goal':
      return '🎯'
    default:
      return '•'
  }
}

// Get type label for display
export function getTypeLabel(type: SearchResultType): string {
  switch (type) {
    case 'event':
      return 'Event'
    case 'task':
      return 'Task'
    case 'goal':
      return 'Goal'
    default:
      return 'Item'
  }
}
