import { FriendsSection } from '../components/FriendsSection'
import { VerticalSidebar, SIDEBAR_WIDTH } from '../components/VerticalSidebar'
import { useTheme } from '../lib/themeContext'
import { getColors } from '../styles/colors'
import { usePlatform } from '../hooks/usePlatform'
import { MobileHeader } from '../components/mobile/MobileHeader'
import { mobileStyles } from '../styles/mobileStyles'

export function FriendsPage() {
  const { isMobile } = usePlatform()

  if (isMobile) {
    return <FriendsPageMobile />
  }

  return <FriendsPageDesktop />
}

function FriendsPageMobile() {
  return (
    <div style={mobileStyles.fullHeight}>
      <FriendsSection isMobileOverride={true} />
    </div>
  )
}

function FriendsPageDesktop() {
  const { theme } = useTheme()
  const colors = getColors(theme)

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
