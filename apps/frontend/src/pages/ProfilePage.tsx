import { useDarkMode } from '../lib/darkModeContext'
import { PageHeader } from '../components/PageHeader'
import { ProfileStats } from '../components/ProfileStats'
import { ProfileSettings } from '../components/ProfileSettings'
import { GoalsSection } from '../components/GoalsSection'
import { RulesSection } from '../components/RulesSection'
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

          {/* Rules Section */}
          <RulesSection />

          {/* Settings Section */}
          <ProfileSettings />
        </div>
      </div>
    </div>
  )
}
