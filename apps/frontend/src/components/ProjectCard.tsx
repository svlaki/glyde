import { useTheme } from '../lib/themeContext'
import type { Project } from '../lib/projectService'
import { getColors, hexToRgba } from '../styles/colors'
import { getTypography, fontWeight, lineHeight } from '../styles/typography'
import { usePlatform } from '../hooks/usePlatform'

interface ProjectCardProps {
  project: Project
  isSelected: boolean
  onClick: () => void
}

export function ProjectCard({ project, isSelected, onClick }: ProjectCardProps) {
  const { theme } = useTheme()
  const { isMobile } = usePlatform()
  const colors = getColors(theme)
  const typography = getTypography(isMobile)

  const projectColor = project.aspect_color || '#999'

  const deadlineStr = project.deadline
    ? new Date(project.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  return (
    <div
      onClick={onClick}
      style={{
        padding: '16px',
        background: isSelected
          ? hexToRgba(projectColor, 0.22)
          : hexToRgba(projectColor, 0.12),
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        borderLeft: `4px solid ${projectColor}`
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.background = hexToRgba(projectColor, 0.18)
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.background = hexToRgba(projectColor, 0.12)
        }
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: project.description ? '8px' : '0' }}>
        <div style={{ flex: 1 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: project.description || deadlineStr ? '2px' : '0'
          }}>
            <span style={{
              ...typography.labelLg,
              fontWeight: fontWeight.semibold,
              color: colors.textPrimary,
            }}>
              {project.name}
            </span>
            {project.aspect_name && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '1px 6px',
                borderRadius: '4px',
                background: hexToRgba(projectColor, 0.15),
                color: projectColor,
                fontSize: '10px',
                fontWeight: 500,
                flexShrink: 0
              }}>
                {project.aspect_name}
              </span>
            )}
          </div>
          {project.description && (
            <div style={{
              ...typography.bodySm,
              color: colors.textSecondary,
              lineHeight: lineHeight.tight,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '280px'
            }}>
              {project.description}
            </div>
          )}
          {deadlineStr && (
            <div style={{
              ...typography.bodySm,
              color: colors.textTertiary,
              marginTop: '4px',
              fontSize: '11px'
            }}>
              Due: {deadlineStr}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
