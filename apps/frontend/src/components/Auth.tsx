import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/authContext'
import { Card } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'
import * as Switch from '@radix-ui/react-switch'
import clsx from 'clsx'
import { useNavigate } from 'react-router-dom'

export function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [darkMode, setDarkMode] = useState(
    typeof window !== 'undefined' ? document.documentElement.classList.contains('dark') : false
  )
  const { isAuthenticated, isLoading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  // Redirect to calendar if already authenticated
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      navigate('/calendar')
    }
  }, [isAuthenticated, isLoading, navigate])

  function toggleDarkMode() {
    setDarkMode(prev => !prev)
  }

  async function handleSignIn() {
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

      if (signInError) {
        console.error('❌ [AUTH] SignIn error:', signInError)
        setError(signInError.message)
      }
      // No redirect here - the auth state change will trigger the redirect
    } catch (err) {
      console.error('❌ [AUTH] SignIn catch block error:', err)
      setError(err instanceof Error ? err.message : 'An unknown error occurred')
    } finally {
      setLoading(false)
    }
  }

  async function handleSignUp() {
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password })

      if (signUpError) {
        console.error('❌ [AUTH] SignUp error:', signUpError)
        setError(signUpError.message)
      } else if (data?.user) {
        setMessage('Registration successful! Please check your email to confirm your account.')
      } else {
        setMessage('Registration request sent. Please check your email to continue.')
      }
    } catch (err) {
      console.error('❌ [AUTH] SignUp catch block error:', err)
      setError(err instanceof Error ? err.message : 'An unknown error occurred')
    } finally {
      setLoading(false)
    }
  }

  async function handleOAuthLogin() {
    setLoading(true)
    setError(null)
    try {
      const { error } = await supabase.auth.signInWithOAuth({ 
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/calendar`
        }
      })
      if (error) setError(error.message)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred')
    } finally {
      setLoading(false)
    }
  }

  // Show loading indicator while checking auth state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-gray-100">Loading...</div>
      </div>
    )
  }

  // Don't render login form if already authenticated
  if (isAuthenticated) {
    return null
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-gray-100 font-sans px-4">
      <Card className="w-full max-w-md p-8 sm:p-10 bg-gray-800 border-gray-700 rounded-2xl shadow-lg">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-3xl font-semibold">Welcome to Glyde</h2>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <Switch.Root
              checked={darkMode}
              onCheckedChange={toggleDarkMode}
              className={clsx(
                'w-11 h-6 rounded-full relative transition-colors',
                darkMode ? 'bg-indigo-500' : 'bg-gray-600'
              )}
              aria-label="Toggle dark mode"
            >
              <Switch.Thumb
                className={clsx(
                  'block w-5 h-5 bg-white rounded-full shadow transform transition-transform',
                  darkMode ? 'translate-x-5' : 'translate-x-1'
                )}
              />
            </Switch.Root>
          </label>
        </div>

        <div className="flex flex-col space-y-6">
          <Button
            variant="outline"
            className="w-full py-3 font-medium border-gray-600 text-gray-100 hover:bg-gray-700"
            onClick={handleOAuthLogin}
            disabled={loading}
          >
            <span className="inline-flex items-center space-x-2">
              <svg
                width="20"
                height="20"
                viewBox="0 0 48 48"
                fill="none"
                className="h-5 w-5"
              >
                <path
                  d="M47.532 24.5528C47.532 22.9214 47.3997 21.2811 47.1175 19.6761H24.48V28.9181H37.4434C36.9055 31.8988 35.177 34.5356 32.6461 36.2111V42.2078H40.3801C44.9217 38.0278 47.532 31.8547 47.532 24.5528Z"
                  fill="#4285F4"
                />
                <path
                  d="M24.48 48.0016C30.9529 48.0016 36.4116 45.8764 40.3888 42.2078L32.6549 36.2111C30.5031 37.675 27.7252 38.5039 24.4888 38.5039C18.2275 38.5039 12.9187 34.2798 11.0139 28.6006H3.03296V34.7825C7.10718 42.8868 15.4056 48.0016 24.48 48.0016Z"
                  fill="#34A853"
                />
                <path
                  d="M11.0051 28.6006C9.99973 25.6199 9.99973 22.3922 11.0051 19.4115V13.2296H3.03298C-0.371021 20.0112 -0.371021 28.0009 3.03298 34.7825L11.0051 28.6006Z"
                  fill="#FBBC04"
                />
                <path
                  d="M24.48 9.49932C27.9016 9.44641 31.2086 10.7339 33.6866 13.0973L40.5387 6.24523C36.2 2.17101 30.4414 -0.068932 24.48 0.00161733C15.4055 0.00161733 7.10718 5.11644 3.03296 13.2296L11.005 19.4115C12.901 13.7235 18.2187 9.49932 24.48 9.49932Z"
                  fill="#EA4335"
                />
              </svg>
              <span>Sign in with Google</span>
            </span>
          </Button>

          <div className="relative text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-700"></div>
            </div>
            <span className="relative px-3 bg-gray-800 text-sm text-gray-500">
              or continue with email
            </span>
          </div>

          {error && (
            <div className="rounded-md bg-red-500/10 border border-red-500/40 text-red-200 px-3 py-2 text-sm">
              {error}
            </div>
          )}
          {message && (
            <div className="rounded-md bg-emerald-500/10 border border-emerald-500/40 text-emerald-200 px-3 py-2 text-sm">
              {message}
            </div>
          )}

          <form
            className="space-y-4"
            onSubmit={e => {
              e.preventDefault()
              handleSignIn()
            }}
          >
            <Input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={loading}
              required
              className="bg-gray-700 border-gray-600 placeholder-gray-400 text-gray-100 focus:ring-indigo-500 focus:border-indigo-500"
            />

            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={loading}
              required
              className="bg-gray-700 border-gray-600 placeholder-gray-400 text-gray-100 focus:ring-indigo-500 focus:border-indigo-500"
            />

            <div className="flex space-x-4 pt-2">
              <Button type="submit" className="flex-1 py-3 font-medium" disabled={loading}>
                Sign in
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="flex-1 py-3 font-medium"
                onClick={handleSignUp}
                disabled={loading}
              >
                Register
              </Button>
            </div>
          </form>

          {error && (
            <div className="text-sm text-red-400 bg-red-900/50 rounded-md p-2 text-center">
              {error}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
