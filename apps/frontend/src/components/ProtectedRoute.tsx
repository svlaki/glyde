import React, { ReactNode, useEffect } from 'react'
import { useAuth } from '../lib/authContext'

interface ProtectedRouteProps {
  children: ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth()
  
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // Redirect to login page if not authenticated and not loading
      window.location.href = '/'
    }
  }, [isAuthenticated, isLoading])

  // Show nothing while loading or if not authenticated
  if (isLoading || !isAuthenticated) return null
  
  // Only render children when authenticated
  return <>{children}</>
} 