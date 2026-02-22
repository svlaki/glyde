import { useState, useEffect } from 'react'
import { useAuth } from '../lib/authContext'
import { useTheme } from '../lib/themeContext'
import { useAspects } from '../lib/aspectContext'
import { createUserAspect, updateUserAspect, deleteUserAspect } from '../lib/aspectService'
import type { Aspect } from '../lib/aspectService'
import { AspectCard } from '../components/AspectCard'
import { AspectForm } from '../components/AspectForm'
import { AspectShareModal } from '../components/AspectShareModal'
import { GoalsByAspect } from '../components/GoalsByAspect'
import { EmptyState } from '../components/EmptyState'
import { VerticalSidebar, SIDEBAR_WIDTH } from '../components/VerticalSidebar'
import { getColors } from '../styles/colors'
import { getTypography } from '../styles/typography'
import { usePlatform } from '../hooks/usePlatform'
import { MobileHeader } from '../components/mobile/MobileHeader'
import { mobileStyles } from '../styles/mobileStyles'

export function AspectsPage() {
  const { isMobile } = usePlatform()

  if (isMobile) {
    return <AspectsPageMobile />
  }

  return <AspectsPageDesktop />
}

function AspectsPageMobile() {
  const { user, session } = useAuth()
  const { theme, isDarkMode } = useTheme()
  const colors = getColors(theme)
  const { aspects, loading, error, refreshAspects } = useAspects()
  const [selectedAspect, setSelectedAspect] = useState<Aspect | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingAspect, setEditingAspect] = useState<Aspect | undefined>(undefined)
  const [sharingAspect, setSharingAspect] = useState<Aspect | null>(null)

  const handleCreateAspect = () => {
    setEditingAspect(undefined)
    setIsFormOpen(true)
  }

  const handleEditAspect = (aspect: Aspect) => {
    setEditingAspect(aspect)
    setIsFormOpen(true)
  }

  const handleDeleteAspect = async (aspect: Aspect) => {
    if (!user || !session) return

    try {
      await deleteUserAspect(user, aspect.id!, session.access_token)
      if (selectedAspect?.id === aspect.id) {
        setSelectedAspect(null)
      }
      await refreshAspects()
    } catch (error) {
      console.error('Error deleting aspect:', error)
      alert('Failed to delete aspect. Please try again.')
    }
  }

  const handleSaveAspect = async (aspectData: Partial<Aspect>) => {
    if (!user || !session) return

    try {
      if (aspectData.id) {
        const { id, ...updates } = aspectData
        await updateUserAspect(user, id, updates, session.access_token)
      } else {
        await createUserAspect(user, aspectData as any, session.access_token)
      }
      await refreshAspects()
      setIsFormOpen(false)
    } catch (error) {
      console.error('Error saving aspect:', error)
      throw error
    }
  }

  const handleDescriptionUpdate = async (aspectToUpdate: Aspect, description: string) => {
    if (!user || !session) return
    await updateUserAspect(user, aspectToUpdate.id, { description }, session.access_token)
    await refreshAspects()
    setSelectedAspect(prev => prev?.id === aspectToUpdate.id ? { ...prev, description } : prev)
  }

  // Detail view - showing goals for selected aspect
  if (selectedAspect) {
    return (
      <div style={mobileStyles.fullHeight}>
        <MobileHeader
          title={selectedAspect.name}
          onBack={() => setSelectedAspect(null)}
        />
        <div style={{
          ...mobileStyles.scrollContainer,
          background: colors.bgPrimary,
          padding: '20px',
          paddingBottom: 'calc(20px + env(safe-area-inset-bottom))'
        }}>
          <GoalsByAspect
            aspect={selectedAspect}
            onEdit={selectedAspect.member_role !== 'viewer' ? () => handleEditAspect(selectedAspect) : undefined}
            onDelete={selectedAspect.member_role === 'owner' ? () => handleDeleteAspect(selectedAspect) : undefined}
            onDescriptionUpdate={selectedAspect.member_role !== 'viewer' ? (desc) => handleDescriptionUpdate(selectedAspect, desc) : undefined}
          />
        </div>

        <AspectForm
          aspect={editingAspect}
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          onSave={handleSaveAspect}
        />
      </div>
    )
  }

  // List view - showing all aspects
  return (
    <div style={mobileStyles.fullHeight}>
      <MobileHeader
        title="Aspects"
        showMenu={true}
        showSearch={true}
        actions={
        <button
          onClick={handleCreateAspect}
          className="btn btn-primary"
          style={{
            padding: '6px 12px',
            fontSize: '13px',
            fontWeight: '400',
            background: 'transparent',
            color: colors.textSecondary,
            border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          New
        </button>
        }
      />

      <div style={{
        ...mobileStyles.scrollContainer,
        background: colors.bgPrimary,
        padding: '20px',
        paddingTop: '16px',
        paddingBottom: 'calc(20px + env(safe-area-inset-bottom))'
      }}>
        {loading ? (
          <div style={{
            padding: '40px 20px',
            textAlign: 'center',
            color: colors.textSecondary,
            fontSize: '14px'
          }}>
            Loading aspects...
          </div>
        ) : error ? (
          <div style={{
            padding: '20px',
            textAlign: 'center',
            color: '#c66',
            fontSize: '14px'
          }}>
            Error: {error}
          </div>
        ) : aspects.length === 0 ? (
          <EmptyState
            title="No aspects yet"
            description="Create your first aspect to get started"
          />
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            {aspects.map(aspect => (
              <AspectCard
                key={aspect.id}
                aspect={aspect}
                isSelected={false}
                onClick={() => setSelectedAspect(aspect)}
                onEdit={aspect.member_role !== 'viewer' ? () => handleEditAspect(aspect) : undefined}
                onDelete={aspect.member_role === 'owner' ? () => handleDeleteAspect(aspect) : undefined}
              />
            ))}
          </div>
        )}
      </div>

      <AspectForm
        aspect={editingAspect}
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSave={handleSaveAspect}
      />

      <AspectShareModal
        aspect={sharingAspect}
        isOpen={!!sharingAspect}
        onClose={() => setSharingAspect(null)}
        onAspectUpdated={refreshAspects}
      />
    </div>
  )
}

function AspectsPageDesktop() {
  const { user, session } = useAuth()
  const { theme, isDarkMode } = useTheme()
  const colors = getColors(theme)
  const typography = getTypography(false)
  const { aspects, loading, error, refreshAspects } = useAspects()
  const [selectedAspect, setSelectedAspect] = useState<Aspect | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingAspect, setEditingAspect] = useState<Aspect | undefined>(undefined)
  const [sharingAspect, setSharingAspect] = useState<Aspect | null>(null)

  // Auto-select first aspect when aspects load
  useEffect(() => {
    if (!selectedAspect && aspects.length > 0) {
      setSelectedAspect(aspects[0])
    }
  }, [aspects, selectedAspect])

  const handleCreateAspect = () => {
    setEditingAspect(undefined)
    setIsFormOpen(true)
  }

  const handleEditAspect = (aspect: Aspect) => {
    setEditingAspect(aspect)
    setIsFormOpen(true)
  }

  const handleDeleteAspect = async (aspect: Aspect) => {
    if (!user || !session) return

    try {
      await deleteUserAspect(user, aspect.id!, session.access_token)
      if (selectedAspect?.id === aspect.id) {
        setSelectedAspect(null)
      }
      await refreshAspects()
    } catch (error) {
      console.error('Error deleting aspect:', error)
      alert('Failed to delete aspect. Please try again.')
    }
  }

  const handleSaveAspect = async (aspectData: Partial<Aspect>) => {
    if (!user || !session) return

    try {
      if (aspectData.id) {
        // Update existing aspect - destructure id out of updates
        const { id, ...updates } = aspectData
        await updateUserAspect(user, id, updates, session.access_token)
      } else {
        // Create new aspect
        await createUserAspect(user, aspectData as any, session.access_token)
      }
      await refreshAspects()
      setIsFormOpen(false)
    } catch (error) {
      console.error('Error saving aspect:', error)
      throw error
    }
  }

  const handleDescriptionUpdate = async (aspectToUpdate: Aspect, description: string) => {
    if (!user || !session) return
    await updateUserAspect(user, aspectToUpdate.id, { description }, session.access_token)
    await refreshAspects()
    setSelectedAspect(prev => prev?.id === aspectToUpdate.id ? { ...prev, description } : prev)
  }

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
        display: 'flex',
        overflow: 'hidden',
        minHeight: 0,
        marginLeft: `${SIDEBAR_WIDTH}px`,
      }}>
        {/* Left Sidebar - Aspects List */}
        <div style={{
          width: '350px',
          borderRight: `1px solid ${colors.border}`,
          background: colors.bgPrimary,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {/* Sidebar Header - Mobile-style */}
          <div style={{
            padding: '16px 20px',
            borderBottom: `1px solid ${colors.border}`,
            background: colors.bgPrimary
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h2 style={{
                ...typography.headingLg,
                fontWeight: 600,
                color: colors.textPrimary,
                margin: 0
              }}>
                Aspects
              </h2>
              <button
                onClick={handleCreateAspect}
                style={{
                  padding: '8px 14px',
                  ...typography.labelLg,
                  fontWeight: 500,
                  background: colors.bgTertiary,
                  color: colors.textSecondary,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = colors.bgHover
                  e.currentTarget.style.color = colors.textPrimary
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = colors.bgTertiary
                  e.currentTarget.style.color = colors.textSecondary
                }}
              >
                + New
              </button>
            </div>
          </div>

          {/* Aspects List */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            {loading ? (
              <div style={{
                padding: '40px',
                textAlign: 'center',
                color: colors.textSecondary,
                fontSize: '14px'
              }}>
                Loading aspects...
              </div>
            ) : error ? (
              <div style={{
                padding: '20px',
                textAlign: 'center',
                color: '#c66',
                fontSize: '14px'
              }}>
                Error: {error}
              </div>
            ) : aspects.length === 0 ? (
              <EmptyState
                title="No aspects yet"
                description="Create your first aspect to get started"
              />
            ) : (
              aspects.map(aspect => (
                <AspectCard
                  key={aspect.id}
                  aspect={aspect}
                  isSelected={selectedAspect?.id === aspect.id}
                  onClick={() => setSelectedAspect(aspect)}
                  onEdit={aspect.member_role !== 'viewer' ? () => handleEditAspect(aspect) : undefined}
                  onDelete={aspect.member_role === 'owner' ? () => handleDeleteAspect(aspect) : undefined}
                />
              ))
            )}
          </div>
        </div>

        {/* Right Content - Goals by Aspect */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '30px'
        }}>
          <GoalsByAspect
            aspect={selectedAspect}
            onEdit={selectedAspect && selectedAspect.member_role !== 'viewer' ? () => handleEditAspect(selectedAspect) : undefined}
            onDelete={selectedAspect && selectedAspect.member_role === 'owner' ? () => handleDeleteAspect(selectedAspect) : undefined}
            onShare={selectedAspect && selectedAspect.member_role === 'owner' ? () => setSharingAspect(selectedAspect) : undefined}
            onDescriptionUpdate={selectedAspect && selectedAspect.member_role !== 'viewer' ? (desc) => handleDescriptionUpdate(selectedAspect, desc) : undefined}
          />
        </div>
      </div>

      {/* Aspect Form Modal */}
      <AspectForm
        aspect={editingAspect}
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSave={handleSaveAspect}
      />

      <AspectShareModal
        aspect={sharingAspect}
        isOpen={!!sharingAspect}
        onClose={() => setSharingAspect(null)}
        onAspectUpdated={refreshAspects}
      />
    </div>
  )
}
