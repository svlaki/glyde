import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from './supabase'
import type { User, Session } from '@supabase/supabase-js'

interface AuthContextValue {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  session: Session | null
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  // DEV BYPASS: Skip authentication for UI development
  const DEV_BYPASS = true
  
  const [user, setUser] = useState<User | null>(DEV_BYPASS ? {
    id: 'dev-user-123',
    email: 'dev@example.com',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    aud: 'authenticated',
    role: 'authenticated',
    app_metadata: {},
    user_metadata: {}
  } as User : null)
  
  const [session, setSession] = useState<Session | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(DEV_BYPASS)
  const [isLoading, setIsLoading] = useState(DEV_BYPASS ? false : true)

  useEffect(() => {
    // Skip all auth logic if in dev bypass mode
    if (DEV_BYPASS) {
      return
    }
    
    // Check for existing session on mount
    async function getInitialSession() {
      try {
        setIsLoading(true)
        const { data: { session } } = await supabase.auth.getSession()
        
        if (session) {
          console.log('Initial session found:', session)
          setSession(session)
          setUser(session.user)
          setIsAuthenticated(true)
          
          // Call Edge Function with the initial session
          await callEdgeFunction(session)
        } else {
          console.log('No initial session found')
          setSession(null)
          setUser(null)
          setIsAuthenticated(false)
        }
      } catch (error) {
        console.error('Error getting initial session:', error)
      } finally {
        setIsLoading(false)
      }
    }
    
    getInitialSession()
    
    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        console.log('onAuthStateChange fired. Event:', _event, 'Session:', session)
        
        setSession(session)
        setUser(session?.user ?? null)
        setIsAuthenticated(!!session?.user)
        
        if (session?.user && session.access_token) {
          await callEdgeFunction(session)
        } else {
          console.log('Session missing user or access_token, not calling Edge Function.')
        }
      }
    )
    
    return () => {
      subscription.unsubscribe()
    }
  }, [])
  
  // Helper function to call the Edge Function
  async function callEdgeFunction(session: Session) {
    try {
      console.log('About to call Edge Function with user:', session.user, 'token:', session.access_token)
      const res = await fetch('https://furwuyjptohobrvyyzfy.functions.supabase.co/createUserSchema', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ user_id: session.user.id, user_email: session.user.email })
      })
      
      console.log('Edge Function response status:', res.status)
      const text = await res.text()
      console.log('Edge Function response body:', text)
      
      if (!res.ok) throw new Error(text)
    } catch (err) {
      console.error('Edge Function error:', err)
    }
  }

  const value: AuthContextValue = { user, isAuthenticated, isLoading, session }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
} 