import { useState, useEffect } from 'react'
import { useAspects } from '../lib/aspectContext'
import type { Project } from '../lib/projectService'
import { getColors, hexToRgba } from '../styles/colors'
import { fontSize, fontWeight } from '../styles/typography'
import { Modal } from './Modal'
import { useTheme } from '../lib/themeContext'
import { SaveTextButton, CancelTextButton } from './ui/IconButtons'

interface ProjectFormProps {
  project?: Project | undefined
  isOpen: boolean
  onClose: () => void
  onSave: (data: ProjectFormData) => Promise<void>
}

export interface ProjectFormData {
  id?: string
  name: string
  aspect_id: string
  description?: string
  deadline?: string
}

export function ProjectForm({ project, isOpen, onClose, onSave }: ProjectFormProps) {
  const { theme } = useTheme()
  const colors = getColors(theme)
  const { aspects } = useAspects()
  const [name, setName] = useState('')
  const [aspectId, setAspectId] = useState('')
  const [description, setDescription] = useState('')
  const [deadline, setDeadline] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (project) {
      setName(project.name || '')
      setAspectId(project.aspect_id || '')
      setDescription(project.description || '')
      setDeadline(project.deadline ? project.deadline.slice(0, 10) : '')
    } else {
      setName('')
      setAspectId(aspects.length > 0 ? aspects[0].id : '')
      setDescription('')
      setDeadline('')
    }
  }, [project, isOpen, aspects])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !aspectId) return

    setLoading(true)
    try {
      await onSave({
        ...(project?.id ? { id: project.id } : {}),
        name: name.trim(),
        aspect_id: aspectId,
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(deadline ? { deadline } : {}),
      })
      onClose()
    } catch (error) {
      // error handled by caller
    } finally {
      setLoading(false)
    }
  }

  const nameInput = (
    <input
      type="text"
      value={name}
      onChange={(e) => setName(e.target.value)}
      required
      placeholder="Project name"
      style={{
        width: '100%',
        padding: '0',
        fontSize: fontSize.xl,
        fontWeight: fontWeight.semibold,
        background: 'transparent',
        color: colors.textPrimary,
        border: 'none',
        outline: 'none'
      }}
    />
  )

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      headerContent={nameInput}
      maxWidth="500px"
      preventAutoFocus={!!project}
    >
      <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Aspect Selector */}
          <div>
            <label style={{
              display: 'block',
              fontSize: fontSize.sm,
              fontWeight: fontWeight.medium,
              color: colors.textSecondary,
              marginBottom: '6px'
            }}>
              Aspect *
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {aspects.map(aspect => {
                const isSelected = aspectId === aspect.id
                const aspectColor = aspect.color || '#999'
                return (
                  <button
                    key={aspect.id}
                    type="button"
                    onClick={() => setAspectId(aspect.id)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: isSelected
                        ? `2px solid ${aspectColor}`
                        : `1px solid ${colors.border}`,
                      background: isSelected
                        ? hexToRgba(aspectColor, 0.2)
                        : colors.bgPrimary,
                      color: isSelected ? aspectColor : colors.textSecondary,
                      fontSize: fontSize.sm,
                      fontWeight: isSelected ? fontWeight.semibold : fontWeight.normal,
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                  >
                    {aspect.name}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Description */}
          <div>
            <label style={{
              display: 'block',
              fontSize: fontSize.sm,
              fontWeight: fontWeight.medium,
              color: colors.textSecondary,
              marginBottom: '6px'
            }}>
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What is this project about?"
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: fontSize.base,
                background: colors.bgPrimary,
                color: colors.textPrimary,
                border: `1px solid ${colors.border}`,
                borderRadius: '6px',
                resize: 'vertical'
              }}
            />
          </div>

          {/* Deadline */}
          <div>
            <label style={{
              display: 'block',
              fontSize: fontSize.sm,
              fontWeight: fontWeight.medium,
              color: colors.textSecondary,
              marginBottom: '6px'
            }}>
              Deadline (optional)
            </label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: fontSize.base,
                background: colors.bgPrimary,
                color: colors.textPrimary,
                border: `1px solid ${colors.border}`,
                borderRadius: '6px',
              }}
            />
          </div>
        </div>

        {/* Actions */}
        <div style={{
          display: 'flex',
          gap: '12px',
          marginTop: '24px',
          justifyContent: 'flex-end'
        }}>
          <CancelTextButton
            onClick={onClose}
            disabled={loading}
          />
          <SaveTextButton
            onClick={(e) => handleSubmit(e)}
            disabled={!name.trim() || !aspectId}
            loading={loading}
            isCreate={!project}
          />
        </div>
      </form>
    </Modal>
  )
}
