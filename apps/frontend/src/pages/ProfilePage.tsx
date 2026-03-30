import { useTheme } from '../lib/themeContext'
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
      <MobileHeader title="Profile" showMenu={true} showSearch={true} />

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
        padding: '28px 32px',
        marginLeft: `${SIDEBAR_WIDTH}px`,
      }}>
        <div className="page-enter" style={{
          maxWidth: '1100px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}>
          {/* Hero spans full width */}
          <div className="card-reveal card-reveal-1">
            <ProfileHero />
          </div>

          {data.loading ? (
            <div style={{
              padding: '60px',
              textAlign: 'center',
              color: colors.textSecondary,
              ...typography.bodyMd,
            }}>
              Loading...
            </div>
          ) : (
            /* Bento grid - 2 column layout with proper spacing */
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '16px',
            }}>
              {/* About/Profile info */}
              <div className="card-reveal card-reveal-2">
                <ProfileCompletenessCard summary={data.profileSummary} profile={data.profile} onProfileUpdated={data.refreshProfile} />
              </div>

              {/* Activity insights */}
              <div className="card-reveal card-reveal-3">
                <ActivityInsightsCard taskInsights={data.taskInsights} />
              </div>

              {/* Aspect breakdown - full width for pie chart + legend */}
              <div className="card-reveal card-reveal-4" style={{ gridColumn: 'span 2' }}>
                <AspectBreakdownCard breakdown={data.aspectBreakdown} />
              </div>

              {/* Connections - full width */}
              <div className="card-reveal card-reveal-5" style={{ gridColumn: 'span 2' }}>
                <ConnectionsStatusCard connections={data.connections} onConnectionChanged={data.refreshConnections} />
              </div>

              {/* Rules - full width */}
              <div className="card-reveal card-reveal-6" style={{ gridColumn: 'span 2' }}>
                <RulesSection />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
