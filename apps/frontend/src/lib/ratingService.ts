import type { User } from '@supabase/supabase-js'

export interface Rating {
  id: string
  user_id: string
  topic: string
  score: number
  description?: string
  aspect_id?: string
  notes?: string
  created_at: string
}

export interface RatingSummary {
  topic: string
  description?: string
  latestScore: number
  previousScore?: number
  trend: number
  totalEntries: number
  lastAsked: string
  aspectId?: string
}

const API_URL = import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000'

export async function fetchRatingSummary(
  user: User,
  accessToken: string
): Promise<{ summary: RatingSummary[], error: string | null }> {
  try {
    if (!user || !accessToken) {
      return { summary: [], error: 'User not authenticated' }
    }

    const response = await fetch(`${API_URL}/api/ratings/summary`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({ user_id: user.id }),
    })

    const data = await response.json()

    if (!response.ok) {
      return { summary: [], error: data.error || 'Failed to fetch summary' }
    }

    return { summary: data.summary || [], error: null }
  } catch (error) {
    return { summary: [], error: 'Failed to fetch rating summary' }
  }
}

export async function fetchUserRatings(
  user: User,
  accessToken: string,
  topic?: string
): Promise<{ ratings: Rating[], error: string | null }> {
  try {
    if (!user || !accessToken) {
      return { ratings: [], error: 'User not authenticated' }
    }

    const response = await fetch(`${API_URL}/api/ratings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({ user_id: user.id, topic }),
    })

    const data = await response.json()

    if (!response.ok) {
      return { ratings: [], error: data.error || 'Failed to fetch ratings' }
    }

    return { ratings: data.ratings || [], error: null }
  } catch (error) {
    return { ratings: [], error: 'Failed to fetch ratings' }
  }
}

export async function createUserRating(
  user: User,
  accessToken: string,
  ratingData: {
    topic: string
    score: number
    description?: string
    aspect_id?: string
    notes?: string
  }
): Promise<{ rating: Rating | null, error: string | null }> {
  try {
    if (!user || !accessToken) {
      return { rating: null, error: 'User not authenticated' }
    }

    const response = await fetch(`${API_URL}/api/ratings/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({ user_id: user.id, ...ratingData }),
    })

    const data = await response.json()

    if (!response.ok) {
      return { rating: null, error: data.error || 'Failed to create rating' }
    }

    return { rating: data.rating, error: null }
  } catch (error) {
    return { rating: null, error: 'Failed to create rating' }
  }
}
