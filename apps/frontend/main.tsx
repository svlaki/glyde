import "./src/styles/globals.css"
import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './src/lib/authContext'
import { InteractionProvider } from './src/lib/interactionContext'
import { ToastProvider } from './src/components/ui/toast'
import { ThemeProvider } from './src/components/ui/theme-provider'
import { Auth } from './src/components/Auth'
import { CalendarPage } from './src/pages/CalendarPage'
import TasksPage from './src/pages/TasksPage'
import GoalsPage from './src/pages/GoalsPage'
import ProfilePage from './src/pages/ProfilePage'
import CategoriesPage from './src/pages/CategoriesPage'
import { ProtectedRoute } from './src/components/ProtectedRoute'
import { MainLayout } from './src/components/MainLayout'

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <InteractionProvider>
            <ToastProvider>
              <Routes>
            <Route path="/" element={<Auth />} />
            <Route
              path="/calendar"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <CalendarPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/tasks"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <TasksPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/goals"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <GoalsPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <ProfilePage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/categories"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <CategoriesPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
            </ToastProvider>
          </InteractionProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(<App />)
}
