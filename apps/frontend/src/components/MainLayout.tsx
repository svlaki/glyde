import { useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { useAuth } from '@/lib/authContext'
import { cn } from '@/lib/utils'

interface MainLayoutProps {
  children: ReactNode
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [location.pathname])

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(prev => !prev)
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/80 bg-card/80 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={toggleMobileMenu}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-background/80 text-muted-foreground shadow-sm transition hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:hidden"
              aria-label="Toggle navigation menu"
              aria-expanded={isMobileMenuOpen}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
            <Link to="/calendar" className="text-lg font-semibold tracking-tight text-foreground">
              Glyde
            </Link>
            <nav className="hidden items-center gap-1 md:flex">
              {navItems.map(item => {
                const isActive = location.pathname === item.path
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      'flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-all',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    )}
                  >
                    <span aria-hidden>{item.icon}</span>
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              variant="outline"
              size="sm"
              onClick={signOut}
              className="hidden md:inline-flex"
            >
              Sign out
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={signOut}
              className="md:hidden"
              aria-label="Sign out"
            >
              🚪
            </Button>
          </div>
        </div>
        {isMobileMenuOpen && (
          <div className="md:hidden">
            <div className="space-y-2 border-t border-border/60 bg-card/95 p-4 shadow-xl">
              {navItems.map(item => {
                const isActive = location.pathname === item.path
                return (
                  <Button
                    key={item.path}
                    variant={isActive ? 'default' : 'ghost'}
                    className="w-full justify-start gap-2 text-left"
                    onClick={() => setIsMobileMenuOpen(false)}
                    asChild
                  >
                    <Link to={item.path} className="flex items-center gap-2">
                      <span aria-hidden>{item.icon}</span>
                      {item.label}
                    </Link>
                  </Button>
                )
              })}
              <Button
                variant="destructive"
                className="w-full justify-start"
                onClick={() => {
                  setIsMobileMenuOpen(false)
                  signOut()
                }}
              >
                Sign out
              </Button>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 overflow-y-auto bg-gradient-to-br from-background via-background to-muted/40">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  )
}
