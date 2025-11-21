import { useDarkMode } from '../lib/darkModeContext'
import { PageHeader } from '../components/PageHeader'
import { ProfileStats } from '../components/ProfileStats'
import { ProfileSettings } from '../components/ProfileSettings'
import { GoalsSection } from '../components/GoalsSection'
import { getColors } from '../styles/colors'

export function ProfilePage() {
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
