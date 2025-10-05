import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Drawer, NavLink, Divider } from '@mantine/core';

import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useAuth } from '@/lib/authContext';

type MainLayoutProps = {
  children: React.ReactNode;
};

const navItems = [
  { path: '/calendar', label: 'Calendar', icon: '📅' },
  { path: '/tasks', label: 'Tasks', icon: '✅' },
  { path: '/goals', label: 'Goals', icon: '🎯' },
  { path: '/profile', label: 'Profile', icon: '👤' },
  { path: '/categories', label: 'Categories', icon: '🏷️' },
];

export function MainLayout({ children }: MainLayoutProps) {
  const location = useLocation();
  const { signOut } = useAuth();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    setIsDrawerOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <nav className="bg-card border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsDrawerOpen(true)}
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary transition"
                aria-label="Toggle navigation menu"
                type="button"
              >
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <Link to="/calendar" className="text-xl font-bold text-foreground">
                Glyde
              </Link>
            </div>

            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button
                variant="outline"
                onClick={signOut}
                className="hidden sm:inline-flex"
              >
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <Drawer
        opened={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <span className="text-2xl">✨</span>
            <span className="text-lg font-semibold">Navigation</span>
          </div>
        }
        padding="md"
        size="sm"
      >
        <div className="flex flex-col gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              component={Link}
              to={item.path}
              label={item.label}
              leftSection={<span className="text-xl">{item.icon}</span>}
              active={location.pathname === item.path}
              onClick={() => setIsDrawerOpen(false)}
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

        <Button
          variant="destructive"
          className="w-full"
          onClick={() => {
            setIsDrawerOpen(false);
            signOut();
          }}
        >
          Sign Out
        </Button>
      </Drawer>

      <main className="flex-1 overflow-y-auto bg-gradient-to-br from-background via-background to-muted/40">
        <div className="mx-auto flex w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
