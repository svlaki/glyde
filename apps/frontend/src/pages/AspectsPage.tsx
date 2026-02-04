import { useState, useEffect } from 'react'
import { useAuth } from '../lib/authContext'
import { useDarkMode } from '../lib/darkModeContext'
import { useCategories } from '../lib/categoryContext'
import { createUserCategory, updateUserCategory, deleteUserCategory, Category } from '../lib/categoryService'
import { AspectCard } from '../components/AspectCard'
import { AspectForm } from '../components/AspectForm'
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
  const { isDarkMode } = useDarkMode()
  const colors = getColors(isDarkMode)
  const { categories, loading, error, refreshCategories } = useCategories()
  const [selectedAspect, setSelectedAspect] = useState<Category | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingAspect, setEditingAspect] = useState<Category | undefined>(undefined)

  const handleCreateAspect = () => {
    setEditingAspect(undefined)
    setIsFormOpen(true)
  }

  const handleEditAspect = (aspect: Category) => {
    setEditingAspect(aspect)
    setIsFormOpen(true)
  }

  const handleDeleteAspect = async (aspect: Category) => {
    if (!user || !session) return

    try {
      await deleteUserCategory(user, aspect.id!, session.access_token)
      if (selectedAspect?.id === aspect.id) {
        setSelectedAspect(null)
      }
      await refreshCategories()
    } catch (error) {
      console.error('Error deleting aspect:', error)
      alert('Failed to delete aspect. Please try again.')
    }
  }

  const handleSaveAspect = async (aspectData: Partial<Category>) => {
    if (!user || !session) return

    try {
      if (aspectData.id) {
        const { id, ...updates } = aspectData
        await updateUserCategory(user, id, updates, session.access_token)
      } else {
        await createUserCategory(user, aspectData as any, session.access_token)
      }
      await refreshCategories()
      setIsFormOpen(false)
    } catch (error) {
      console.error('Error saving aspect:', error)
      throw error
    }
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
            onEdit={() => handleEditAspect(selectedAspect)}
            onDelete={() => handleDeleteAspect(selectedAspect)}
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
        ) : categories.length === 0 ? (
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
            {categories.map(aspect => (
              <AspectCard
                key={aspect.id}
                aspect={aspect}
                isSelected={false}
                onClick={() => setSelectedAspect(aspect)}
                onEdit={() => handleEditAspect(aspect)}
                onDelete={() => handleDeleteAspect(aspect)}
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
    </div>
  )
}

function AspectsPageDesktop() {
  const { user, session } = useAuth()
  const { isDarkMode } = useDarkMode()
  const colors = getColors(isDarkMode)
  const typography = getTypography(false)
  const { categories, loading, error, refreshCategories } = useCategories()
  const [selectedAspect, setSelectedAspect] = useState<Category | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingAspect, setEditingAspect] = useState<Category | undefined>(undefined)

  // Auto-select first aspect when categories load
  useEffect(() => {
    if (!selectedAspect && categories.length > 0) {
      setSelectedAspect(categories[0])
    }
  }, [categories, selectedAspect])

  const handleCreateAspect = () => {
    setEditingAspect(undefined)
    setIsFormOpen(true)
  }

  const handleEditAspect = (aspect: Category) => {
    setEditingAspect(aspect)
    setIsFormOpen(true)
  }

  const handleDeleteAspect = async (aspect: Category) => {
    if (!user || !session) return

    try {
      await deleteUserCategory(user, aspect.id!, session.access_token)
      if (selectedAspect?.id === aspect.id) {
        setSelectedAspect(null)
      }
      await refreshCategories()
    } catch (error) {
      console.error('Error deleting aspect:', error)
      alert('Failed to delete aspect. Please try again.')
    }
  }

  const handleSaveAspect = async (aspectData: Partial<Category>) => {
    if (!user || !session) return

    try {
      if (aspectData.id) {
        // Update existing aspect - destructure id out of updates
        const { id, ...updates } = aspectData
        await updateUserCategory(user, id, updates, session.access_token)
      } else {
        // Create new aspect
        await createUserCategory(user, aspectData as any, session.access_token)
      }
      await refreshCategories()
      setIsFormOpen(false)
    } catch (error) {
      console.error('Error saving aspect:', error)
      throw error
    }
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
            ) : categories.length === 0 ? (
              <EmptyState
                title="No aspects yet"
                description="Create your first aspect to get started"
              />
            ) : (
              categories.map(aspect => (
                <AspectCard
                  key={aspect.id}
                  aspect={aspect}
                  isSelected={selectedAspect?.id === aspect.id}
                  onClick={() => setSelectedAspect(aspect)}
                  onEdit={() => handleEditAspect(aspect)}
                  onDelete={() => handleDeleteAspect(aspect)}
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
            onEdit={selectedAspect ? () => handleEditAspect(selectedAspect) : undefined}
            onDelete={selectedAspect ? () => handleDeleteAspect(selectedAspect) : undefined}
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
    </div>
  )
}
