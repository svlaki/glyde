import { useState } from 'react'
import { useAuth } from '../lib/authContext'
import { useDarkMode } from '../lib/darkModeContext'
import { useCategories } from '../lib/categoryContext'
import { createUserCategory, updateUserCategory, deleteUserCategory, Category } from '../lib/categoryService'
import { PageHeader } from '../components/PageHeader'
import { AspectCard } from '../components/AspectCard'
import { AspectForm } from '../components/AspectForm'
import { GoalsByAspect } from '../components/GoalsByAspect'
import { EmptyState } from '../components/EmptyState'
import { getColors } from '../styles/colors'
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
          <GoalsByAspect aspect={selectedAspect} />
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
              padding: '8px 16px',
              fontSize: '14px',
              minHeight: '44px'
            }}
          >
            +
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
        <p style={{
          fontSize: '14px',
          color: colors.textSecondary,
          margin: '0 0 20px 0'
        }}>
          Organize the aspects of your life
        </p>

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
      flexDirection: 'column',
      overflow: 'hidden',
      background: colors.bgSecondary
    }}>
      {/* Header */}
      <PageHeader />

      {/* Main Content */}
      <div style={{
        flex: 1,
        display: 'flex',
        overflow: 'hidden',
        minHeight: 0
      }}>
        {/* Left Sidebar - Aspects List */}
        <div style={{
          width: '350px',
          borderRight: `1px solid ${colors.border}`,
          background: colors.bgSecondary,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {/* Sidebar Header */}
          <div style={{
            padding: '20px',
            borderBottom: `1px solid ${colors.border}`,
            background: colors.bgSecondary
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '8px'
            }}>
              <h2 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: colors.textPrimary,
                margin: 0
              }}>
                Aspects
              </h2>
              <button
                onClick={handleCreateAspect}
                className="btn btn-primary"
                style={{
                  padding: '8px 16px',
                  fontSize: '13px'
                }}
              >
                +
              </button>
            </div>
            <p style={{
              fontSize: '13px',
              color: colors.textSecondary,
              margin: 0
            }}>
              Organize the aspects of your life
            </p>
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
          <GoalsByAspect aspect={selectedAspect} />
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
