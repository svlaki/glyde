import { useState } from 'react'
import { FriendsSection } from '../components/FriendsSection'
import { SharedAspectsSection } from '../components/SharedAspectsSection'
import { VerticalSidebar, SIDEBAR_WIDTH } from '../components/VerticalSidebar'
import { useDarkMode } from '../lib/darkModeContext'
import { getColors } from '../styles/colors'
import { fontFamily, fontSize, fontWeight } from '../styles/typography'

type TabType = 'friends' | 'shared-aspects'

export function FriendsPage() {
  const { isDarkMode } = useDarkMode()
  const colors = getColors(isDarkMode)
  const [activeTab, setActiveTab] = useState<TabType>('friends')

  const tabs: { id: TabType; label: string }[] = [
    { id: 'friends', label: 'Friends' },
    { id: 'shared-aspects', label: 'Shared Aspects' }
  ]

  return (
    <div style={{ display: 'flex' }}>
      <VerticalSidebar />
      <div
        style={{
          marginLeft: `${SIDEBAR_WIDTH}px`,
          flex: 1,
          background: colors.bgPrimary,
          minHeight: '100vh',
          overflow: 'auto',
        }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
          {/* Tab Navigation */}
          <div style={{
            display: 'flex',
            gap: '4px',
            marginBottom: '24px',
            borderBottom: `1px solid ${colors.border}`,
            paddingBottom: '0'
          }}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '12px 20px',
                  fontSize: fontSize.base,
                  fontFamily: fontFamily.sans,
                  fontWeight: activeTab === tab.id ? fontWeight.semibold : fontWeight.medium,
                  color: activeTab === tab.id ? colors.primary : colors.textSecondary,
                  background: 'transparent',
                  border: 'none',
                  borderBottom: activeTab === tab.id ? `2px solid ${colors.primary}` : '2px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  marginBottom: '-1px'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === 'friends' && <FriendsSection />}
          {activeTab === 'shared-aspects' && <SharedAspectsSection />}
        </div>
      </div>
    </div>
  )
}
