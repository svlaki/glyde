import "./src/styles/globals.css"
import React, { useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './src/lib/authContext'
import { AspectProvider } from './src/lib/aspectContext'
import { ThemeProvider } from './src/lib/themeContext'
import { RuleProvider } from './src/lib/ruleContext'
import { ConnectionProvider } from './src/lib/connectionContext'
import { Auth } from './src/components/Auth'
import { CalendarPage } from './src/pages/CalendarPage'
import { ProfilePage } from './src/pages/ProfilePage'
import { ProfileEditPage } from './src/pages/ProfileEditPage'
import { AspectsPage } from './src/pages/AspectsPage'
import { ConnectionsPage } from './src/pages/ConnectionsPage'
import { PlanPage } from './src/pages/PlanPage'
import { OAuthCallbackPage } from './src/pages/OAuthCallbackPage'
import { FriendsPage } from './src/pages/FriendsPage'
import { ProjectsPage } from './src/pages/ProjectsPage'
import { RatingsPage } from './src/pages/RatingsPage'
import { RemindersPage } from './src/pages/RemindersPage'
import { AdminAnalyticsPage } from './src/pages/AdminAnalyticsPage'
import { ProjectProvider } from './src/lib/projectContext'
import { ProtectedRoute } from './src/components/ProtectedRoute'
import { Onboarding } from './src/components/onboarding'
import { OnboardingCheck } from './src/components/OnboardingCheck'
import { KeyboardProvider } from './src/hooks/useKeyboard'
import { initAnalytics, trackPageView, trackEvent, shutdownAnalytics } from './src/lib/analytics'

function AnalyticsTracker() {
  const { user } = useAuth()
  const location = useLocation()
  const initialized = useRef(false)
  const currentUserId = useRef<string | null>(null)

  useEffect(() => {
    const uid = user?.id ?? null
    if (uid && uid !== currentUserId.current) {
      if (initialized.current) shutdownAnalytics()
      initAnalytics(uid)
      initialized.current = true
      currentUserId.current = uid
      // Capture the initial page view immediately so it isn't dropped
      trackPageView(location.pathname)
    }
    if (!uid && initialized.current) {
      shutdownAnalytics()
      initialized.current = false
      currentUserId.current = null
    }
    return () => {
      if (initialized.current) {
        shutdownAnalytics()
        initialized.current = false
        currentUserId.current = null
      }
    }
  }, [user?.id])

  // Skip the first run — the user-id effect already tracks the initial page view
  const isFirstPageViewEffect = useRef(true)
  useEffect(() => {
    if (isFirstPageViewEffect.current) {
      isFirstPageViewEffect.current = false
      return
    }
    if (initialized.current) {
      trackPageView(location.pathname)
    }
  }, [location.pathname])

  return null
}

// Global error tracking — use addEventListener to avoid overwriting other handlers
window.addEventListener('error', (event) => {
  trackEvent('frontend_error', 'error', {
    message: String(event.message),
    source: event.filename,
    lineno: event.lineno,
    colno: event.colno,
  })
})

window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
  trackEvent('unhandled_rejection', 'error', {
    reason: String(event.reason),
  })
})

function App() {
  return (
    <KeyboardProvider>
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <RuleProvider>
            <ConnectionProvider>
            <AspectProvider>
            <ProjectProvider>
              <AnalyticsTracker />
              <Routes>
                <Route path="/" element={<Auth />} />
                <Route
                  path="/onboarding"
                  element={
                    <ProtectedRoute>
                      <Onboarding />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/calendar"
                  element={
                    <ProtectedRoute>
                      <OnboardingCheck>
                        <CalendarPage />
                      </OnboardingCheck>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/profile/edit"
                  element={
                    <ProtectedRoute>
                      <OnboardingCheck>
                        <ProfileEditPage />
                      </OnboardingCheck>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute>
                      <OnboardingCheck>
                        <ProfilePage />
                      </OnboardingCheck>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/aspects"
                  element={
                    <ProtectedRoute>
                      <OnboardingCheck>
                        <AspectsPage />
                      </OnboardingCheck>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/projects"
                  element={
                    <ProtectedRoute>
                      <OnboardingCheck>
                        <ProjectsPage />
                      </OnboardingCheck>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/friends"
                  element={
                    <ProtectedRoute>
                      <OnboardingCheck>
                        <FriendsPage />
                      </OnboardingCheck>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/rules"
                  element={<Navigate to="/profile" replace />}
                />
                <Route
                  path="/connections"
                  element={
                    <ProtectedRoute>
                      <OnboardingCheck>
                        <ConnectionsPage />
                      </OnboardingCheck>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/plan"
                  element={
                    <ProtectedRoute>
                      <OnboardingCheck>
                        <PlanPage />
                      </OnboardingCheck>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/ratings"
                  element={
                    <ProtectedRoute>
                      <OnboardingCheck>
                        <RatingsPage />
                      </OnboardingCheck>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/reminders"
                  element={
                    <ProtectedRoute>
                      <OnboardingCheck>
                        <RemindersPage />
                      </OnboardingCheck>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/analytics"
                  element={
                    <ProtectedRoute>
                      <AdminAnalyticsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/goals"
                  element={<Navigate to="/profile" replace />}
                />
                <Route
                  path="/dashboard"
                  element={<Navigate to="/calendar" replace />}
                />
                <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </ProjectProvider>
            </AspectProvider>
            </ConnectionProvider>
          </RuleProvider>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
    </KeyboardProvider>
  )
}

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(<App />)
}
