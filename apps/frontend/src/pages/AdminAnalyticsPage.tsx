import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../lib/authContext'
import { useTheme } from '../lib/themeContext'
import { getColors } from '../styles/colors'
import {
  ThemedAreaChart,
  ThemedStackedAreaChart,
  ThemedBarChart,
  ThemedLineChart,
  ThemedPieChart,
  ThemedRetentionBarChart,
} from '../components/charts/AnalyticsCharts'

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

interface ContextData {
  totals: {
    input_tokens: number
    output_tokens: number
    total_tokens: number
    total_interactions: number
    avg_tokens_per_interaction: number
    avg_processing_time_ms: number
    est_cost: number
  }
  daily_usage: { date: string; input_tokens: number; output_tokens: number }[]
  top_users: { user_id: string; display_name: string; total_tokens: number }[]
}

type Tab = 'overview' | 'engagement' | 'agents' | 'users' | 'retention' | 'context'

const ADMIN_USER_IDS = (import.meta.env.VITE_ADMIN_USER_IDS || '').split(',').filter(Boolean)

export function AdminAnalyticsPage() {
  const { session, user } = useAuth()
  const { theme } = useTheme()
  const colors = getColors(theme)

  const isAdmin = !!user && ADMIN_USER_IDS.includes(user.id)

  const [tab, setTab] = useState<Tab>('overview')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [engagement, setEngagement] = useState<EngagementData | null>(null)
  const [agents, setAgents] = useState<AgentData | null>(null)
  const [users, setUsers] = useState<UserRow[]>([])
  const [retention, setRetention] = useState<Record<string, RetentionBucket> | null>(null)
  const [contextData, setContextData] = useState<ContextData | null>(null)

  // Timeseries data
  const [overviewTimeseries, setOverviewTimeseries] = useState<{ date: string; dau: number }[] | null>(null)
  const [agentsTimeseries, setAgentsTimeseries] = useState<{ date: string; responded: number; dismissed: number; chat_messages: number }[] | null>(null)
  const [engagementTimeseries, setEngagementTimeseries] = useState<{ date: string; page_views: number; sessions: number }[] | null>(null)

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
          const [data, ts] = await Promise.all([
            fetchData('overview'),
            fetchData('overview-timeseries'),
          ])
          if (data) setOverview(data)
          if (ts) setOverviewTimeseries(ts.timeseries)
          break
        }
        case 'engagement': {
          const [data, ts] = await Promise.all([
            fetchData('engagement'),
            fetchData('engagement-timeseries'),
          ])
          if (data) setEngagement(data)
          if (ts) setEngagementTimeseries(ts.timeseries)
          break
        }
        case 'agents': {
          const [data, ts] = await Promise.all([
            fetchData('agents'),
            fetchData('agents-timeseries'),
          ])
          if (data) setAgents(data)
          if (ts) setAgentsTimeseries(ts.timeseries)
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
        case 'context': {
          const data = await fetchData('context')
          if (data) setContextData(data)
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
    if (isAdmin) loadTab(tab)
  }, [tab, loadTab, isAdmin])

  const resetTokenUsage = useCallback(async () => {
    if (!session) return
    if (!window.confirm('Reset all token usage tracking? This cannot be undone.')) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_URL}/api/analytics/context-reset`, {
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
      setContextData(null)
      await loadTab('context')
    } catch (err: any) {
      setError(err.message || 'Failed to reset token usage')
      setLoading(false)
    }
  }, [session, loadTab])

  // Frontend admin guard — API also enforces this server-side
  if (!isAdmin) {
    return (
      <div style={{ padding: '64px', textAlign: 'center', color: colors.textSecondary }}>
        <h2>Access Denied</h2>
        <p>You do not have permission to view this page.</p>
      </div>
    )
  }

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

  const sectionHeading: React.CSSProperties = {
    fontSize: '16px',
    fontWeight: 600,
    margin: '24px 0 12px',
  }

  const formatNum = (n: number) => n.toLocaleString()

  return (
    <div style={{ height: '100vh', overflowY: 'auto', padding: '32px', color: colors.textPrimary }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '24px' }}>Beta Analytics</h1>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {(['overview', 'engagement', 'agents', 'users', 'retention', 'context'] as Tab[]).map(t => (
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

      {/* ── Overview Tab ── */}
      {!loading && tab === 'overview' && overview && (
        <div>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' }}>
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

          {overviewTimeseries && (
            <>
              <h3 style={sectionHeading}>DAU Trend (30 days)</h3>
              <ThemedAreaChart data={overviewTimeseries} colors={colors} dataKey="dau" label="DAU" />
            </>
          )}
        </div>
      )}

      {/* ── Engagement Tab ── */}
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

          {engagementTimeseries && (
            <>
              <h3 style={sectionHeading}>Daily Page Views & Sessions</h3>
              <ThemedStackedAreaChart
                data={engagementTimeseries}
                colors={colors}
                areas={[
                  { dataKey: 'page_views', color: colors.accent, label: 'Page Views' },
                  { dataKey: 'sessions', color: colors.success, label: 'Sessions' },
                ]}
              />
            </>
          )}

          <h3 style={sectionHeading}>Page Views by Path</h3>
          <ThemedBarChart
            data={Object.entries(engagement.page_view_counts)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 15)
              .map(([name, value]) => ({ name, value }))}
            colors={colors}
            label="Views"
          />

          <h3 style={sectionHeading}>Feature Usage</h3>
          <ThemedBarChart
            data={Object.entries(engagement.feature_counts)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 15)
              .map(([name, value]) => ({ name, value }))}
            colors={colors}
            barColor={colors.success}
            label="Count"
          />
        </div>
      )}

      {/* ── Agents Tab ── */}
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

          {agentsTimeseries && (
            <>
              <h3 style={sectionHeading}>Daily Responded vs Dismissed</h3>
              <ThemedLineChart
                data={agentsTimeseries}
                colors={colors}
                lines={[
                  { dataKey: 'responded', color: colors.success, label: 'Responded' },
                  { dataKey: 'dismissed', color: colors.error, label: 'Dismissed' },
                  { dataKey: 'chat_messages', color: colors.warning, label: 'Chat Messages' },
                ]}
              />
            </>
          )}

          <h3 style={sectionHeading}>Responded vs Dismissed</h3>
          <ThemedPieChart
            data={[
              { name: 'Responded', value: agents.interactions_responded },
              { name: 'Dismissed', value: agents.interactions_dismissed },
            ]}
            colors={colors}
            pieColors={[colors.success, colors.error]}
          />
        </div>
      )}

      {/* ── Users Tab ── */}
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

      {/* ── Retention Tab ── */}
      {!loading && tab === 'retention' && retention && (
        <div>
          <h3 style={sectionHeading}>Retention Rate by Cohort</h3>
          <ThemedRetentionBarChart
            data={Object.entries(retention).map(([label, bucket]) => ({
              label,
              rate: bucket.rate,
            }))}
            colors={colors}
          />

          <table style={{ ...tableStyle, marginTop: '24px' }}>
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

      {/* ── Context Tab (Token Usage) ── */}
      {!loading && tab === 'context' && contextData && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
            <button
              onClick={resetTokenUsage}
              style={{
                padding: '8px 16px',
                background: colors.error,
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              Reset Token Tracking
            </button>
          </div>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' }}>
            <div style={cardStyle}>
              <div style={{ fontSize: '28px', fontWeight: 700 }}>{formatNum(contextData.totals.total_tokens)}</div>
              <div style={{ color: colors.textSecondary, fontSize: '13px' }}>Total Tokens (30d)</div>
            </div>
            <div style={cardStyle}>
              <div style={{ fontSize: '28px', fontWeight: 700 }}>{formatNum(contextData.totals.input_tokens)}</div>
              <div style={{ color: colors.textSecondary, fontSize: '13px' }}>Input Tokens</div>
            </div>
            <div style={cardStyle}>
              <div style={{ fontSize: '28px', fontWeight: 700 }}>{formatNum(contextData.totals.output_tokens)}</div>
              <div style={{ color: colors.textSecondary, fontSize: '13px' }}>Output Tokens</div>
            </div>
            <div style={cardStyle}>
              <div style={{ fontSize: '28px', fontWeight: 700 }}>{formatNum(contextData.totals.total_interactions)}</div>
              <div style={{ color: colors.textSecondary, fontSize: '13px' }}>Interactions</div>
            </div>
            <div style={cardStyle}>
              <div style={{ fontSize: '28px', fontWeight: 700 }}>{formatNum(contextData.totals.avg_tokens_per_interaction)}</div>
              <div style={{ color: colors.textSecondary, fontSize: '13px' }}>Avg Tokens/Interaction</div>
            </div>
            <div style={cardStyle}>
              <div style={{ fontSize: '28px', fontWeight: 700 }}>{contextData.totals.avg_processing_time_ms > 0 ? `${(contextData.totals.avg_processing_time_ms / 1000).toFixed(1)}s` : '-'}</div>
              <div style={{ color: colors.textSecondary, fontSize: '13px' }}>Avg Processing Time</div>
            </div>
            <div style={cardStyle}>
              <div style={{ fontSize: '28px', fontWeight: 700 }}>${contextData.totals.est_cost.toFixed(2)}</div>
              <div style={{ color: colors.textSecondary, fontSize: '13px' }}>Est. Cost (30d)</div>
            </div>
          </div>

          <h3 style={sectionHeading}>Daily Token Usage</h3>
          <ThemedStackedAreaChart
            data={contextData.daily_usage}
            colors={colors}
            areas={[
              { dataKey: 'input_tokens', color: colors.accent, label: 'Input Tokens' },
              { dataKey: 'output_tokens', color: colors.warning, label: 'Output Tokens' },
            ]}
          />

          {contextData.top_users.length > 0 && (
            <>
              <h3 style={sectionHeading}>Top Users by Token Consumption</h3>
              <ThemedBarChart
                data={contextData.top_users.map(u => ({
                  name: u.display_name,
                  value: u.total_tokens,
                }))}
                colors={colors}
                label="Tokens"
                barColor={colors.accent}
              />
            </>
          )}
        </div>
      )}

      {!loading && tab === 'context' && !contextData && (
        <p style={{ color: colors.textSecondary }}>No token usage data available yet. Data will appear after agent interactions occur.</p>
      )}
      </div>
    </div>
  )
}
