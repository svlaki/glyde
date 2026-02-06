import "./src/styles/globals.css"
import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './src/lib/authContext'
import { AspectProvider } from './src/lib/aspectContext'
import { DarkModeProvider } from './src/lib/darkModeContext'
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
import { ProtectedRoute } from './src/components/ProtectedRoute'
import { Onboarding } from './src/components/onboarding'
import { OnboardingCheck } from './src/components/OnboardingCheck'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <DarkModeProvider>
          <RuleProvider>
            <ConnectionProvider>
            <AspectProvider>
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
                  element={<Navigate to="/profile" replace />}
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
            </AspectProvider>
            </ConnectionProvider>
          </RuleProvider>
        </DarkModeProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(<App />)
}
