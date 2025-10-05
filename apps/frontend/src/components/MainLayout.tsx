import { useEffect, useState } from 'react'
import { LogOut, Menu, X } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { useAuth } from '@/lib/authContext'
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
    <div className="flex min-h-screen bg-muted/40">
      <aside className="hidden w-64 flex-col border-r border-border/60 bg-card/70 px-5 py-8 shadow-sm lg:flex">
        <div className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <span className="inline-flex size-9 items-center justify-center rounded-full bg-primary/10 text-2xl">🚀</span>
          Glyde
        </div>
        <nav className="mt-10 flex flex-1 flex-col gap-1">
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-150 hover:bg-primary/10 hover:text-primary',
                  isActive && 'bg-primary text-primary-foreground shadow-sm'
                )
              }
            >
              <span className="text-lg" aria-hidden>
                {item.icon}
              </span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex flex-col gap-3 pt-4">
          <ThemeToggle />
          <Button variant="outline" className="justify-start gap-2" onClick={signOut}>
            <LogOut className="size-4" />
            Sign out
          </Button>
        </div>
      </aside>

      <div className="flex w-full flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border/70 bg-card/80 px-4 py-4 shadow-sm lg:hidden">
          <div className="flex items-center gap-3">
            <Button
              size="icon"
              variant="ghost"
              className="rounded-full"
              onClick={() => setMobileOpen(open => !open)}
            >
              {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
              <span className="sr-only">Toggle navigation</span>
            </Button>
            <span className="text-lg font-semibold text-foreground">Glyde</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button size="icon" variant="outline" className="rounded-full" onClick={signOut}>
              <LogOut className="size-4" />
              <span className="sr-only">Sign out</span>
            </Button>
          </div>
        </header>

        {mobileOpen && (
          <div className="border-b border-border/60 bg-card/95 px-4 py-4 shadow-sm lg:hidden">
            <nav className="flex flex-col gap-1">
              {navItems.map(item => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-150 hover:bg-primary/10 hover:text-primary',
                      isActive && 'bg-primary text-primary-foreground shadow-sm'
                    )
                  }
                >
                  <span className="text-lg" aria-hidden>
                    {item.icon}
                  </span>
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
        )}

        <main className="flex-1 overflow-y-auto bg-gradient-to-br from-background via-background to-muted/40">
          <div className="mx-auto flex w-full flex-col">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
