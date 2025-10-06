import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/authContext'
import { ThemeToggle } from './ui/theme-toggle'
import { Drawer, Button as MantineButton, NavLink, Divider } from '@mantine/core'
import { cn } from '@/lib/utils'

interface MainLayoutProps {
  children: React.ReactNode
}

const navItems = [
  { path: '/calendar', label: 'Calendar', icon: '📅' },
  { path: '/tasks', label: 'Tasks', icon: '✅' },
  { path: '/goals', label: 'Goals', icon: '🎯' },
  { path: '/profile', label: 'Profile', icon: '👤' },
  { path: '/categories', label: 'Categories', icon: '🏷️' }
]

export function MainLayout({ children }: MainLayoutProps) {
  const location = useLocation()
  const { signOut } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  return (
    <div className="h-screen flex flex-col bg-background">
      <nav className="bg-card border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={() => setMobileOpen(true)}
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                aria-label="Toggle menu"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <h1 className="ml-3 text-xl font-bold text-foreground">Glyde</h1>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <button
                onClick={signOut}
                className="px-4 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-accent hover:border-primary transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <Drawer
        opened={mobileOpen}
        onClose={() => setMobileOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <span className="text-2xl">✨</span>
            <span className="text-lg font-bold">Navigation</span>
          </div>
        }
        padding="md"
        size="sm"
      >
        <div className="flex flex-col gap-1">
          {navItems.map(item => (
            <NavLink
              key={item.path}
              component={Link}
              to={item.path}
              label={item.label}
              leftSection={<span className="text-xl">{item.icon}</span>}
              active={location.pathname === item.path}
              onClick={() => setMobileOpen(false)}
              variant="filled"
              styles={{
                root: {
                  borderRadius: '8px',
                  fontWeight: 600,
                },
              }}
            />
          ))}
        </div>

        <Divider my="md" />

        <MantineButton
          variant="subtle"
          color="red"
          fullWidth
          onClick={() => {
            setMobileOpen(false)
            signOut()
          }}
        >
          Sign Out
        </MantineButton>
      </Drawer>

      <main className="flex-1 overflow-y-auto bg-gradient-to-br from-background via-background to-muted/40">
        <div className="mx-auto flex w-full flex-col">
          {children}
        </div>
      </main>
    </div>
  )
}
