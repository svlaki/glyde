import { useDarkMode } from '../lib/darkModeContext'
import { ProfileStats } from '../components/ProfileStats'
import { ProfileSettings } from '../components/ProfileSettings'
import { GoalsSection } from '../components/GoalsSection'
import { RulesSection } from '../components/RulesSection'
import { VerticalSidebar, SIDEBAR_WIDTH } from '../components/VerticalSidebar'
import { getColors } from '../styles/colors'
import { usePlatform } from '../hooks/usePlatform'
import { MobileHeader } from '../components/mobile/MobileHeader'
import { mobileStyles, mobileSpacing } from '../styles/mobileStyles'

export function ProfilePage() {
  const { isMobile } = usePlatform()

  if (isMobile) {
    return <ProfilePageMobile />
  }

  return <ProfilePageDesktop />
}

function ProfilePageMobile() {
  const { isDarkMode } = useDarkMode()
  const colors = getColors(isDarkMode)

  return (
    <div style={mobileStyles.fullHeight}>
      <MobileHeader title="Profile" showMenu={true} />

      <div style={{
        ...mobileStyles.scrollContainer,
        background: colors.bgPrimary,
        paddingLeft: mobileSpacing.paddingX,
        paddingRight: mobileSpacing.paddingX,
        paddingTop: mobileSpacing.paddingTop,
        paddingBottom: mobileSpacing.paddingBottomNoTabs
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}>
          <ProfileStats />
          <GoalsSection />
          <RulesSection />
          <ProfileSettings />
        </div>
      </div>
    </div>
  )
}

function ProfilePageDesktop() {
  const { isDarkMode } = useDarkMode()
  const colors = getColors(isDarkMode)

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      overflow: 'hidden',
      background: colors.bgPrimary
    }}>
      {/* Vertical Sidebar */}
      <VerticalSidebar />

      {/* Main Content - offset by sidebar width */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '24px',
        marginLeft: `${SIDEBAR_WIDTH}px`,
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '24px'
        }}>
          {/* Stats Section */}
          <ProfileStats />

          {/* Goals Section */}
          <GoalsSection />

          {/* Rules Section */}
          <RulesSection />

          {/* Settings Section */}
          <ProfileSettings />
        </div>
      </div>
    </div>
  )
}
