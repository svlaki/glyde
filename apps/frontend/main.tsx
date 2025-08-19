import "./src/styles/globals.css"
import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './src/lib/authContext'
import { InteractionProvider } from './src/lib/interactionContext'
import { Auth } from './src/components/Auth'
import { CalendarPage } from './src/pages/CalendarPage'
import { ProtectedRoute } from './src/components/ProtectedRoute'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <InteractionProvider>
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
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </InteractionProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(<App />)
}
