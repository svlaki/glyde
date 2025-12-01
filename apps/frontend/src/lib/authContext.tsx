import React, { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react'
import { supabase } from './supabase'
import type { User, Session } from '@supabase/supabase-js'

const AGENT_SERVICE_URL = import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000'

interface AuthContextValue {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  loading: boolean
  session: Session | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const startupTriggeredRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    // Check for existing session on mount
    async function getInitialSession() {
      try {
        setIsLoading(true)
        const result = await supabase.auth.getSession()
        
        if (result.data?.session) {
          setSession(result.data.session)
          setUser(result.data.session.user)
          setIsAuthenticated(true)
          
          // Call user schema creation with the initial session
          await callUserSchemaCreation(result.data.session)
        } else {
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
      async (event, session) => {
        try {
          setSession(session)
          setUser(session?.user ?? null)
          setIsAuthenticated(!!session?.user)
          
          if (session?.user && session.access_token) {
            await callUserSchemaCreation(session)
          }
        } catch (error) {
          console.error('Error in auth state change:', error)
        }
      }
    )
    
    return () => {
      subscription.unsubscribe()
    }
  }, [])
  
  // Trigger startup interactions when user authenticates or app opens
  async function callUserSchemaCreation(session: Session) {
    // User schemas are deprecated in favor of public tables with RLS
    console.log('User authenticated - using public tables with RLS');

    // Deduplicate: only trigger startup once per session
    if (startupTriggeredRef.current.has(session.user.id)) {
      console.log('ℹ️ Session already initialized for this user');
      return;
    }
    startupTriggeredRef.current.add(session.user.id);

    // Interactions are now created directly by the agent via create_interaction tool
    // They can be generated on-demand via the refresh button in the UI
    console.log('✅ Ready to generate interactions on-demand');
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signUp(email: string, password: string) {
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
  }

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/calendar`
      }
    })
    if (error) throw error
  }

  async function signOut() {
    try {
      await supabase.auth.signOut()
      setUser(null)
      setSession(null)
      setIsAuthenticated(false)
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }

  const value: AuthContextValue = {
    user,
    isAuthenticated,
    isLoading,
    loading: isLoading,
    session,
    signIn,
    signUp,
    signInWithGoogle,
    signOut
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
} 