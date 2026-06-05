import React, { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react'
import { supabase } from './supabase'
import type { User, Session } from '@supabase/supabase-js'
import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'

const AGENT_SERVICE_URL = import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000'

interface AuthContextValue {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  loading: boolean
  session: Session | null
  preferredName: string | null
  avatarUrl: string | null
  googleProviderToken: string | null
  updateAvatarUrl: (url: string) => void
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
  const [preferredName, setPreferredName] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [googleProviderToken, setGoogleProviderToken] = useState<string | null>(null)
  const startupTriggeredRef = useRef<Set<string>>(new Set())

  // Fetch user's preferred name from profile table
  async function fetchPreferredName(userId: string): Promise<string | null> {
    try {
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000))

      const fetchPromise = supabase
        .from('profile')
        .select('preferred_name, display_name, avatar_url')
        .eq('id', userId)
        .single()
        .then(({ data, error }) => {
          if (error) {
            console.error('Error fetching preferred name:', error)
            return null
          }
          if (data?.avatar_url) {
            setAvatarUrl(data.avatar_url)
          }
          return data?.preferred_name || data?.display_name || null
        })

      return await Promise.race([fetchPromise, timeoutPromise])
    } catch (error) {
      console.error('Error fetching preferred name:', error)
      return null
    }
  }

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

          // Fetch preferred name in background (don't block auth)
          fetchPreferredName(result.data.session.user.id).then(name => {
            setPreferredName(name)
          })

          // Call user schema creation with the initial session
          await callUserSchemaCreation(result.data.session)
        } else {
          setSession(null)
          setUser(null)
          setIsAuthenticated(false)
          setPreferredName(null)
          setAvatarUrl(null)
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

          // Capture Google provider token (only available right after OAuth redirect)
          if (session?.provider_token) {
            setGoogleProviderToken(session.provider_token)
          }

          if (session?.user && session.access_token) {
            // Fetch preferred name in background (don't block auth)
            fetchPreferredName(session.user.id).then(name => {
              setPreferredName(name)
            })

            await callUserSchemaCreation(session)
          } else {
            setPreferredName(null)
            setAvatarUrl(null)
          }
        } catch (error) {
          console.error('Error in auth state change:', error)
        }
      }
    )

    // Handle deep links for OAuth on mobile
    let appUrlListener: any = null
    if (Capacitor.isNativePlatform()) {
      appUrlListener = CapacitorApp.addListener('appUrlOpen', async ({ url }) => {
        // Handle Supabase OAuth callback
        if (url.includes('#access_token=') || url.includes('?access_token=')) {
          const params = new URLSearchParams(url.split('#')[1] || url.split('?')[1])
          const access_token = params.get('access_token')
          const refresh_token = params.get('refresh_token')

          if (access_token) {
            await supabase.auth.setSession({
              access_token,
              refresh_token: refresh_token || ''
            })
          }
        }
      })
    }

    // Handle deep links for OAuth on Electron
    if (window.electronAPI?.isElectron) {
      window.electronAPI.onOAuthCallback(async (params) => {
        const searchParams = new URLSearchParams(params)
        const access_token = searchParams.get('access_token')
        const refresh_token = searchParams.get('refresh_token')
        if (access_token) {
          await supabase.auth.setSession({
            access_token,
            refresh_token: refresh_token || ''
          })
        }
      })
    }

    return () => {
      subscription.unsubscribe()
      if (appUrlListener) {
        appUrlListener.remove()
      }
    }
  }, [])
  
  // Trigger startup interactions when user authenticates or app opens
  async function callUserSchemaCreation(session: Session) {
    // User schemas are deprecated in favor of public tables with RLS

    // Deduplicate: only trigger startup once per session
    if (startupTriggeredRef.current.has(session.user.id)) {
      return;
    }
    startupTriggeredRef.current.add(session.user.id);

    // Interactions are now created directly by the agent via create_interaction tool
    // They can be generated on-demand via the refresh button in the UI
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
    try {
      const isNative = Capacitor.isNativePlatform()
      const isElectron = !!window.electronAPI?.isElectron

      let redirectTo: string
      if (isNative || isElectron) {
        redirectTo = 'com.svlaki.glyde://oauth-callback'
      } else {
        redirectTo = `${window.location.origin}/calendar`
      }

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: isNative || isElectron
        }
      })

      if (error) throw error

      // On mobile, open the OAuth URL in the system browser
      if (isNative && data?.url) {
        window.location.href = data.url
      }

      // On Electron, open OAuth URL via window.open (routed to system browser by setWindowOpenHandler)
      if (isElectron && data?.url) {
        window.open(data.url)
      }
    } catch (error) {
      console.error('Google sign in error:', error)
      throw error
    }
  }

  async function signOut() {
    try {
      // Sign out from Supabase
      await supabase.auth.signOut()

      setUser(null)
      setSession(null)
      setIsAuthenticated(false)
      setPreferredName(null)
      setAvatarUrl(null)
      startupTriggeredRef.current.clear()
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }

  const updateAvatarUrl = (url: string) => setAvatarUrl(url)

  const value: AuthContextValue = {
    user,
    isAuthenticated,
    isLoading,
    loading: isLoading,
    session,
    preferredName,
    avatarUrl,
    googleProviderToken,
    updateAvatarUrl,
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