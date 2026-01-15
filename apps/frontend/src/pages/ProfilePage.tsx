import { useDarkMode } from '../lib/darkModeContext'
import { PageHeader } from '../components/PageHeader'
import { ProfileStats } from '../components/ProfileStats'
import { ProfileSettings } from '../components/ProfileSettings'
import { GoalsSection } from '../components/GoalsSection'
import { getColors } from '../styles/colors'
import { usePlatform } from '../hooks/usePlatform'
import { MobileHeader } from '../components/mobile/MobileHeader'
import { mobileStyles } from '../styles/mobileStyles'

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
        padding: '20px',
        paddingTop: '16px',
        paddingBottom: 'calc(20px + env(safe-area-inset-bottom))'
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}>
          <ProfileStats />
          <GoalsSection />
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
      flexDirection: 'column',
      overflow: 'hidden',
      background: colors.bgSecondary
    }}>
      {/* Header */}
      <PageHeader />

      {/* Main Content */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '20px'
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}>
          {/* Stats Section */}
          <ProfileStats />

          {/* Goals Section */}
          <GoalsSection />

          {/* Settings Section */}
          <ProfileSettings />
        </div>
      </div>
    </div>
  )
}
