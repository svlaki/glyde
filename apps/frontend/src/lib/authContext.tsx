import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from './supabase'
import type { User, Session } from '@supabase/supabase-js'

const AGENT_SERVICE_URL = import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000'

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
  
  // Helper function to call the user schema creation endpoint
  async function callUserSchemaCreation(session: Session) {
    try {
      if (!session?.user?.id || !session?.access_token) {
        console.warn('Invalid session data for schema creation')
        return
      }

      const res = await fetch(`${AGENT_SERVICE_URL}/api/user/create-schema`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          user_id: session.user.id, 
          user_email: session.user.email 
        })
      })
      
      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`HTTP ${res.status}: ${errorText}`)
      }
      
      const data = await res.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to create user schema')
      }
      
      console.log('✅ User schema created successfully')
    } catch (err) {
      console.error('❌ User schema creation error:', err)
      // Don't throw - this shouldn't block the auth flow
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