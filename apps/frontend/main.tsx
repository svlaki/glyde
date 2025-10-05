import './src/styles/globals.css'

import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { MainLayout } from '@/components/MainLayout'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Auth } from '@/components/Auth'
import { ToastProvider } from '@/components/ui/toast'
import { ThemeProvider } from '@/components/ui/theme-provider'
import { AuthProvider } from '@/lib/authContext'
import { InteractionProvider } from '@/lib/interactionContext'
import CalendarPage from '@/pages/CalendarPage'
import CategoriesPage from '@/pages/CategoriesPage'
import GoalsPage from '@/pages/GoalsPage'
import ProfilePage from '@/pages/ProfilePage'
import TasksPage from '@/pages/TasksPage'

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
