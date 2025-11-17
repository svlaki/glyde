import "./src/styles/globals.css"
import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './src/lib/authContext'
import { CategoryProvider } from './src/lib/categoryContext'
import { DarkModeProvider } from './src/lib/darkModeContext'
import { Auth } from './src/components/Auth'
import { CalendarPage } from './src/pages/CalendarPage'
import { ProtectedRoute } from './src/components/ProtectedRoute'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <DarkModeProvider>
          <CategoryProvider>
            <Routes>
              <Route path="/" element={<Auth />} />
              <Route
                path="/calendar"
                element={
                  <ProtectedRoute>
                    <CalendarPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard"
                element={<Navigate to="/calendar" replace />}
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </CategoryProvider>
        </DarkModeProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(<App />)
}
