import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../lib/authContext'
import { useTheme } from '../lib/themeContext'
import { getColors } from '../styles/colors'

const API_URL = import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000'

interface OverviewData {
  dau: number
  wau: number
  mau: number
  total_users: number
}

interface EngagementData {
  total_page_views: number
  total_sessions: number
  page_view_counts: Record<string, number>
  feature_counts: Record<string, number>
}

interface AgentData {
  interactions_responded: number
  interactions_dismissed: number
  interaction_total: number
  acceptance_rate: number
  chat_messages_sent: number
}

interface UserRow {
  id: string
  display_name: string
  email: string
  signed_up: string
  last_active: string | null
  total_events: number
  sessions_30d: number
  page_views_30d: number
}

interface RetentionBucket {
  total: number
  retained: number
  rate: number
}

type Tab = 'overview' | 'engagement' | 'agents' | 'users' | 'retention'

const ADMIN_USER_IDS = (import.meta.env.VITE_ADMIN_USER_IDS || '').split(',').filter(Boolean)

export function AdminAnalyticsPage() {
  const { session, user } = useAuth()
  const { theme } = useTheme()
  const colors = getColors(theme)

  // Frontend admin guard — API also enforces this server-side
  if (!user || !ADMIN_USER_IDS.includes(user.id)) {
    return (
      <div style={{ padding: '64px', textAlign: 'center', color: colors.textSecondary }}>
        <h2>Access Denied</h2>
        <p>You do not have permission to view this page.</p>
      </div>
    )
  }

  const [tab, setTab] = useState<Tab>('overview')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [engagement, setEngagement] = useState<EngagementData | null>(null)
  const [agents, setAgents] = useState<AgentData | null>(null)
  const [users, setUsers] = useState<UserRow[]>([])
  const [retention, setRetention] = useState<Record<string, RetentionBucket> | null>(null)

  const fetchData = useCallback(async (endpoint: string) => {
    if (!session) return null
    const res = await fetch(`${API_URL}/api/analytics/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error || `HTTP ${res.status}`)
    }
    const json = await res.json()
    return json.data
  }, [session])

  const loadTab = useCallback(async (t: Tab) => {
    setLoading(true)
    setError(null)
    try {
      switch (t) {
        case 'overview': {
          const data = await fetchData('overview')
          if (data) setOverview(data)
          break
        }
        case 'engagement': {
          const data = await fetchData('engagement')
          if (data) setEngagement(data)
          break
        }
        case 'agents': {
          const data = await fetchData('agents')
          if (data) setAgents(data)
          break
        }
        case 'users': {
          const data = await fetchData('users')
          if (data) setUsers(data.users)
          break
        }
        case 'retention': {
          const data = await fetchData('retention')
          if (data) setRetention(data.retention)
          break
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [fetchData])

  useEffect(() => {
    loadTab(tab)
  }, [tab, loadTab])

  const cardStyle: React.CSSProperties = {
    background: colors.bgSecondary,
    border: `1px solid ${colors.border}`,
    borderRadius: '12px',
    padding: '20px',
    minWidth: '140px',
    textAlign: 'center' as const,
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 16px',
    background: active ? colors.accent : 'transparent',
    color: active ? '#fff' : colors.textPrimary,
    border: `1px solid ${active ? colors.accent : colors.border}`,
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: active ? 600 : 400,
  })

  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '13px',
  }

  const thStyle: React.CSSProperties = {
    textAlign: 'left' as const,
    padding: '8px 12px',
    borderBottom: `2px solid ${colors.border}`,
    color: colors.textSecondary,
    fontWeight: 600,
  }

  const tdStyle: React.CSSProperties = {
    padding: '8px 12px',
    borderBottom: `1px solid ${colors.border}`,
    color: colors.textPrimary,
  }

  return (
    <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto', color: colors.textPrimary }}>
      <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '24px' }}>Beta Analytics</h1>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {(['overview', 'engagement', 'agents', 'users', 'retention'] as Tab[]).map(t => (
          <button key={t} style={tabStyle(tab === t)} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ padding: '12px', background: '#fee2e2', color: '#b91c1c', borderRadius: '8px', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {loading && <p style={{ color: colors.textSecondary }}>Loading...</p>}

      {!loading && tab === 'overview' && overview && (
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div style={cardStyle}>
            <div style={{ fontSize: '32px', fontWeight: 700 }}>{overview.total_users}</div>
            <div style={{ color: colors.textSecondary, fontSize: '13px' }}>Total Users</div>
          </div>
          <div style={cardStyle}>
            <div style={{ fontSize: '32px', fontWeight: 700 }}>{overview.dau}</div>
            <div style={{ color: colors.textSecondary, fontSize: '13px' }}>Daily Active Users</div>
          </div>
          <div style={cardStyle}>
            <div style={{ fontSize: '32px', fontWeight: 700 }}>{overview.wau}</div>
            <div style={{ color: colors.textSecondary, fontSize: '13px' }}>Weekly Active Users</div>
          </div>
          <div style={cardStyle}>
            <div style={{ fontSize: '32px', fontWeight: 700 }}>{overview.mau}</div>
            <div style={{ color: colors.textSecondary, fontSize: '13px' }}>Monthly Active Users</div>
          </div>
        </div>
      )}

      {!loading && tab === 'engagement' && engagement && (
        <div>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' }}>
            <div style={cardStyle}>
              <div style={{ fontSize: '32px', fontWeight: 700 }}>{engagement.total_sessions}</div>
              <div style={{ color: colors.textSecondary, fontSize: '13px' }}>Sessions (30d)</div>
            </div>
            <div style={cardStyle}>
              <div style={{ fontSize: '32px', fontWeight: 700 }}>{engagement.total_page_views}</div>
              <div style={{ color: colors.textSecondary, fontSize: '13px' }}>Page Views (30d)</div>
            </div>
          </div>

          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>Page Views by Path</h3>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Path</th>
                <th style={thStyle}>Views</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(engagement.page_view_counts)
                .sort(([, a], [, b]) => b - a)
                .map(([path, count]) => (
                  <tr key={path}>
                    <td style={tdStyle}>{path}</td>
                    <td style={tdStyle}>{count}</td>
                  </tr>
                ))}
            </tbody>
          </table>

          <h3 style={{ fontSize: '16px', fontWeight: 600, margin: '24px 0 12px' }}>Feature Usage</h3>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Event</th>
                <th style={thStyle}>Count</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(engagement.feature_counts)
                .sort(([, a], [, b]) => b - a)
                .map(([name, count]) => (
                  <tr key={name}>
                    <td style={tdStyle}>{name}</td>
                    <td style={tdStyle}>{count}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && tab === 'agents' && agents && (
        <div>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' }}>
            <div style={cardStyle}>
              <div style={{ fontSize: '32px', fontWeight: 700 }}>{agents.acceptance_rate}%</div>
              <div style={{ color: colors.textSecondary, fontSize: '13px' }}>Acceptance Rate</div>
            </div>
            <div style={cardStyle}>
              <div style={{ fontSize: '32px', fontWeight: 700 }}>{agents.interactions_responded}</div>
              <div style={{ color: colors.textSecondary, fontSize: '13px' }}>Responded</div>
            </div>
            <div style={cardStyle}>
              <div style={{ fontSize: '32px', fontWeight: 700 }}>{agents.interactions_dismissed}</div>
              <div style={{ color: colors.textSecondary, fontSize: '13px' }}>Dismissed</div>
            </div>
            <div style={cardStyle}>
              <div style={{ fontSize: '32px', fontWeight: 700 }}>{agents.chat_messages_sent}</div>
              <div style={{ color: colors.textSecondary, fontSize: '13px' }}>Chat Messages (30d)</div>
            </div>
          </div>
        </div>
      )}

      {!loading && tab === 'users' && users.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Email</th>
                <th style={thStyle}>Signed Up</th>
                <th style={thStyle}>Last Active</th>
                <th style={thStyle}>Events (30d)</th>
                <th style={thStyle}>Sessions (30d)</th>
                <th style={thStyle}>Pages (30d)</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td style={tdStyle}>{u.display_name || '-'}</td>
                  <td style={tdStyle}>{u.email || '-'}</td>
                  <td style={tdStyle}>{u.signed_up ? new Date(u.signed_up).toLocaleDateString() : '-'}</td>
                  <td style={tdStyle}>{u.last_active ? new Date(u.last_active).toLocaleDateString() : 'Never'}</td>
                  <td style={tdStyle}>{u.total_events}</td>
                  <td style={tdStyle}>{u.sessions_30d}</td>
                  <td style={tdStyle}>{u.page_views_30d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && tab === 'retention' && retention && (
        <div>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Cohort Day</th>
                <th style={thStyle}>Eligible Users</th>
                <th style={thStyle}>Retained</th>
                <th style={thStyle}>Rate</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(retention).map(([day, bucket]) => (
                <tr key={day}>
                  <td style={tdStyle}>{day}</td>
                  <td style={tdStyle}>{bucket.total}</td>
                  <td style={tdStyle}>{bucket.retained}</td>
                  <td style={tdStyle}>{bucket.rate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
