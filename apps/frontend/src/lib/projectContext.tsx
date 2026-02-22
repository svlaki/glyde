import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useAuth } from './authContext'
import { fetchUserProjects } from './projectService'
import type { Project } from './projectService'

interface ProjectContextType {
  projects: Project[]
  loading: boolean
  error: string | null
  refreshProjects: () => Promise<void>
  getProjectById: (id: string) => Project | undefined
  getProjectByName: (name: string) => Project | undefined
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined)

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { user, session } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadProjects = async () => {
    if (!user) {
      setProjects([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const { projects: data, error: fetchError } = await fetchUserProjects(user, session?.access_token)

      if (fetchError) {
        setError(fetchError)
        setProjects([])
      } else {
        setProjects(data)
        setError(null)
      }
    } catch (err) {
      setError('Failed to load projects')
      setProjects([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProjects()
  }, [user?.id])

  const getProjectById = (id: string): Project | undefined => {
    return projects.find(p => p.id === id)
  }

  const getProjectByName = (name: string): Project | undefined => {
    return projects.find(p => p.name.toLowerCase() === name.toLowerCase())
  }

  const value: ProjectContextType = {
    projects,
    loading,
    error,
    refreshProjects: loadProjects,
    getProjectById,
    getProjectByName
  }

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  )
}

export function useProjects(): ProjectContextType {
  const context = useContext(ProjectContext)
  if (context === undefined) {
    throw new Error('useProjects must be used within a ProjectProvider')
  }
  return context
}

export type { Project } from './projectService'
