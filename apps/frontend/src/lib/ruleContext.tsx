import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'
import { useAuth } from './authContext'
import {
  Rule,
  CreateRuleInput,
  UpdateRuleInput,
  fetchUserRules,
  createRule as createRuleApi,
  updateRule as updateRuleApi,
  deleteRule as deleteRuleApi,
  toggleRule as toggleRuleApi
} from './ruleService'

interface RuleContextValue {
  rules: Rule[]
  isLoading: boolean
  error: string | null
  refreshRules: () => Promise<void>
  createRule: (input: CreateRuleInput) => Promise<{ success: boolean; error?: string }>
  updateRule: (ruleId: string, updates: UpdateRuleInput) => Promise<{ success: boolean; error?: string }>
  deleteRule: (ruleId: string) => Promise<{ success: boolean; error?: string }>
  toggleRule: (ruleId: string, enabled: boolean) => Promise<{ success: boolean; error?: string }>
}

const RuleContext = createContext<RuleContextValue | undefined>(undefined)

export function RuleProvider({ children }: { children: ReactNode }) {
  const { user, session } = useAuth()
  const [rules, setRules] = useState<Rule[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refreshRules = useCallback(async () => {
    if (!user) {
      setRules([])
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const { rules: fetchedRules, error: fetchError } = await fetchUserRules(
        user,
        session?.access_token
      )

      if (fetchError) {
        setError(fetchError)
        setRules([])
      } else {
        setRules(fetchedRules)
      }
    } catch (err) {
      setError('Failed to load rules')
      setRules([])
    } finally {
      setIsLoading(false)
    }
  }, [user, session])

  // Load rules when user changes
  useEffect(() => {
    if (user) {
      refreshRules()
    } else {
      setRules([])
      setError(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const createRule = useCallback(async (input: CreateRuleInput) => {
    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    const { rule, error: createError } = await createRuleApi(
      user,
      input,
      session?.access_token
    )

    if (createError || !rule) {
      return { success: false, error: createError || 'Failed to create rule' }
    }

    // Add the new rule to state
    setRules(prev => [rule, ...prev])
    return { success: true }
  }, [user, session])

  const updateRule = useCallback(async (ruleId: string, updates: UpdateRuleInput) => {
    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    const { rule, error: updateError } = await updateRuleApi(
      user,
      ruleId,
      updates,
      session?.access_token
    )

    if (updateError || !rule) {
      return { success: false, error: updateError || 'Failed to update rule' }
    }

    // Update the rule in state
    setRules(prev => prev.map(r => r.id === ruleId ? rule : r))
    return { success: true }
  }, [user, session])

  const deleteRule = useCallback(async (ruleId: string) => {
    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    const { success, error: deleteError } = await deleteRuleApi(
      user,
      ruleId,
      session?.access_token
    )

    if (!success) {
      return { success: false, error: deleteError || 'Failed to delete rule' }
    }

    // Remove the rule from state
    setRules(prev => prev.filter(r => r.id !== ruleId))
    return { success: true }
  }, [user, session])

  const toggleRule = useCallback(async (ruleId: string, enabled: boolean) => {
    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    const { rule, error: toggleError } = await toggleRuleApi(
      user,
      ruleId,
      enabled,
      session?.access_token
    )

    if (toggleError || !rule) {
      return { success: false, error: toggleError || 'Failed to toggle rule' }
    }

    // Update the rule in state
    setRules(prev => prev.map(r => r.id === ruleId ? rule : r))
    return { success: true }
  }, [user, session])

  return (
    <RuleContext.Provider value={{
      rules,
      isLoading,
      error,
      refreshRules,
      createRule,
      updateRule,
      deleteRule,
      toggleRule
    }}>
      {children}
    </RuleContext.Provider>
  )
}

export function useRules() {
  const context = useContext(RuleContext)
  if (!context) {
    throw new Error('useRules must be used within a RuleProvider')
  }
  return context
}
