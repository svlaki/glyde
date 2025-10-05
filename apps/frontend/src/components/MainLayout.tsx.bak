import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/authContext'
import { ThemeToggle } from './ui/theme-toggle'

export function MainLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const { signOut } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  const navItems = [
    { path: '/calendar', label: 'Calendar', icon: '📅' },
    { path: '/tasks', label: 'Tasks', icon: '✓' },
    { path: '/goals', label: 'Goals', icon: '🎯' },
    { path: '/profile', label: 'Profile', icon: '👤' },
    { path: '/categories', label: 'Categories', icon: '🏷️' }
  ]

  return (
    <div className="h-screen flex flex-col bg-background">
      <nav className="bg-card border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
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

        {/* Hamburger dropdown menu */}
        {menuOpen && (
          <div className="absolute left-0 top-16 w-72 bg-card border-r border-border shadow-2xl z-50 rounded-br-xl overflow-hidden">
            <div className="py-3 px-3">
              {navItems.map(item => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMenuOpen(false)}
                  className={`group flex items-center gap-3 px-5 py-3.5 mb-1.5 rounded-xl text-base font-semibold transition-all duration-200 ${
                    location.pathname === item.path
                      ? 'bg-primary text-primary-foreground shadow-md scale-[1.02]'
                      : 'text-foreground hover:text-primary hover:bg-primary/10 hover:scale-[1.02] hover:shadow-sm active:scale-[0.98]'
                  }`}
                >
                  <span className="text-2xl">{item.icon}</span>
                  <span className="font-bold tracking-wide">{item.label}</span>
                  {location.pathname === item.path && (
                    <span className="ml-auto text-xs">●</span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}
      </nav>

      <main className="flex-1 overflow-auto bg-background">
        {children}
      </main>
    </div>
  )
}
