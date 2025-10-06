import "./src/styles/globals.css"
import "./src/styles/mantine.css"
import "./src/components/modal-fixes.css"
import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { theme } from './src/styles/theme'
import { AuthProvider } from './src/lib/authContext'
import { CategoryProvider } from './src/lib/categoryContext'
import { InteractionProvider } from './src/lib/interactionContext'
import { ToastProvider } from './src/components/ui/toast'
import { ThemeProvider } from './src/components/ui/theme-provider'
import { ErrorBoundary } from './src/components/ErrorBoundary'
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
    <ErrorBoundary>
      <BrowserRouter>
        <ThemeProvider>
          <MantineProvider theme={theme} defaultColorScheme="dark">
            <Notifications position="top-right" zIndex={1000} />
            <AuthProvider>
              <CategoryProvider>
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
              </CategoryProvider>
            </AuthProvider>
          </MantineProvider>
        </ThemeProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(<App />)
}
