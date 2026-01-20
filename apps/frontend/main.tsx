import "./src/styles/globals.css"
import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './src/lib/authContext'
import { CategoryProvider } from './src/lib/categoryContext'
import { DarkModeProvider } from './src/lib/darkModeContext'
import { RuleProvider } from './src/lib/ruleContext'
import { Auth } from './src/components/Auth'
import { CalendarPage } from './src/pages/CalendarPage'
import { ProfilePage } from './src/pages/ProfilePage'
import { AspectsPage } from './src/pages/AspectsPage'
import { RulesPage } from './src/pages/RulesPage'
import { ProtectedRoute } from './src/components/ProtectedRoute'
import { Onboarding } from './src/components/onboarding'
import { OnboardingCheck } from './src/components/OnboardingCheck'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <DarkModeProvider>
          <RuleProvider>
            <CategoryProvider>
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
                  path="/rules"
                  element={
                    <ProtectedRoute>
                      <OnboardingCheck>
                        <RulesPage />
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
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </CategoryProvider>
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
