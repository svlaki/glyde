import { useState, useEffect, useMemo, useCallback } from 'react'
import { useAuth } from '../lib/authContext'
import { useCategories } from '../lib/categoryContext'
import { useRules } from '../lib/ruleContext'
import { fetchUserTasks, Task } from '../lib/taskService'
import { fetchUserGoals, Goal } from '../lib/goalService'
import { fetchUserProfile, ProfileSummary, UserProfile } from '../lib/profileService'
import { fetchConnections, Connection } from '../lib/connectionService'

export interface TaskInsights {
  allTasks: Task[]
  completedTasks: number
  pendingTasks: number
  completionRate: number
  tasksCompletedThisWeek: number
  overdueTasks: number
  highPriorityPending: number
}

export interface GoalInsights {
  allGoals: Goal[]
  activeGoals: number
  completedGoals: number
  avgProgress: number
  goalsWithBlockers: number
}

export interface AspectBreakdown {
  categoryId: string
  categoryName: string
  taskCount: number
  goalCount: number
  completedCount: number
}

export interface ProfileData {
  loading: boolean
  error: string | null
  taskInsights: TaskInsights
  goalInsights: GoalInsights
  aspectBreakdown: AspectBreakdown[]
  profileSummary: ProfileSummary | null
  profile: UserProfile | null
  connections: Connection[]
  refreshProfile: () => void
}

const emptyTaskInsights: TaskInsights = {
  allTasks: [],
  completedTasks: 0,
  pendingTasks: 0,
  completionRate: 0,
  tasksCompletedThisWeek: 0,
  overdueTasks: 0,
  highPriorityPending: 0,
}

const emptyGoalInsights: GoalInsights = {
  allGoals: [],
  activeGoals: 0,
  completedGoals: 0,
  avgProgress: 0,
  goalsWithBlockers: 0,
}

export function useProfileData(): ProfileData {
  const { user, session } = useAuth()
  const { categories, getCategoryColor } = useCategories()
  const { rules } = useRules()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [profileSummary, setProfileSummary] = useState<ProfileSummary | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [connections, setConnections] = useState<Connection[]>([])

  useEffect(() => {
    if (!user || !session) {
      setLoading(false)
      return
    }

    let cancelled = false

    async function loadAll() {
      setLoading(true)
      setError(null)

      try {
        const [tasksResult, goalsResult, profileResult, connectionsResult] = await Promise.all([
          fetchUserTasks(user!, session!.access_token, {}),
          fetchUserGoals(user!, session!.access_token, {}),
          fetchUserProfile(user!, session!.access_token),
          fetchConnections(user!, session!.access_token),
        ])

        if (cancelled) return

        if (tasksResult.error || goalsResult.error || profileResult.error) {
          setError(tasksResult.error || goalsResult.error || profileResult.error)
        }

        setTasks(tasksResult.tasks || [])
        setGoals(goalsResult.goals || [])
        setProfileSummary(profileResult.summary || null)
        setProfile(profileResult.profile || null)
        setConnections(connectionsResult.connections || [])
      } catch (err) {
        if (!cancelled) {
          setError('Failed to load profile data')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadAll()

    return () => {
      cancelled = true
    }
  }, [user, session])

  const refreshProfile = useCallback(async () => {
    if (!user || !session) return
    try {
      const profileResult = await fetchUserProfile(user, session.access_token)
      setProfileSummary(profileResult.summary || null)
      setProfile(profileResult.profile || null)
    } catch {
      // refresh is best-effort, profile data remains stale on failure
    }
  }, [user, session])

  const taskInsights = useMemo<TaskInsights>(() => {
    if (tasks.length === 0) return emptyTaskInsights

    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const completedTasks = tasks.filter(t => t.status === 'completed').length
    const pendingTasks = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length
    const total = completedTasks + pendingTasks
    const completionRate = total > 0 ? Math.round((completedTasks / total) * 100) : 0

    const tasksCompletedThisWeek = tasks.filter(t => {
      if (t.status !== 'completed' || !t.completed_at) return false
      return new Date(t.completed_at) >= weekAgo
    }).length

    const overdueTasks = tasks.filter(t => {
      if (t.status === 'completed' || t.status === 'cancelled') return false
      if (!t.due_date) return false
      return new Date(t.due_date) < now
    }).length

    const highPriorityPending = tasks.filter(t => {
      if (t.status === 'completed' || t.status === 'cancelled') return false
      return t.priority === 'high' || t.priority === 'urgent'
    }).length

    return {
      allTasks: tasks,
      completedTasks,
      pendingTasks,
      completionRate,
      tasksCompletedThisWeek,
      overdueTasks,
      highPriorityPending,
    }
  }, [tasks])

  const goalInsights = useMemo<GoalInsights>(() => {
    if (goals.length === 0) return emptyGoalInsights

    const activeGoals = goals.filter(g => g.status === 'in_progress' || g.status === 'not_started').length
    const completedGoals = goals.filter(g => g.status === 'completed').length

    const goalsWithProgress = goals.filter(g => typeof g.progress === 'number')
    const avgProgress = goalsWithProgress.length > 0
      ? Math.round(goalsWithProgress.reduce((sum, g) => sum + (g.progress || 0), 0) / goalsWithProgress.length)
      : 0

    const goalsWithBlockers = goals.filter(g => g.blockers && g.blockers.length > 0).length

    return {
      allGoals: goals,
      activeGoals,
      completedGoals,
      avgProgress,
      goalsWithBlockers,
    }
  }, [goals])

  const aspectBreakdown = useMemo<AspectBreakdown[]>(() => {
    const breakdownMap = new Map<string, AspectBreakdown>()

    for (const cat of categories) {
      breakdownMap.set(cat.id, {
        categoryId: cat.id,
        categoryName: cat.name,
        taskCount: 0,
        goalCount: 0,
        completedCount: 0,
      })
    }

    for (const task of tasks) {
      const catId = task.category_id
      if (catId && breakdownMap.has(catId)) {
        const entry = breakdownMap.get(catId)!
        breakdownMap.set(catId, {
          ...entry,
          taskCount: entry.taskCount + 1,
          completedCount: task.status === 'completed' ? entry.completedCount + 1 : entry.completedCount,
        })
      }
    }

    for (const goal of goals) {
      const matchedCat = categories.find(c => c.name === goal.category)
      if (matchedCat && breakdownMap.has(matchedCat.id)) {
        const entry = breakdownMap.get(matchedCat.id)!
        breakdownMap.set(matchedCat.id, {
          ...entry,
          goalCount: entry.goalCount + 1,
        })
      }
    }

    return Array.from(breakdownMap.values())
      .sort((a, b) => (b.taskCount + b.goalCount) - (a.taskCount + a.goalCount))
  }, [tasks, goals, categories])

  return {
    loading,
    error,
    taskInsights,
    goalInsights,
    aspectBreakdown,
    profileSummary,
    profile,
    connections,
    refreshProfile,
  }
}
