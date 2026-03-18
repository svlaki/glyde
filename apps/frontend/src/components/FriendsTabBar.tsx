import { getColors } from '../styles/colors'
import { getTypography } from '../styles/typography'

type FriendsTab = 'friends' | 'requests' | 'discover'

interface FriendsTabBarProps {
  activeTab: FriendsTab
  onTabChange: (tab: FriendsTab) => void
  friendsCount: number
  requestsCount: number
  isMobile?: boolean
  colors: ReturnType<typeof getColors>
  typography: ReturnType<typeof getTypography>
}

export function FriendsTabBar({
  activeTab,
  onTabChange,
  friendsCount,
  requestsCount,
  isMobile = false,
  colors,
  typography
}: FriendsTabBarProps) {
  const tabStyle = (tab: FriendsTab) => ({
    padding: '8px 0',
    ...typography.labelLg,
    fontWeight: activeTab === tab ? 600 : 500,
    background: 'transparent' as const,
    border: 'none' as const,
    borderBottom: activeTab === tab ? `2px solid ${colors.textPrimary}` : '2px solid transparent',
    color: activeTab === tab ? colors.textPrimary : colors.textSecondary,
    cursor: 'pointer' as const,
    transition: isMobile ? undefined : 'all 0.15s',
    position: 'relative' as const,
    minHeight: isMobile ? '44px' : undefined,
  })

  return (
    <div style={{
      padding: '12px 20px',
      borderBottom: `1px solid ${colors.border}`,
      display: 'flex',
      gap: '16px',
      background: isMobile ? undefined : colors.bgPrimary,
    }}>
      <button onClick={() => onTabChange('friends')} style={tabStyle('friends')}>
        Friends ({friendsCount})
      </button>
      <button onClick={() => onTabChange('requests')} style={tabStyle('requests')}>
        Requests
        {requestsCount > 0 && (
          <span style={{
            marginLeft: '6px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: '20px',
            height: '20px',
            background: '#d32f2f',
            color: 'white',
            borderRadius: '10px',
            ...typography.labelSm,
            fontWeight: 600,
          }}>
            {requestsCount}
          </span>
        )}
      </button>
      <button onClick={() => onTabChange('discover')} style={tabStyle('discover')}>
        Discover
      </button>
    </div>
  )
}
