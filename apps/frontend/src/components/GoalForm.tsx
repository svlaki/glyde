import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../lib/authContext'
import { useDarkMode } from '../lib/darkModeContext'
import { useCategories } from '../lib/categoryContext'
import { createUserCategory, Category } from '../lib/categoryService'
import { Goal } from '../lib/goalService'
import { getColors } from '../styles/colors'
import { AspectForm } from './AspectForm'
import { Modal } from './Modal'

interface GoalFormProps {
  goal?: Goal
  isOpen: boolean
  onClose: () => void
  onSave: (goal: Partial<Goal>) => Promise<void>
}

export function GoalForm({ goal, isOpen, onClose, onSave }: GoalFormProps) {
  const { user, session } = useAuth()
  const { isDarkMode } = useDarkMode()
  const colors = getColors(isDarkMode)
  const { categories, refreshCategories, getCategoryColor } = useCategories()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [loading, setLoading] = useState(false)
  const [editingField, setEditingField] = useState<string | null>(null)
  const [isAspectFormOpen, setIsAspectFormOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (goal) {
      setTitle(goal.title || '')
      setDescription(goal.description || '')
      setCategory(goal.category || '')
    } else {
      setTitle('')
      setDescription('')
      setCategory('')
    }
    setEditingField(null)
  }, [goal, isOpen])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setEditingField(null)
      }
    }

    if (editingField) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [editingField])

  const handleCreateAspect = async (aspectData: Partial<Category>) => {
    if (!user || !session) return

    try {
      await createUserCategory(user, aspectData as any, session.access_token)
      await refreshCategories()
      // Auto-select the newly created aspect
      if (aspectData.name) {
        setCategory(aspectData.name)
      }
      setIsAspectFormOpen(false)
      setEditingField(null)
    } catch (error) {
      console.error('Error creating aspect:', error)
      throw error
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    setLoading(true)
    try {
      const goalData = {
        id: goal?.id,
        title: title.trim(),
        description: description.trim() || undefined,
        category: category || undefined
      }
      console.log('Saving goal with data:', goalData)
      await onSave(goalData)
      onClose()
    } catch (error) {
      console.error('Error saving goal:', error)
      alert('Failed to save goal. Please check the console for details.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={goal ? 'Edit Goal' : 'Create New Goal'}
    >
      <form onSubmit={handleSubmit} style={{
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
          {/* Title */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: '500',
              color: colors.textSecondary,
              marginBottom: '6px'
            }}>
              Goal Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="e.g., Learn to play piano, Get in shape, Start a business"
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '14px',
                background: colors.bgPrimary,
                color: colors.textPrimary,
                border: `1px solid ${colors.border}`,
                borderRadius: '6px'
              }}
            />
          </div>

          {/* Aspect */}
          <div style={{ position: 'relative' }} ref={dropdownRef}>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: '500',
              color: colors.textSecondary,
              marginBottom: '6px'
            }}>
              Aspect
            </label>
            <div
              onClick={() => setEditingField(editingField === 'category' ? null : 'category')}
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '14px',
                background: colors.bgPrimary,
                color: category ? colors.textPrimary : colors.textSecondary,
                border: `1px solid ${colors.border}`,
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {category ? (
                <>
                  {(() => {
                    const cat = categories.find(c => c.name === category)
                    return cat ? (
                      <>
                        <div style={{
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          background: getCategoryColor(category),
                          flexShrink: 0
                        }} />
                        {cat.icon && <span style={{ fontSize: '16px', flexShrink: 0 }}>{cat.icon}</span>}
                        <span>{category}</span>
                      </>
                    ) : (
                      <span>{category}</span>
                    )
                  })()}
                </>
              ) : (
                <span>Select or create an aspect</span>
              )}
            </div>

            {/* Dropdown Menu */}
            {editingField === 'category' && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 0,
                right: 0,
                zIndex: 1000,
                background: colors.bgPrimary,
                border: `1px solid ${colors.border}`,
                borderRadius: '6px',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                maxHeight: '200px',
                overflowY: 'auto'
              }}>
                {/* Clear selection option */}
                {category && (
                  <div
                    onClick={() => {
                      setCategory('')
                      setEditingField(null)
                    }}
                    style={{
                      padding: '10px 14px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      fontSize: '14px',
                      color: colors.textSecondary,
                      fontStyle: 'italic',
                      borderBottom: `1px solid ${colors.border}`
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = colors.bgHover
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent'
                    }}
                  >
                    <span>Clear aspect</span>
                  </div>
                )}
                {/* Existing aspects */}
                {categories.map(cat => (
                  <div
                    key={cat.id}
                    onClick={() => {
                      setCategory(cat.name)
                      setEditingField(null)
                    }}
                    style={{
                      padding: '10px 14px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      fontSize: '14px',
                      color: colors.textPrimary
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = colors.bgHover
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent'
                    }}
                  >
                    <div style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      background: getCategoryColor(cat.name),
                      flexShrink: 0
                    }} />
                    {cat.icon && (
                      <span style={{ fontSize: '16px', flexShrink: 0 }}>{cat.icon}</span>
                    )}
                    <span>{cat.name}</span>
                  </div>
                ))}
                {/* Create new aspect button */}
                <div
                  onClick={() => {
                    setIsAspectFormOpen(true)
                  }}
                  style={{
                    padding: '10px 14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '14px',
                    color: colors.textPrimary,
                    fontWeight: '500',
                    borderTop: `1px solid ${colors.border}`
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = colors.bgHover
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <span style={{ fontSize: '16px', flexShrink: 0 }}>+</span>
                  <span>New Aspect</span>
                </div>
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: '500',
              color: colors.textSecondary,
              marginBottom: '6px'
            }}>
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              placeholder="Describe what you want to accomplish and why it matters to you..."
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '14px',
                background: colors.bgPrimary,
                color: colors.textPrimary,
                border: `1px solid ${colors.border}`,
                borderRadius: '6px',
                resize: 'vertical'
              }}
            />
          </div>

          {/* Actions */}
          <div style={{
            display: 'flex',
            gap: '12px',
            marginTop: '8px',
            justifyContent: 'flex-end',
            paddingTop: '16px',
            borderTop: `1px solid ${colors.border}`
          }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                background: colors.bgPrimary,
                color: colors.textSecondary,
                border: `1px solid ${colors.border}`,
                borderRadius: '6px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.5 : 1
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !title.trim()}
              className="btn btn-primary"
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                cursor: (loading || !title.trim()) ? 'not-allowed' : 'pointer',
                opacity: (loading || !title.trim()) ? 0.5 : 1
              }}
            >
              {loading ? 'Saving...' : goal ? 'Update Goal' : 'Create Goal'}
            </button>
          </div>
        </form>

      {/* Aspect Form Modal */}
      <AspectForm
        isOpen={isAspectFormOpen}
        onClose={() => setIsAspectFormOpen(false)}
        onSave={handleCreateAspect}
      />
    </Modal>
  )
}
