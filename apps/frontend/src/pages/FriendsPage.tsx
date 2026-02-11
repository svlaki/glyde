import { FriendsSection } from '../components/FriendsSection'
import { VerticalSidebar, SIDEBAR_WIDTH } from '../components/VerticalSidebar'
import { useDarkMode } from '../lib/darkModeContext'
import { getColors } from '../styles/colors'

export function FriendsPage() {
  const { isDarkMode } = useDarkMode()
  const colors = getColors(isDarkMode)

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
          <FriendsSection />
        </div>
      </div>
    </div>
  )
}
