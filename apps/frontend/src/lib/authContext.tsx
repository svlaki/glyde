import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from './supabase'
import type { User, Session } from '@supabase/supabase-js'

interface AuthContextValue {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  session: Session | null
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check for existing session on mount
    async function getInitialSession() {
      try {
        console.log('🔍 [AUTH CONTEXT] Starting initial session check...')
        console.log('  - Supabase client:', supabase)
        console.log('  - Supabase auth:', supabase.auth)
        
        setIsLoading(true)
        const result = await supabase.auth.getSession()
        console.log('🔍 [AUTH CONTEXT] getSession result:', result)
        console.log('  - Data:', result.data)
        console.log('  - Session:', result.data?.session)
        console.log('  - Error:', result.error)
        
        if (result.data?.session) {
          console.log('✅ [AUTH CONTEXT] Initial session found:', result.data.session)
          console.log('  - User:', result.data.session.user)
          console.log('  - Access token:', result.data.session.access_token ? 'Present' : 'Missing')
          setSession(result.data.session)
          setUser(result.data.session.user)
          setIsAuthenticated(true)
          
          // Call user schema creation with the initial session
          await callUserSchemaCreation(result.data.session)
        } else {
          console.log('ℹ️ [AUTH CONTEXT] No initial session found')
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
    console.log('🔄 [AUTH CONTEXT] Setting up auth state change listener...')
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 [AUTH CONTEXT] onAuthStateChange fired')
        console.log('  - Event:', event)
        console.log('  - Session:', session)
        console.log('  - User:', session?.user)
        console.log('  - Access token:', session?.access_token ? 'Present' : 'Missing')
        
        setSession(session)
        setUser(session?.user ?? null)
        setIsAuthenticated(!!session?.user)
        
        if (session?.user && session.access_token) {
          console.log('✅ [AUTH CONTEXT] Valid session found, calling user schema creation...')
          await callUserSchemaCreation(session)
        } else {
          console.log('ℹ️ [AUTH CONTEXT] Session missing user or access_token, not calling user schema creation.')
          console.log('  - Has user:', !!session?.user)
          console.log('  - Has access_token:', !!session?.access_token)
        }
      }
    )
    console.log('✅ [AUTH CONTEXT] Auth state change listener set up successfully')
    
    return () => {
      subscription.unsubscribe()
    }
  }, [])
  
  // Helper function to call the user schema creation endpoint
  async function callUserSchemaCreation(session: Session) {
    try {
      console.log('About to call user schema creation with user:', session.user, 'token:', session.access_token)
      const res = await fetch('http://localhost:8000/api/user/create-schema', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ user_id: session.user.id, user_email: session.user.email })
      })
      
      console.log('User schema creation response status:', res.status)
      const data = await res.json()
      console.log('User schema creation response body:', data)
      
      if (!res.ok) throw new Error(data.error || 'Failed to create user schema')
    } catch (err) {
      console.error('User schema creation error:', err)
    }
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

  const value: AuthContextValue = { user, isAuthenticated, isLoading, session, signOut }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
} 