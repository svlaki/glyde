import { useState, useEffect } from 'react'
import { useAuth } from '../lib/authContext'
import { useDarkMode } from '../lib/darkModeContext'
import { useCategories } from '../lib/categoryContext'
import { fetchUserTasks } from '../lib/taskService'
import { fetchUserGoals } from '../lib/goalService'
import { getColors } from '../styles/colors'

interface StatsCardProps {
  label: string
  value: number
  icon: string
}

function StatsCard({ label, value, icon }: StatsCardProps) {
  const { isDarkMode } = useDarkMode()
  const colors = getColors(isDarkMode)

  return (
    <div style={{
      background: colors.bgPrimary,
      border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
      borderRadius: '6px',
      padding: '12px 8px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '4px',
      textAlign: 'center'
    }}>
      <div style={{
        fontSize: '20px',
        fontWeight: '500',
        color: colors.textPrimary
      }}>
        {value}
      </div>
      <div style={{
        fontSize: '11px',
        color: colors.textSecondary,
        fontWeight: '400'
      }}>
        {label}
      </div>
    </div>
  )
}

export function ProfileStats() {
  const { user, session } = useAuth()
  const { isDarkMode } = useDarkMode()
  const colors = getColors(isDarkMode)
  const { categories } = useCategories()
  const [stats, setStats] = useState({
    activeTasks: 0,
    activeGoals: 0,
    totalAspects: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadStats() {
      if (!user || !session) return

      setLoading(true)
      try {
        // Fetch tasks count
        const { tasks } = await fetchUserTasks(user, session.access_token, { status: 'pending' })

        // Fetch goals count
        const { goals } = await fetchUserGoals(user, session.access_token, { status: 'active' })

        setStats({
          activeTasks: tasks?.length || 0,
          activeGoals: goals?.length || 0,
          totalAspects: categories.length
        })
      } catch (error) {
        console.error('Error loading stats:', error)
      } finally {
        setLoading(false)
      }
    }

    loadStats()
  }, [user, session, categories])

  if (loading) {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        color: colors.textSecondary,
        fontSize: '14px'
      }}>
        Loading stats...
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '24px'
    }}>
      {/* Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '8px'
      }}>
        <StatsCard
          label="Active Tasks"
          value={stats.activeTasks}
          icon=""
        />
        <StatsCard
          label="Active Goals"
          value={stats.activeGoals}
          icon=""
        />
        <StatsCard
          label="Total Aspects"
          value={stats.totalAspects}
          icon=""
        />
      </div>
    </div>
  )
}
