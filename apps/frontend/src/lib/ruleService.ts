import { User } from '@supabase/supabase-js'

export interface Rule {
  id: string
  user_id: string
  rule_text: string
  description?: string
  enabled: boolean
  priority: number
  source: 'manual' | 'agent'
  created_at: string
  updated_at: string
}

export interface CreateRuleInput {
  rule_text: string
  description?: string
  priority?: number
}

export interface UpdateRuleInput {
  rule_text?: string
  description?: string
  priority?: number
  enabled?: boolean
}

const getApiUrl = () => import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000'

/**
 * Fetch all rules for the authenticated user
 */
export async function fetchUserRules(
  user: User,
  accessToken?: string
): Promise<{ rules: Rule[], error: string | null }> {
  try {
    if (!user) {
      console.error('[ruleService] No user provided')
      return { rules: [], error: 'User not authenticated' }
    }

    const url = `${getApiUrl()}/api/rules`

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    }

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ user_id: user.id }),
      cache: 'no-store'
    })

    if (!response.ok) {
      console.error('[ruleService] Failed to fetch rules:', response.status)
      return { rules: [], error: 'Failed to fetch rules from backend' }
    }

    const data = await response.json()

    if (data.success) {
      return { rules: data.rules || [], error: null }
    } else {
      return { rules: [], error: data.error || 'Unknown error' }
    }
  } catch (err: any) {
    console.error('[ruleService] Exception in fetchUserRules:', err)
    return { rules: [], error: err.message || 'An unexpected error occurred' }
  }
}

/**
 * Create a new rule
 */
export async function createRule(
  user: User,
  input: CreateRuleInput,
  accessToken?: string
): Promise<{ rule: Rule | null, error: string | null }> {
  try {
    if (!user) {
      return { rule: null, error: 'User not authenticated' }
    }

    if (!input.rule_text?.trim()) {
      return { rule: null, error: 'Rule text is required' }
    }

    const url = `${getApiUrl()}/api/rules/create`

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        user_id: user.id,
        rule_text: input.rule_text.trim(),
        description: input.description?.trim() || undefined,
        priority: input.priority || 5,
        source: 'manual'
      })
    })

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      return { rule: null, error: data.error || 'Failed to create rule' }
    }

    const data = await response.json()

    if (data.success) {
      return { rule: data.rule, error: null }
    } else {
      return { rule: null, error: data.error || 'Unknown error' }
    }
  } catch (err: any) {
    console.error('[ruleService] Exception in createRule:', err)
    return { rule: null, error: err.message || 'An unexpected error occurred' }
  }
}

/**
 * Update an existing rule
 */
export async function updateRule(
  user: User,
  ruleId: string,
  updates: UpdateRuleInput,
  accessToken?: string
): Promise<{ rule: Rule | null, error: string | null }> {
  try {
    if (!user) {
      return { rule: null, error: 'User not authenticated' }
    }

    const url = `${getApiUrl()}/api/rules/update`

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        user_id: user.id,
        rule_id: ruleId,
        ...updates
      })
    })

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      return { rule: null, error: data.error || 'Failed to update rule' }
    }

    const data = await response.json()

    if (data.success) {
      return { rule: data.rule, error: null }
    } else {
      return { rule: null, error: data.error || 'Unknown error' }
    }
  } catch (err: any) {
    console.error('[ruleService] Exception in updateRule:', err)
    return { rule: null, error: err.message || 'An unexpected error occurred' }
  }
}

/**
 * Delete a rule
 */
export async function deleteRule(
  user: User,
  ruleId: string,
  accessToken?: string
): Promise<{ success: boolean, error: string | null }> {
  try {
    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    const url = `${getApiUrl()}/api/rules/delete`

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        user_id: user.id,
        rule_id: ruleId
      })
    })

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      return { success: false, error: data.error || 'Failed to delete rule' }
    }

    const data = await response.json()

    if (data.success) {
      return { success: true, error: null }
    } else {
      return { success: false, error: data.error || 'Unknown error' }
    }
  } catch (err: any) {
    console.error('[ruleService] Exception in deleteRule:', err)
    return { success: false, error: err.message || 'An unexpected error occurred' }
  }
}

/**
 * Toggle a rule's enabled status
 */
export async function toggleRule(
  user: User,
  ruleId: string,
  enabled: boolean,
  accessToken?: string
): Promise<{ rule: Rule | null, error: string | null }> {
  try {
    if (!user) {
      return { rule: null, error: 'User not authenticated' }
    }

    const url = `${getApiUrl()}/api/rules/toggle`

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        user_id: user.id,
        rule_id: ruleId,
        enabled
      })
    })

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      return { rule: null, error: data.error || 'Failed to toggle rule' }
    }

    const data = await response.json()

    if (data.success) {
      return { rule: data.rule, error: null }
    } else {
      return { rule: null, error: data.error || 'Unknown error' }
    }
  } catch (err: any) {
    console.error('[ruleService] Exception in toggleRule:', err)
    return { rule: null, error: err.message || 'An unexpected error occurred' }
  }
}
