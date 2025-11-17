import { useAuth } from '../lib/authContext'

interface NavigationMenuProps {
  isOpen: boolean
  onClose: () => void
}

export function NavigationMenu({ isOpen, onClose }: NavigationMenuProps) {
  const { user, signOut } = useAuth()

  if (!isOpen) return null

  const menuItems = [
    { label: 'Calendar', icon: '📅', path: '/calendar' },
    { label: 'Tasks', icon: '✓', path: '/tasks' },
    { label: 'Goals', icon: '🎯', path: '/goals' },
    { label: 'Profile', icon: '👤', path: '/profile' },
    { label: 'Settings', icon: '⚙️', path: '/settings' }
  ]

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 1000,
          animation: 'fadeIn 0.2s ease-out'
        }}
      />

      {/* Menu */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        width: '280px',
        background: '#fff',
        boxShadow: '2px 0 10px rgba(0,0,0,0.1)',
        zIndex: 1001,
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideInLeft 0.3s ease-out'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #e5e5e5'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '600', margin: 0 }}>
              Glyde
            </h2>
            <button
              onClick={onClose}
              style={{
                width: '32px',
                height: '32px',
                border: 'none',
                background: '#f5f5f5',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px'
              }}
            >
              ✕
            </button>
          </div>
          <div style={{ marginTop: '10px', fontSize: '13px', color: '#666' }}>
            {user?.email}
          </div>
        </div>

        {/* Menu Items */}
        <nav style={{ flex: 1, padding: '20px' }}>
          {menuItems.map(item => (
            <button
              key={item.path}
              onClick={onClose}
              style={{
                width: '100%',
                padding: '12px 16px',
                marginBottom: '8px',
                border: 'none',
                background: 'transparent',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                fontSize: '14px',
                fontWeight: '500',
                textAlign: 'left',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ fontSize: '18px' }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div style={{
          padding: '20px',
          borderTop: '1px solid #e5e5e5'
        }}>
          <button
            onClick={() => {
              signOut()
              onClose()
            }}
            className="btn btn-secondary"
            style={{ width: '100%' }}
          >
            Sign Out
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideInLeft {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>
  )
}
