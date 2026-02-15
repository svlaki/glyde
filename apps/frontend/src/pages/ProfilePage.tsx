import { useTheme } from '../lib/themeContext'
import { GoalsSection } from '../components/GoalsSection'
import { RulesSection } from '../components/RulesSection'
import { VerticalSidebar, SIDEBAR_WIDTH } from '../components/VerticalSidebar'
import { getColors } from '../styles/colors'
import { usePlatform } from '../hooks/usePlatform'
import { MobileHeader } from '../components/mobile/MobileHeader'
import { mobileStyles, mobileSpacing } from '../styles/mobileStyles'
import { useProfileData } from '../hooks/useProfileData'
import { ProfileHero } from '../components/profile/ProfileHero'
import { ActivityInsightsCard } from '../components/profile/ActivityInsightsCard'
import { ProfileCompletenessCard } from '../components/profile/ProfileCompletenessCard'
import { AspectBreakdownCard } from '../components/profile/AspectBreakdownCard'
import { ConnectionsStatusCard } from '../components/profile/ConnectionsStatusCard'
import { getTypography } from '../styles/typography'

export function ProfilePage() {
  const { isMobile } = usePlatform()

  if (isMobile) {
    return <ProfilePageMobile />
  }

  return <ProfilePageDesktop />
}

function ProfilePageMobile() {
  const { theme, isDarkMode } = useTheme()
  const colors = getColors(theme)
  const typography = getTypography(true)
  const data = useProfileData()

  return (
    <div style={mobileStyles.fullHeight}>
      <MobileHeader title="Profile" showMenu={true} />

      <div style={{
        ...mobileStyles.scrollContainer,
        background: colors.bgPrimary,
        paddingLeft: mobileSpacing.paddingX,
        paddingRight: mobileSpacing.paddingX,
        paddingTop: mobileSpacing.paddingTop,
        paddingBottom: mobileSpacing.paddingBottomNoTabs,
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}>
          <ProfileHero />

          {data.loading ? (
            <div style={{
              padding: '40px',
              textAlign: 'center',
              color: colors.textSecondary,
              ...typography.bodyMd,
            }}>
              Loading...
            </div>
          ) : (
            <>
              <ProfileCompletenessCard
                summary={data.profileSummary}
                profile={data.profile}
                onProfileUpdated={data.refreshProfile}
              />
              <ActivityInsightsCard taskInsights={data.taskInsights} />
              <AspectBreakdownCard breakdown={data.aspectBreakdown} />
              <ConnectionsStatusCard connections={data.connections} onConnectionChanged={data.refreshConnections} />

              <GoalsSection />
              <RulesSection />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function ProfilePageDesktop() {
  const { theme, isDarkMode } = useTheme()
  const colors = getColors(theme)
  const typography = getTypography(false)
  const data = useProfileData()

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      overflow: 'hidden',
      background: colors.bgPrimary,
    }}>
      <VerticalSidebar />

      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '24px',
        marginLeft: `${SIDEBAR_WIDTH}px`,
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        }}>
          <ProfileHero />

          {data.loading ? (
            <div style={{
              padding: '40px',
              textAlign: 'center',
              color: colors.textSecondary,
              ...typography.bodyMd,
            }}>
              Loading...
            </div>
          ) : (
            <>
              {/* All cards in 2-column grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '16px',
              }}>
                <ProfileCompletenessCard summary={data.profileSummary} profile={data.profile} />
                <ActivityInsightsCard taskInsights={data.taskInsights} />
                <GoalsSection />
                <AspectBreakdownCard breakdown={data.aspectBreakdown} />
                <ConnectionsStatusCard connections={data.connections} onConnectionChanged={data.refreshConnections} />
                <RulesSection />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
