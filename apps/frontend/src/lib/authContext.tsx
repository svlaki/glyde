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
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
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
          
          // Call user schema creation with the initial session
          await callUserSchemaCreation(session)
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
          await callUserSchemaCreation(session)
        } else {
          console.log('Session missing user or access_token, not calling user schema creation.')
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

  const value: AuthContextValue = { user, isAuthenticated, isLoading, session }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
} 