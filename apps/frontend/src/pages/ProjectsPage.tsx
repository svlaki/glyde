import { useState, useEffect } from 'react'
import { useAuth } from '../lib/authContext'
import { useTheme } from '../lib/themeContext'
import { useProjects } from '../lib/projectContext'
import { createUserProject, updateUserProject, archiveUserProject, deleteUserProject } from '../lib/projectService'
import type { Project } from '../lib/projectService'
import type { ProjectFormData } from '../components/ProjectForm'
import { ProjectCard } from '../components/ProjectCard'
import { ProjectForm } from '../components/ProjectForm'
import { ProjectDetailPanel } from '../components/ProjectDetailPanel'
import { EmptyState } from '../components/EmptyState'
import { VerticalSidebar, SIDEBAR_WIDTH } from '../components/VerticalSidebar'
import { getColors } from '../styles/colors'
import { getTypography } from '../styles/typography'
import { usePlatform } from '../hooks/usePlatform'
import { MobileHeader } from '../components/mobile/MobileHeader'
import { mobileStyles } from '../styles/mobileStyles'

export function ProjectsPage() {
  const { isMobile } = usePlatform()

  if (isMobile) {
    return <ProjectsPageMobile />
  }

  return <ProjectsPageDesktop />
}

function ProjectsPageMobile() {
  const { user, session } = useAuth()
  const { theme, isDarkMode } = useTheme()
  const colors = getColors(theme)
  const { projects, loading, error, refreshProjects } = useProjects()
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | undefined>(undefined)

  // Keep selectedProject in sync with refreshed data
  useEffect(() => {
    if (selectedProject) {
      const updated = projects.find(p => p.id === selectedProject.id)
      if (updated) {
        setSelectedProject(updated)
      } else {
        setSelectedProject(null)
      }
    }
  }, [projects])

  const handleCreate = () => {
    setEditingProject(undefined)
    setIsFormOpen(true)
  }

  const handleEdit = (project: Project) => {
    setEditingProject(project)
    setIsFormOpen(true)
  }

  const handleDelete = async (project: Project) => {
    if (!user || !session) return
    try {
      await deleteUserProject(user, project.id, session.access_token)
      if (selectedProject?.id === project.id) {
        setSelectedProject(null)
      }
      await refreshProjects()
    } catch {
      alert('Failed to delete project.')
    }
  }

  const handleArchive = async (project: Project) => {
    if (!user || !session) return
    try {
      await archiveUserProject(user, project.id, session.access_token)
      if (selectedProject?.id === project.id) {
        setSelectedProject(null)
      }
      await refreshProjects()
    } catch {
      alert('Failed to archive project.')
    }
  }

  const handleSave = async (data: ProjectFormData) => {
    if (!user || !session) return
    try {
      if (data.id) {
        const { id, ...updates } = data
        await updateUserProject(user, id, updates, session.access_token)
      } else {
        await createUserProject(user, data, session.access_token)
      }
      await refreshProjects()
      setIsFormOpen(false)
    } catch (err) {
      throw err
    }
  }

  // Detail view
  if (selectedProject) {
    return (
      <div style={mobileStyles.fullHeight}>
        <MobileHeader
          title={selectedProject.name}
          onBack={() => setSelectedProject(null)}
        />
        <div style={{
          ...mobileStyles.scrollContainer,
          background: colors.bgPrimary,
          paddingBottom: 'calc(20px + env(safe-area-inset-bottom))'
        }}>
          <ProjectDetailPanel
            project={selectedProject}
            onEdit={() => handleEdit(selectedProject)}
            onDelete={() => handleDelete(selectedProject)}
            onArchive={() => handleArchive(selectedProject)}
          />
        </div>

        <ProjectForm
          project={editingProject}
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          onSave={handleSave}
        />
      </div>
    )
  }

  // List view
  return (
    <div style={mobileStyles.fullHeight}>
      <MobileHeader
        title="Projects"
        showMenu={true}
        actions={
          <button
            onClick={handleCreate}
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
            Loading projects...
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
        ) : projects.length === 0 ? (
          <EmptyState
            title="No projects yet"
            description="Create your first project to organize tasks and events"
          />
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            {projects.map(project => (
              <ProjectCard
                key={project.id}
                project={project}
                isSelected={false}
                onClick={() => setSelectedProject(project)}
              />
            ))}
          </div>
        )}
      </div>

      <ProjectForm
        project={editingProject}
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSave={handleSave}
      />
    </div>
  )
}

function ProjectsPageDesktop() {
  const { user, session } = useAuth()
  const { theme, isDarkMode } = useTheme()
  const colors = getColors(theme)
  const typography = getTypography(false)
  const { projects, loading, error, refreshProjects } = useProjects()
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | undefined>(undefined)

  // Auto-select first project or keep selectedProject in sync after refresh
  useEffect(() => {
    if (!selectedProject && projects.length > 0) {
      setSelectedProject(projects[0])
    } else if (selectedProject) {
      const updated = projects.find(p => p.id === selectedProject.id)
      if (updated) {
        setSelectedProject(updated)
      } else if (projects.length > 0) {
        setSelectedProject(projects[0])
      } else {
        setSelectedProject(null)
      }
    }
  }, [projects])

  const handleCreate = () => {
    setEditingProject(undefined)
    setIsFormOpen(true)
  }

  const handleEdit = (project: Project) => {
    setEditingProject(project)
    setIsFormOpen(true)
  }

  const handleDelete = async (project: Project) => {
    if (!user || !session) return
    try {
      await deleteUserProject(user, project.id, session.access_token)
      if (selectedProject?.id === project.id) {
        setSelectedProject(null)
      }
      await refreshProjects()
    } catch {
      alert('Failed to delete project.')
    }
  }

  const handleArchive = async (project: Project) => {
    if (!user || !session) return
    try {
      await archiveUserProject(user, project.id, session.access_token)
      if (selectedProject?.id === project.id) {
        setSelectedProject(null)
      }
      await refreshProjects()
    } catch {
      alert('Failed to archive project.')
    }
  }

  const handleSave = async (data: ProjectFormData) => {
    if (!user || !session) return
    try {
      if (data.id) {
        const { id, ...updates } = data
        await updateUserProject(user, id, updates, session.access_token)
      } else {
        await createUserProject(user, data, session.access_token)
      }
      await refreshProjects()
      setIsFormOpen(false)
    } catch (err) {
      throw err
    }
  }

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      overflow: 'hidden',
      background: colors.bgPrimary
    }}>
      <VerticalSidebar />

      <div style={{
        flex: 1,
        display: 'flex',
        overflow: 'hidden',
        minHeight: 0,
        marginLeft: `${SIDEBAR_WIDTH}px`,
      }}>
        {/* Left Sidebar - Projects List */}
        <div style={{
          width: '350px',
          borderRight: `1px solid ${colors.border}`,
          background: colors.bgPrimary,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {/* Sidebar Header */}
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
                Projects
              </h2>
              <button
                onClick={handleCreate}
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

          {/* Projects List */}
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
                Loading projects...
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
            ) : projects.length === 0 ? (
              <EmptyState
                title="No projects yet"
                description="Create your first project to organize tasks and events"
              />
            ) : (
              projects.map(project => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  isSelected={selectedProject?.id === project.id}
                  onClick={() => setSelectedProject(project)}
                />
              ))
            )}
          </div>
        </div>

        {/* Right Content - Project Detail */}
        <div style={{
          flex: 1,
          overflow: 'auto',
        }}>
          <ProjectDetailPanel
            project={selectedProject}
            onEdit={selectedProject ? () => handleEdit(selectedProject) : undefined}
            onDelete={selectedProject ? () => handleDelete(selectedProject) : undefined}
            onArchive={selectedProject ? () => handleArchive(selectedProject) : undefined}
          />
        </div>
      </div>

      <ProjectForm
        project={editingProject}
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSave={handleSave}
      />
    </div>
  )
}
