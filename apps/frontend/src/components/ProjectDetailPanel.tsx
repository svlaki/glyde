import { useState, useEffect } from 'react'
import { useAuth } from '../lib/authContext'
import { useTheme } from '../lib/themeContext'
import { fetchProjectDetail, tagEntityToProject } from '../lib/projectService'
import type { Project, ProjectDetail } from '../lib/projectService'
import { getColors, hexToRgba } from '../styles/colors'
import { fontSize, fontWeight, lineHeight } from '../styles/typography'
import { EditButton, DeleteButton } from './ui/IconButtons'

interface ProjectDetailPanelProps {
  project: Project | null
  onEdit?: () => void
  onDelete?: () => void
  onArchive?: () => void
}

export function ProjectDetailPanel({ project, onEdit, onDelete, onArchive }: ProjectDetailPanelProps) {
  const { user, session } = useAuth()
  const { theme, isDarkMode } = useTheme()
  const colors = getColors(theme)
  const [detail, setDetail] = useState<ProjectDetail | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!project || !user || !session) {
      setDetail(null)
      return
    }

    const loadDetail = async () => {
      setLoading(true)
      try {
        const { detail: data } = await fetchProjectDetail(user, project.id, session.access_token)
        setDetail(data)
      } catch {
        setDetail(null)
      } finally {
        setLoading(false)
      }
    }

    loadDetail()
  }, [project?.id, user?.id])

  const handleUnlinkTask = async (taskId: string) => {
    if (!user || !session) return
    try {
      const { error } = await tagEntityToProject(user, 'task', taskId, null, session.access_token)
      if (error) return
      if (project) {
        const { detail: data } = await fetchProjectDetail(user, project.id, session.access_token)
        setDetail(data)
      }
    } catch {
      // Network error - silently fail
    }
  }

  const handleUnlinkEvent = async (eventId: string) => {
    if (!user || !session) return
    try {
      const { error } = await tagEntityToProject(user, 'event', eventId, null, session.access_token)
      if (error) return
      if (project) {
        const { detail: data } = await fetchProjectDetail(user, project.id, session.access_token)
        setDetail(data)
      }
    } catch {
      // Network error - silently fail
    }
  }

  if (!project) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: colors.textTertiary,
        fontSize: fontSize.base,
      }}>
        Select a project to view details
      </div>
    )
  }

  const projectColor = project.aspect_color || '#999'
  const deadlineStr = project.deadline
    ? new Date(project.deadline).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
    : null

  return (
    <div style={{ padding: '30px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: '24px'
      }}>
        <div style={{ flex: 1 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '8px'
          }}>
            <h2 style={{
              fontSize: fontSize['2xl'],
              fontWeight: fontWeight.bold,
              color: colors.textPrimary,
              margin: 0,
              fontFamily: "'EB Garamond', Georgia, serif"
            }}>
              {project.name}
            </h2>
            {project.aspect_name && (
              <span style={{
                padding: '2px 10px',
                borderRadius: '6px',
                background: hexToRgba(projectColor, 0.15),
                color: projectColor,
                fontSize: fontSize.xs,
                fontWeight: fontWeight.medium,
              }}>
                {project.aspect_name}
              </span>
            )}
          </div>
          {project.description && (
            <p style={{
              fontSize: fontSize.base,
              color: colors.textSecondary,
              lineHeight: lineHeight.relaxed,
              margin: '0 0 8px 0'
            }}>
              {project.description}
            </p>
          )}
          {deadlineStr && (
            <span style={{
              fontSize: fontSize.sm,
              color: colors.textTertiary,
            }}>
              Deadline: {deadlineStr}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0, marginLeft: '16px' }}>
          {onEdit && <EditButton onClick={(e) => { e.stopPropagation(); onEdit() }} />}
          {onArchive && (
            <button
              onClick={(e) => { e.stopPropagation(); onArchive() }}
              title="Archive"
              style={{
                width: '36px',
                height: '36px',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: colors.bgTertiary,
                color: colors.textSecondary,
                border: `1px solid ${colors.border}`,
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.15s',
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
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="21 8 21 21 3 21 3 8" />
                <rect x="1" y="3" width="22" height="5" />
                <line x1="10" y1="12" x2="14" y2="12" />
              </svg>
            </button>
          )}
          {onDelete && <DeleteButton onClick={(e) => { e.stopPropagation(); onDelete() }} />}
        </div>
      </div>

      {loading ? (
        <div style={{ color: colors.textSecondary, fontSize: fontSize.sm }}>
          Loading project details...
        </div>
      ) : (
        <>
          {/* Tasks Section */}
          <SectionHeader title="Tasks" count={detail?.tasks?.length || 0} colors={colors} />
          {detail?.tasks && detail.tasks.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '32px' }}>
              {detail.tasks.map((task: any) => (
                <EntityRow
                  key={task.id}
                  title={task.title}
                  subtitle={task.status === 'completed' ? 'Completed' : task.due_date ? `Due: ${new Date(task.due_date).toLocaleDateString()}` : undefined}
                  status={task.status}
                  colors={colors}
                  isDarkMode={isDarkMode}
                  onUnlink={() => handleUnlinkTask(task.id)}
                />
              ))}
            </div>
          ) : (
            <div style={{
              padding: '20px',
              textAlign: 'center',
              color: colors.textTertiary,
              fontSize: fontSize.sm,
              marginBottom: '32px',
              background: isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
              borderRadius: '8px'
            }}>
              No tasks linked to this project yet
            </div>
          )}

          {/* Events Section */}
          <SectionHeader title="Events" count={detail?.events?.length || 0} colors={colors} />
          {detail?.events && detail.events.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '32px' }}>
              {detail.events.map((event: any) => (
                <EntityRow
                  key={event.id}
                  title={event.title}
                  subtitle={event.start_time ? new Date(event.start_time).toLocaleString(undefined, {
                    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                  }) : undefined}
                  colors={colors}
                  isDarkMode={isDarkMode}
                  onUnlink={() => handleUnlinkEvent(event.id)}
                />
              ))}
            </div>
          ) : (
            <div style={{
              padding: '20px',
              textAlign: 'center',
              color: colors.textTertiary,
              fontSize: fontSize.sm,
              marginBottom: '32px',
              background: isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
              borderRadius: '8px'
            }}>
              No events linked to this project yet
            </div>
          )}

          {/* Files Section - Placeholder for Phase 2 */}
          <SectionHeader title="Files" count={0} colors={colors} />
          <div style={{
            padding: '20px',
            textAlign: 'center',
            color: colors.textTertiary,
            fontSize: fontSize.sm,
            background: isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
            borderRadius: '8px'
          }}>
            File uploads coming soon
          </div>
        </>
      )}
    </div>
  )
}

function SectionHeader({ title, count, colors }: { title: string; count: number; colors: any }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      marginBottom: '12px'
    }}>
      <h3 style={{
        fontSize: fontSize.base,
        fontWeight: fontWeight.semibold,
        color: colors.textPrimary,
        margin: 0
      }}>
        {title}
      </h3>
      <span style={{
        fontSize: fontSize.xs,
        color: colors.textTertiary,
        background: colors.bgTertiary,
        padding: '1px 6px',
        borderRadius: '4px'
      }}>
        {count}
      </span>
    </div>
  )
}

function EntityRow({
  title,
  subtitle,
  status,
  colors,
  isDarkMode,
  onUnlink
}: {
  title: string
  subtitle?: string
  status?: string
  colors: any
  isDarkMode: boolean
  onUnlink: () => void
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 12px',
      background: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
      borderRadius: '6px',
      transition: 'background 0.15s'
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: fontSize.sm,
          fontWeight: fontWeight.medium,
          color: status === 'completed' ? colors.textTertiary : colors.textPrimary,
          textDecoration: status === 'completed' ? 'line-through' : 'none',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {title}
        </div>
        {subtitle && (
          <div style={{
            fontSize: fontSize.xs,
            color: colors.textTertiary,
            marginTop: '2px'
          }}>
            {subtitle}
          </div>
        )}
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onUnlink() }}
        title="Unlink from project"
        style={{
          padding: '4px 8px',
          background: 'transparent',
          border: 'none',
          color: colors.textTertiary,
          cursor: 'pointer',
          fontSize: '11px',
          borderRadius: '4px',
          transition: 'all 0.15s',
          flexShrink: 0
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
          e.currentTarget.style.color = colors.textSecondary
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color = colors.textTertiary
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  )
}
