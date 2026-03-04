import { useState, useEffect, useRef } from 'react'
import { useTheme } from '../lib/themeContext'
import { useAuth } from '../lib/authContext'
import { useAspects } from '../lib/aspectContext'
import type { Aspect } from '../lib/aspectContext'
import { GoalsSection } from '../components/GoalsSection'
import { VerticalSidebar, SIDEBAR_WIDTH } from '../components/VerticalSidebar'
import { getColors, hexToRgba } from '../styles/colors'
import { getTypography } from '../styles/typography'
import { fetchUserNotes, createUserNotes, updateUserNotes } from '../lib/notesService'
import type { Note } from '../lib/notesService'
import { fetchUserGoals } from '../lib/goalService'
import type { Goal } from '../lib/goalService'
import { supabase } from '../lib/supabase'
import { usePlatform } from '../hooks/usePlatform'
import { MobileHeader } from '../components/mobile/MobileHeader'
import { mobileStyles, mobileSpacing } from '../styles/mobileStyles'

export function NotesPage() {
  const { isMobile } = usePlatform()

  if (isMobile) {
    return <NotesPageMobile />
  }

  return <NotesPageDesktop />
}

function NotesPageDesktop() {
  const { theme, isDarkMode } = useTheme()
  const { user, session } = useAuth()
  const { aspects } = useAspects()
  const colors = getColors(theme)
  const typography = getTypography(false)

  const [allNotes, setAllNotes] = useState<Note[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isEditingRef = useRef(false)
  const initialLoadDone = useRef(false)

  // Selected note
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(() => {
    return localStorage.getItem('notes-selected-id')
  })
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Create form
  const [isCreating, setIsCreating] = useState(false)
  const [newNoteTitle, setNewNoteTitle] = useState('')
  const [newNoteAspectId, setNewNoteAspectId] = useState('')

  // Resizable panel state
  const [leftWidth, setLeftWidth] = useState(() => {
    const saved = localStorage.getItem('notes-left-width')
    return saved ? parseInt(saved) : 450
  })
  const [isResizingLeft, setIsResizingLeft] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedNote = allNotes.find(n => n.id === selectedNoteId) || null

  // Persist selected note ID
  useEffect(() => {
    if (selectedNoteId) {
      localStorage.setItem('notes-selected-id', selectedNoteId)
    }
  }, [selectedNoteId])

  // Save panel width to localStorage
  useEffect(() => {
    localStorage.setItem('notes-left-width', leftWidth.toString())
  }, [leftWidth])

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Handle mouse move for resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingLeft && containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect()
        const newWidth = e.clientX - containerRect.left - 16
        setLeftWidth(Math.min(Math.max(newWidth, 250), 700))
      }
    }

    const handleMouseUp = () => {
      setIsResizingLeft(false)
    }

    if (isResizingLeft) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)

      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
    return undefined
  }, [isResizingLeft])

  // Sync editContent when selected note changes
  useEffect(() => {
    if (selectedNote && !isEditingRef.current) {
      setEditContent(selectedNote.content || '')
    }
  }, [selectedNoteId, selectedNote?.content])

  // Load data and realtime subscriptions
  useEffect(() => {
    if (!user || !session?.access_token) return

    let isSubscribed = true
    let refreshTimer: NodeJS.Timeout | null = null

    const loadData = async (isBackground = false) => {
      if (!isSubscribed) return

      if (!isBackground) {
        setIsLoading(true)
      }
      setError(null)

      try {
        const [notesResult, goalsResult] = await Promise.all([
          fetchUserNotes(user, session.access_token),
          fetchUserGoals(user, session.access_token)
        ])

        if (!isSubscribed) return

        if (notesResult.error) {
          console.error('Error loading notes:', notesResult.error)
        }
        if (goalsResult.error) {
          console.error('Error loading goals:', goalsResult.error)
        }

        if (!isEditingRef.current) {
          setAllNotes(notesResult.notes)
          // Auto-select first note if none selected or selection no longer valid
          if (notesResult.notes.length > 0) {
            const currentValid = notesResult.notes.some(n => n.id === selectedNoteId)
            if (!currentValid) {
              setSelectedNoteId(notesResult.notes[0].id)
            }
          }
        }
        setGoals(goalsResult.goals)
      } catch (err) {
        if (isSubscribed) {
          setError('Failed to load data')
          console.error(err)
        }
      } finally {
        if (isSubscribed) {
          setIsLoading(false)
          initialLoadDone.current = true
        }
      }
    }

    loadData(initialLoadDone.current)

    const goalsChannel = supabase
      .channel(`notes-goals-${user.id}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'goals',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          if (refreshTimer) clearTimeout(refreshTimer)
          refreshTimer = setTimeout(() => loadData(true), 500)
        }
      )
      .subscribe()

    const notesChannel = supabase
      .channel(`notes-${user.id}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notes',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          if (isEditingRef.current) return
          if (refreshTimer) clearTimeout(refreshTimer)
          refreshTimer = setTimeout(() => loadData(true), 500)
        }
      )
      .subscribe()

    return () => {
      isSubscribed = false
      if (refreshTimer) clearTimeout(refreshTimer)
      supabase.removeChannel(goalsChannel)
      supabase.removeChannel(notesChannel)
    }
  }, [user, session])

  const handleCreateNote = async () => {
    if (!user || !session?.access_token || !newNoteTitle.trim() || !newNoteAspectId) return

    const result = await createUserNotes(user, session.access_token, {
      title: newNoteTitle.trim(),
      content: '',
      aspect_id: newNoteAspectId,
      status: 'active'
    })

    if (result.note) {
      // Reload all notes to get aspect data from RPC
      const notesResult = await fetchUserNotes(user, session.access_token)
      if (!notesResult.error) {
        setAllNotes(notesResult.notes)
      }
      setSelectedNoteId(result.note.id)
      setIsCreating(false)
      setNewNoteTitle('')
      setNewNoteAspectId('')
    } else if (result.error) {
      setError(result.error)
    }
  }

  const handleContentChange = (newContent: string) => {
    setEditContent(newContent)
    isEditingRef.current = true

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(async () => {
      if (!user || !session?.access_token || !selectedNote) return

      await updateUserNotes(user, session.access_token, selectedNote.id, {
        content: newContent
      })
    }, 1000)
  }

  const handleBlur = async () => {
    setIsEditing(false)
    isEditingRef.current = false

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    if (!user || !session?.access_token || !selectedNote) return
    if (editContent === selectedNote.content) return

    await updateUserNotes(user, session.access_token, selectedNote.id, {
      content: editContent
    })
  }

  const selectNote = (noteId: string) => {
    // Save current edits before switching
    if (isEditingRef.current && selectedNote) {
      handleBlur()
    }
    setSelectedNoteId(noteId)
    setDropdownOpen(false)
    setIsEditing(false)
  }

  const formatUpdatedAt = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  if (isLoading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        background: colors.bgPrimary
      }}>
        <VerticalSidebar />
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: colors.textSecondary,
          marginLeft: `${SIDEBAR_WIDTH}px`,
        }}>
          Loading...
        </div>
      </div>
    )
  }

  const aspectColor = selectedNote?.aspect_color || '#6b7280'

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      overflow: 'hidden',
      background: colors.bgPrimary
    }}>
      <VerticalSidebar />

      <div
        ref={containerRef}
        style={{
          flex: 1,
          display: 'flex',
          overflow: 'hidden',
          padding: '16px',
          gap: '16px',
          marginLeft: `${SIDEBAR_WIDTH}px`,
          userSelect: isResizingLeft ? 'none' : 'auto'
        }}
      >
        {/* LEFT COLUMN - Notes */}
        <div style={{
          width: `${leftWidth}px`,
          minWidth: '250px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          flexShrink: 0,
          position: 'relative'
        }}>
          {error && (
            <div style={{
              padding: '12px 16px',
              background: isDarkMode ? '#3d2020' : '#fee2e2',
              color: isDarkMode ? '#fca5a5' : '#dc2626',
              borderRadius: '8px',
              fontSize: '14px'
            }}>
              {error}
            </div>
          )}

          {/* Header bar: + New button + dropdown */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexShrink: 0
          }}>
            <button
              onClick={() => {
                setIsCreating(!isCreating)
                if (!newNoteAspectId && aspects.length > 0) {
                  setNewNoteAspectId(aspects[0].id)
                }
              }}
              style={{
                padding: '6px 14px',
                background: isCreating ? colors.border : (isDarkMode ? '#374151' : '#f3f4f6'),
                color: colors.textPrimary,
                border: `1px solid ${colors.border}`,
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '500',
                whiteSpace: 'nowrap'
              }}
            >
              + New
            </button>

            {/* Note selector dropdown */}
            <div ref={dropdownRef} style={{ position: 'relative', flex: 1, minWidth: 0 }}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                style={{
                  width: '100%',
                  padding: '6px 12px',
                  background: isDarkMode ? '#374151' : '#f3f4f6',
                  color: colors.textPrimary,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  textAlign: 'left'
                }}
              >
                {selectedNote && (
                  <span style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: selectedNote.aspect_color || '#6b7280',
                    flexShrink: 0
                  }} />
                )}
                <span style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1
                }}>
                  {selectedNote?.title || 'Select a note...'}
                </span>
                <span style={{ fontSize: '10px', color: colors.textTertiary, flexShrink: 0 }}>
                  {dropdownOpen ? '\u25B2' : '\u25BC'}
                </span>
              </button>

              {dropdownOpen && allNotes.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: '4px',
                  background: isDarkMode ? '#1f2937' : '#ffffff',
                  border: `1px solid ${colors.border}`,
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  zIndex: 50,
                  maxHeight: '300px',
                  overflow: 'auto'
                }}>
                  {allNotes.map(note => (
                    <button
                      key={note.id}
                      onClick={() => selectNote(note.id)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: note.id === selectedNoteId
                          ? (isDarkMode ? '#374151' : '#f0f0f0')
                          : 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontSize: '13px',
                        color: colors.textPrimary,
                        borderBottom: `1px solid ${colors.border}`
                      }}
                    >
                      <span style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: note.aspect_color || '#6b7280',
                        flexShrink: 0
                      }} />
                      <span style={{
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {note.title}
                      </span>
                      <span style={{
                        fontSize: '11px',
                        color: colors.textTertiary,
                        flexShrink: 0
                      }}>
                        {formatUpdatedAt(note.updated_at)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Inline create form */}
          {isCreating && (
            <div style={{
              padding: '12px',
              background: isDarkMode ? '#1f2937' : '#f9fafb',
              border: `1px solid ${colors.border}`,
              borderRadius: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              flexShrink: 0
            }}>
              <input
                type="text"
                placeholder="Note title..."
                value={newNoteTitle}
                onChange={e => setNewNoteTitle(e.target.value)}
                autoFocus
                style={{
                  padding: '8px 12px',
                  background: colors.bgPrimary,
                  color: colors.textPrimary,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '6px',
                  fontSize: '14px',
                  outline: 'none'
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newNoteTitle.trim() && newNoteAspectId) {
                    handleCreateNote()
                  }
                  if (e.key === 'Escape') {
                    setIsCreating(false)
                    setNewNoteTitle('')
                    setNewNoteAspectId('')
                  }
                }}
              />
              <select
                value={newNoteAspectId}
                onChange={e => setNewNoteAspectId(e.target.value)}
                style={{
                  padding: '8px 12px',
                  background: colors.bgPrimary,
                  color: colors.textPrimary,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '6px',
                  fontSize: '14px',
                  outline: 'none'
                }}
              >
                <option value="">Select aspect...</option>
                {aspects.map((a: Aspect) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={handleCreateNote}
                  disabled={!newNoteTitle.trim() || !newNoteAspectId}
                  style={{
                    flex: 1,
                    padding: '8px',
                    background: (!newNoteTitle.trim() || !newNoteAspectId) ? '#6b7280' : '#3b82f6',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: (!newNoteTitle.trim() || !newNoteAspectId) ? 'not-allowed' : 'pointer',
                    fontSize: '13px',
                    fontWeight: '500'
                  }}
                >
                  Create
                </button>
                <button
                  onClick={() => {
                    setIsCreating(false)
                    setNewNoteTitle('')
                    setNewNoteAspectId('')
                  }}
                  style={{
                    padding: '8px 16px',
                    background: 'transparent',
                    color: colors.textSecondary,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '13px'
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Notes Content */}
          <div style={{
            flex: 1,
            background: colors.bgPrimary,
            borderRadius: '12px',
            border: `1px solid ${colors.border}`,
            borderLeft: selectedNote ? `3px solid ${aspectColor}` : `1px solid ${colors.border}`,
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {allNotes.length === 0 ? (
              <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '16px',
                padding: '20px'
              }}>
                <p style={{ color: colors.textSecondary, margin: 0 }}>
                  You don't have any notes yet.
                </p>
                <button
                  onClick={() => {
                    setIsCreating(true)
                    if (!newNoteAspectId && aspects.length > 0) {
                      setNewNoteAspectId(aspects[0].id)
                    }
                  }}
                  style={{
                    padding: '10px 20px',
                    background: '#3b82f6',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  Create Your First Note
                </button>
              </div>
            ) : selectedNote ? (
              <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                padding: '20px',
                background: `linear-gradient(135deg, ${hexToRgba(aspectColor, 0.03)} 0%, transparent 50%)`
              }}>
                {/* Aspect badge */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginBottom: '4px'
                }}>
                  <span style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: aspectColor
                  }} />
                  <span style={{
                    fontSize: '12px',
                    color: aspectColor,
                    fontWeight: '500',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    {selectedNote.aspect_name || 'Uncategorized'}
                  </span>
                </div>

                {/* Title */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '12px',
                  flexShrink: 0
                }}>
                  <h2 style={{
                    ...typography.headingLg,
                    margin: 0,
                    fontWeight: 600,
                    color: colors.textPrimary
                  }}>
                    {selectedNote.title}
                  </h2>
                  <span style={{
                    ...typography.labelSm,
                    color: colors.textTertiary
                  }}>
                    {isEditing ? 'Editing...' : 'Click to edit'}
                  </span>
                </div>

                {/* Content */}
                {isEditing ? (
                  <textarea
                    value={editContent}
                    onChange={(e) => handleContentChange(e.target.value)}
                    onBlur={handleBlur}
                    autoFocus
                    style={{
                      flex: 1,
                      width: '100%',
                      padding: '12px',
                      background: colors.bgSecondary,
                      color: colors.textPrimary,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '8px',
                      fontSize: '14px',
                      lineHeight: '1.6',
                      resize: 'none',
                      fontFamily: 'inherit'
                    }}
                  />
                ) : (
                  <div
                    onClick={() => setIsEditing(true)}
                    style={{
                      flex: 1,
                      padding: '12px',
                      background: colors.bgSecondary,
                      borderRadius: '8px',
                      cursor: 'text',
                      whiteSpace: 'pre-wrap',
                      fontSize: '14px',
                      lineHeight: '1.6',
                      color: editContent ? colors.textPrimary : colors.textTertiary,
                      overflow: 'auto'
                    }}
                  >
                    {editContent || 'Click to add your notes...'}
                  </div>
                )}
              </div>
            ) : (
              <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: colors.textTertiary,
                fontSize: '14px'
              }}>
                Select a note from the dropdown above
              </div>
            )}
          </div>

          {/* Resize handle for left column */}
          <div
            onMouseDown={() => setIsResizingLeft(true)}
            style={{
              position: 'absolute',
              top: 0,
              right: -12,
              bottom: 0,
              width: '8px',
              cursor: 'col-resize',
              zIndex: 10,
              background: isResizingLeft ? colors.border : 'transparent',
              borderRadius: '4px',
              transition: 'background 0.15s'
            }}
            onMouseEnter={(e) => {
              if (!isResizingLeft) {
                e.currentTarget.style.background = colors.border
              }
            }}
            onMouseLeave={(e) => {
              if (!isResizingLeft) {
                e.currentTarget.style.background = 'transparent'
              }
            }}
          />
        </div>

        {/* RIGHT COLUMN - Goals */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          overflow: 'hidden',
          minWidth: '300px'
        }}>
          <div style={{
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
          }}>
            <GoalsSection />
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// MOBILE
// ============================================================

type MobileView = 'list' | 'edit' | 'goals' | 'create'

function NotesPageMobile() {
  const { theme, isDarkMode } = useTheme()
  const { user, session } = useAuth()
  const { aspects } = useAspects()
  const colors = getColors(theme)

  const [allNotes, setAllNotes] = useState<Note[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isEditingRef = useRef(false)
  const initialLoadDone = useRef(false)

  const [mobileView, setMobileView] = useState<MobileView>('list')
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(() => {
    return localStorage.getItem('notes-selected-id')
  })

  // Create form
  const [newNoteTitle, setNewNoteTitle] = useState('')
  const [newNoteAspectId, setNewNoteAspectId] = useState('')

  const selectedNote = allNotes.find(n => n.id === selectedNoteId) || null

  useEffect(() => {
    if (selectedNoteId) {
      localStorage.setItem('notes-selected-id', selectedNoteId)
    }
  }, [selectedNoteId])

  // Load data and realtime subscriptions
  useEffect(() => {
    if (!user || !session?.access_token) return

    let isSubscribed = true
    let refreshTimer: NodeJS.Timeout | null = null

    const loadData = async (isBackground = false) => {
      if (!isSubscribed) return

      if (!isBackground) {
        setIsLoading(true)
      }
      setError(null)

      try {
        const [notesResult, goalsResult] = await Promise.all([
          fetchUserNotes(user, session.access_token),
          fetchUserGoals(user, session.access_token)
        ])

        if (!isSubscribed) return

        if (notesResult.error) {
          console.error('Error loading notes:', notesResult.error)
        }
        if (goalsResult.error) {
          console.error('Error loading goals:', goalsResult.error)
        }

        if (!isEditingRef.current) {
          setAllNotes(notesResult.notes)
        }
        setGoals(goalsResult.goals)
      } catch (err) {
        if (isSubscribed) {
          setError('Failed to load data')
          console.error(err)
        }
      } finally {
        if (isSubscribed) {
          setIsLoading(false)
          initialLoadDone.current = true
        }
      }
    }

    loadData(initialLoadDone.current)

    const goalsChannel = supabase
      .channel(`notes-goals-mobile-${user.id}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'goals',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          if (refreshTimer) clearTimeout(refreshTimer)
          refreshTimer = setTimeout(() => loadData(true), 500)
        }
      )
      .subscribe()

    const notesChannel = supabase
      .channel(`notes-mobile-${user.id}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notes',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          if (isEditingRef.current) return
          if (refreshTimer) clearTimeout(refreshTimer)
          refreshTimer = setTimeout(() => loadData(true), 500)
        }
      )
      .subscribe()

    return () => {
      isSubscribed = false
      if (refreshTimer) clearTimeout(refreshTimer)
      supabase.removeChannel(goalsChannel)
      supabase.removeChannel(notesChannel)
    }
  }, [user, session])

  const handleCreateNote = async () => {
    if (!user || !session?.access_token || !newNoteTitle.trim() || !newNoteAspectId) return

    const result = await createUserNotes(user, session.access_token, {
      title: newNoteTitle.trim(),
      content: '',
      aspect_id: newNoteAspectId,
      status: 'active'
    })

    if (result.note) {
      const notesResult = await fetchUserNotes(user, session.access_token)
      if (!notesResult.error) {
        setAllNotes(notesResult.notes)
      }
      setSelectedNoteId(result.note.id)
      setEditContent('')
      setNewNoteTitle('')
      setNewNoteAspectId('')
      setMobileView('edit')
    } else if (result.error) {
      setError(result.error)
    }
  }

  const handleContentChange = (newContent: string) => {
    setEditContent(newContent)
    isEditingRef.current = true

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(async () => {
      if (!user || !session?.access_token || !selectedNote) return

      await updateUserNotes(user, session.access_token, selectedNote.id, {
        content: newContent
      })
    }, 1000)
  }

  const handleBlur = async () => {
    setIsEditing(false)
    isEditingRef.current = false

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    if (!user || !session?.access_token || !selectedNote) return
    if (editContent === selectedNote.content) return

    await updateUserNotes(user, session.access_token, selectedNote.id, {
      content: editContent
    })
  }

  const openNote = (noteId: string) => {
    setSelectedNoteId(noteId)
    const note = allNotes.find(n => n.id === noteId)
    setEditContent(note?.content || '')
    setIsEditing(false)
    setMobileView('edit')
  }

  const formatUpdatedAt = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  if (isLoading) {
    return (
      <div style={mobileStyles.fullHeight}>
        <MobileHeader title="Notes" showMenu={true} showSearch={true} />
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: colors.textSecondary,
          background: colors.bgPrimary
        }}>
          Loading...
        </div>
      </div>
    )
  }

  // ============ FULLSCREEN: Create Note ============
  if (mobileView === 'create') {
    return (
      <div style={mobileStyles.fullHeight}>
        <MobileHeader
          title="New Note"
          onBack={() => {
            setMobileView('list')
            setNewNoteTitle('')
            setNewNoteAspectId('')
          }}
        />
        <div style={{
          ...mobileStyles.scrollContainer,
          background: colors.bgPrimary,
          paddingLeft: mobileSpacing.paddingX,
          paddingRight: mobileSpacing.paddingX,
          paddingTop: mobileSpacing.paddingTop,
          paddingBottom: mobileSpacing.paddingBottomNoTabs
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <input
              type="text"
              placeholder="Note title..."
              value={newNoteTitle}
              onChange={e => setNewNoteTitle(e.target.value)}
              autoFocus
              style={{
                padding: '14px 16px',
                background: colors.bgSecondary,
                color: colors.textPrimary,
                border: `1px solid ${colors.border}`,
                borderRadius: '10px',
                fontSize: '16px',
                outline: 'none',
                minHeight: '44px'
              }}
            />
            <select
              value={newNoteAspectId}
              onChange={e => setNewNoteAspectId(e.target.value)}
              style={{
                padding: '14px 16px',
                background: colors.bgSecondary,
                color: colors.textPrimary,
                border: `1px solid ${colors.border}`,
                borderRadius: '10px',
                fontSize: '16px',
                outline: 'none',
                minHeight: '44px'
              }}
            >
              <option value="">Select aspect...</option>
              {aspects.map((a: Aspect) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <button
              onClick={handleCreateNote}
              disabled={!newNoteTitle.trim() || !newNoteAspectId}
              style={{
                padding: '14px',
                background: (!newNoteTitle.trim() || !newNoteAspectId) ? '#6b7280' : '#3b82f6',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                cursor: (!newNoteTitle.trim() || !newNoteAspectId) ? 'not-allowed' : 'pointer',
                fontSize: '16px',
                fontWeight: '500',
                minHeight: '44px'
              }}
            >
              Create Note
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ============ FULLSCREEN: Edit Note ============
  if (mobileView === 'edit' && selectedNote) {
    const noteColor = selectedNote.aspect_color || '#6b7280'
    return (
      <div style={mobileStyles.fullHeight}>
        <MobileHeader
          title={selectedNote.title}
          onBack={() => {
            handleBlur()
            setMobileView('list')
          }}
        />
        <div style={{
          ...mobileStyles.scrollContainer,
          background: colors.bgPrimary,
          paddingLeft: mobileSpacing.paddingX,
          paddingRight: mobileSpacing.paddingX,
          paddingTop: mobileSpacing.paddingTop,
          paddingBottom: mobileSpacing.paddingBottomNoTabs
        }}>
          {/* Aspect badge */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '12px'
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: noteColor
            }} />
            <span style={{
              fontSize: '12px',
              color: noteColor,
              fontWeight: '500',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              {selectedNote.aspect_name || 'Uncategorized'}
            </span>
            <span style={{
              fontSize: '12px',
              color: colors.textTertiary,
              marginLeft: 'auto'
            }}>
              {isEditing ? 'Editing... (auto-saves)' : 'Tap to edit'}
            </span>
          </div>

          {isEditing ? (
            <textarea
              value={editContent}
              onChange={(e) => handleContentChange(e.target.value)}
              onBlur={handleBlur}
              autoFocus
              style={{
                width: '100%',
                minHeight: 'calc(100vh - 200px)',
                padding: '16px',
                background: colors.bgSecondary,
                color: colors.textPrimary,
                border: `1px solid ${colors.border}`,
                borderRadius: '12px',
                borderLeft: `3px solid ${noteColor}`,
                fontSize: '16px',
                lineHeight: '1.7',
                resize: 'none',
                fontFamily: 'inherit'
              }}
            />
          ) : (
            <div
              onClick={() => setIsEditing(true)}
              style={{
                padding: '16px',
                background: colors.bgSecondary,
                borderRadius: '12px',
                borderLeft: `3px solid ${noteColor}`,
                cursor: 'text',
                whiteSpace: 'pre-wrap',
                fontSize: '15px',
                lineHeight: '1.7',
                color: editContent ? colors.textPrimary : colors.textTertiary,
                minHeight: 'calc(100vh - 200px)'
              }}
            >
              {editContent || 'Tap to add your notes...'}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ============ FULLSCREEN: Goals ============
  if (mobileView === 'goals') {
    return (
      <div style={mobileStyles.fullHeight}>
        <MobileHeader
          title="Goals"
          onBack={() => setMobileView('list')}
        />
        <div style={{
          flex: 1,
          overflow: 'auto',
          background: colors.bgPrimary,
          paddingLeft: mobileSpacing.paddingX,
          paddingRight: mobileSpacing.paddingX,
          paddingTop: mobileSpacing.paddingTop,
          paddingBottom: mobileSpacing.paddingBottomNoTabs
        }}>
          <GoalsSection />
        </div>
      </div>
    )
  }

  // ============ DEFAULT: Note list overview ============
  return (
    <div style={mobileStyles.fullHeight}>
      <MobileHeader title="Notes" showMenu={true} showSearch={true} />

      <div style={{
        ...mobileStyles.scrollContainer,
        background: colors.bgPrimary,
        paddingLeft: mobileSpacing.paddingX,
        paddingRight: mobileSpacing.paddingX,
        paddingTop: mobileSpacing.paddingTop,
        paddingBottom: mobileSpacing.paddingBottomNoTabs
      }}>
        {error && (
          <div style={{
            padding: '12px 16px',
            background: isDarkMode ? '#3d2020' : '#fee2e2',
            color: isDarkMode ? '#fca5a5' : '#dc2626',
            borderRadius: '8px',
            fontSize: '14px',
            marginBottom: '16px'
          }}>
            {error}
          </div>
        )}

        {/* + New button */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginBottom: '12px'
        }}>
          <button
            onClick={() => {
              if (!newNoteAspectId && aspects.length > 0) {
                setNewNoteAspectId(aspects[0].id)
              }
              setMobileView('create')
            }}
            style={{
              padding: '8px 16px',
              background: '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              minHeight: '36px'
            }}
          >
            + New Note
          </button>
        </div>

        {/* Note cards */}
        {allNotes.length === 0 ? (
          <div style={{
            padding: '40px 20px',
            textAlign: 'center',
            color: colors.textSecondary,
            fontSize: '14px'
          }}>
            No notes yet. Tap "+ New Note" to create one.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
            {allNotes.map(note => {
              const noteColor = note.aspect_color || '#6b7280'
              return (
                <button
                  key={note.id}
                  onClick={() => openNote(note.id)}
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    background: colors.bgPrimary,
                    borderRadius: '10px',
                    border: `1px solid ${colors.border}`,
                    borderLeft: `3px solid ${noteColor}`,
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <span style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: noteColor,
                      flexShrink: 0
                    }} />
                    <span style={{
                      fontSize: '15px',
                      fontWeight: '600',
                      color: colors.textPrimary,
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {note.title}
                    </span>
                    <span style={{
                      fontSize: '11px',
                      color: colors.textTertiary,
                      flexShrink: 0
                    }}>
                      {formatUpdatedAt(note.updated_at)}
                    </span>
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: noteColor,
                    fontWeight: '500'
                  }}>
                    {note.aspect_name || 'Uncategorized'}
                  </div>
                  {note.content && (
                    <div style={{
                      fontSize: '13px',
                      color: colors.textSecondary,
                      lineHeight: '1.4',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {note.content.slice(0, 100)}
                      {note.content.length > 100 ? '...' : ''}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {/* Goals card */}
        <button
          onClick={() => setMobileView('goals')}
          style={{
            width: '100%',
            background: colors.bgPrimary,
            borderRadius: '12px',
            border: `1px solid ${colors.border}`,
            padding: '16px',
            marginBottom: '16px',
            textAlign: 'left',
            cursor: 'pointer'
          }}
        >
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: goals.length > 0 ? '12px' : '0'
          }}>
            <h2 style={{
              margin: 0,
              fontSize: '18px',
              fontWeight: '600',
              color: colors.textPrimary,
              fontFamily: "'EB Garamond', Georgia, serif"
            }}>
              Goals
            </h2>
            <span style={{
              fontSize: '12px',
              color: colors.textTertiary
            }}>
              Tap to expand
            </span>
          </div>
          {goals.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', pointerEvents: 'none' }}>
              {goals.slice(0, 3).map(goal => (
                <div key={goal.id} style={{
                  padding: '10px 12px',
                  background: colors.bgSecondary,
                  borderRadius: '6px',
                  fontSize: '13px',
                  color: colors.textSecondary
                }}>
                  {goal.title}
                </div>
              ))}
              {goals.length > 3 && (
                <div style={{
                  fontSize: '12px',
                  color: colors.textTertiary,
                  textAlign: 'center'
                }}>
                  +{goals.length - 3} more
                </div>
              )}
            </div>
          )}
        </button>
      </div>
    </div>
  )
}
