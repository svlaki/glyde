import { useState, useEffect, useRef, useCallback } from 'react'
import { useTheme } from '../lib/themeContext'
import { useAuth } from '../lib/authContext'
import { useAspects } from '../lib/aspectContext'
import type { Aspect } from '../lib/aspectContext'
import { VerticalSidebar, SIDEBAR_WIDTH } from '../components/VerticalSidebar'
import { getColors, hexToRgba } from '../styles/colors'
import { getTypography } from '../styles/typography'
import { fetchUserNotes, createUserNotes, updateUserNotes, deleteUserNotes, syncNoteLinks, searchNotesFulltext } from '../lib/notesService'
import type { SearchResult } from '../lib/notesService'
import { fetchUserGoals, updateUserGoal, deleteUserGoal } from '../lib/goalService'
import type { Goal } from '../lib/goalService'
import { updateUserAspect } from '../lib/aspectService'
import type { Note } from '../lib/notesService'
import { supabase } from '../lib/supabase'
import { usePlatform } from '../hooks/usePlatform'
import { MobileHeader } from '../components/mobile/MobileHeader'
import { mobileStyles, mobileSpacing } from '../styles/mobileStyles'
import { NoteEditor } from '../components/notes/NoteEditor'
import { NoteGraph } from '../components/notes/NoteGraph'
import { BacklinksPanel } from '../components/notes/BacklinksPanel'
import { TemplatePicker } from '../components/notes/TemplatePicker'
import { FloatingChat } from '../components/FloatingChat'
import { useKnowledgeGraph } from '../hooks/useKnowledgeGraph'
import { createEntityLink, deleteEntityLink, saveGraphPositions } from '../lib/knowledgeGraphService'
import { extractWikiLinks } from '../lib/wikiLinkParser'

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
  const { data: graphData, isLoading: graphLoading, refetch: refetchGraph } = useKnowledgeGraph()

  const [allNotes, setAllNotes] = useState<Note[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
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
  const [newNoteContent, setNewNoteContent] = useState('')
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)

  // Search
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const searchRef = useRef<HTMLDivElement>(null)

  // Title editing
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const titleInputRef = useRef<HTMLInputElement>(null)

  // Entity viewing (goal/aspect from graph click)
  const [viewingEntity, setViewingEntity] = useState<{
    type: 'goal' | 'aspect'
    id: string
    title: string
    description: string
    color: string
  } | null>(null)
  const [entityEditContent, setEntityEditContent] = useState('')

  // Resizable panel state
  const [leftWidth, setLeftWidth] = useState(() => {
    const saved = localStorage.getItem('notes-left-width')
    return saved ? parseInt(saved) : 450
  })
  const [isResizingLeft, setIsResizingLeft] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Sort user notes by recent, filtering out scribe notes from the dropdown
  const sortedNotes = [...allNotes]
    .filter(n => n.source !== 'scribe')
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())

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
      const content = selectedNote.content || ''
      setEditContent(content)
      latestContentRef.current = content
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
        const notesResult = await fetchUserNotes(user, session.access_token)

        if (!isSubscribed) return

        if (notesResult.error) {
          console.error('Error loading notes:', notesResult.error)
        }

        if (!isEditingRef.current) {
          setAllNotes(notesResult.notes)
          // Auto-select first note if none selected or selection no longer valid
          if (notesResult.notes.length > 0) {
            const currentValid = notesResult.notes.some(n => n.id === selectedNoteId)
            if (!currentValid) {
              setSelectedNoteId(notesResult.notes[0]?.id ?? null)
            }
          }
        }
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
      supabase.removeChannel(notesChannel)
    }
  }, [user, session])

  // Sync wiki-links after saving note content
  const syncLinksForNote = useCallback(async (noteId: string, content: string) => {
    if (!user || !session?.access_token) return
    const titles = extractWikiLinks(content)
    await syncNoteLinks(user, session.access_token, noteId, titles)
    refetchGraph()
  }, [user, session?.access_token, refetchGraph])

  // Full-text search handler
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query)
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    if (!query.trim()) {
      setSearchResults([])
      setIsSearching(false)
      return
    }
    setIsSearching(true)
    searchTimeoutRef.current = setTimeout(async () => {
      if (!user || !session?.access_token) return
      const result = await searchNotesFulltext(user, session.access_token, query.trim())
      setSearchResults(result.notes)
      setIsSearching(false)
    }, 300)
  }, [user, session?.access_token])

  // Handle wiki-link click: navigate to linked note or create it
  const handleWikiLinkClick = useCallback(async (title: string) => {
    const existing = allNotes.find(n => n.title.toLowerCase() === title.toLowerCase())
    if (existing) {
      setSelectedNoteId(existing.id)
    } else if (user && session?.access_token) {
      // Create new note with the default aspect
      const defaultAspectId = aspects.length > 0 ? aspects[0]?.id ?? '' : ''
      if (!defaultAspectId) return
      const result = await createUserNotes(user, session.access_token, {
        title,
        content: '',
        aspect_id: defaultAspectId,
        status: 'active'
      })
      if (result.note) {
        const notesResult = await fetchUserNotes(user, session.access_token)
        if (!notesResult.error) {
          setAllNotes(notesResult.notes)
        }
        setSelectedNoteId(result.note.id)
      }
    }
  }, [allNotes, user, session?.access_token, aspects])

  const handleCreateNote = async () => {
    if (!user || !session?.access_token || !newNoteTitle.trim()) return

    const result = await createUserNotes(user, session.access_token, {
      title: newNoteTitle.trim(),
      content: newNoteContent,
      aspect_id: newNoteAspectId || undefined,
      status: 'active'
    })

    if (result.note) {
      const notesResult = await fetchUserNotes(user, session.access_token)
      if (!notesResult.error) {
        setAllNotes(notesResult.notes)
      }
      setSelectedNoteId(result.note.id)
      setEditContent(newNoteContent)
      setIsCreating(false)
      setNewNoteTitle('')
      setNewNoteAspectId('')
      setNewNoteContent('')
      setShowTemplatePicker(false)
    } else if (result.error) {
      setError(result.error)
    }
  }

  // Refs to track editing state -- avoids stale closures in save callbacks
  const editingNoteIdRef = useRef<string | null>(null)
  const latestContentRef = useRef<string>('')

  const handleContentChange = (newContent: string) => {
    setEditContent(newContent)
    latestContentRef.current = newContent
    isEditingRef.current = true
    const noteId = selectedNoteId
    editingNoteIdRef.current = noteId

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(async () => {
      if (!user || !session?.access_token || !noteId) return

      await updateUserNotes(user, session.access_token, noteId, {
        content: newContent
      })
      syncLinksForNote(noteId, newContent)
      if (editingNoteIdRef.current === noteId) {
        isEditingRef.current = false
      }
    }, 1000)
  }

  const handleBlur = useCallback(async () => {
    const noteId = editingNoteIdRef.current || selectedNoteId
    const content = latestContentRef.current

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = null
    }

    isEditingRef.current = false
    editingNoteIdRef.current = null

    if (!user || !session?.access_token || !noteId) return

    // Always save -- the ref has the latest content regardless of React state timing
    await updateUserNotes(user, session.access_token, noteId, {
      content
    })
    syncLinksForNote(noteId, content)
  }, [selectedNoteId, user, session?.access_token, syncLinksForNote])

  const handleStartEditTitle = () => {
    if (!selectedNote) return
    setEditTitle(selectedNote.title)
    setIsEditingTitle(true)
    setTimeout(() => titleInputRef.current?.focus(), 0)
  }

  const handleSaveTitle = async () => {
    setIsEditingTitle(false)
    if (!user || !session?.access_token || !selectedNote) return
    const trimmed = editTitle.trim()
    if (!trimmed || trimmed === selectedNote.title) return

    await updateUserNotes(user, session.access_token, selectedNote.id, {
      title: trimmed
    })
    const notesResult = await fetchUserNotes(user, session.access_token)
    if (!notesResult.error) {
      setAllNotes(notesResult.notes)
    }
  }

  const selectNote = useCallback(async (noteId: string) => {
    // Save current note before switching
    if (isEditingRef.current || saveTimeoutRef.current) {
      await handleBlur()
    }
    isEditingRef.current = false
    editingNoteIdRef.current = null
    setViewingEntity(null)
    setSelectedNoteId(noteId)
    setDropdownOpen(false)
    setIsEditingTitle(false)
    // Immediately sync editor content
    const note = allNotes.find(n => n.id === noteId)
    const content = note?.content || ''
    setEditContent(content)
    latestContentRef.current = content
  }, [allNotes, handleBlur])

  // Handle graph node click for goals/aspects
  const handleGraphNodeClick = useCallback(async (nodeType: string, nodeId: string) => {
    if (nodeType === 'note') {
      selectNote(nodeId)
      return
    }

    if (nodeType === 'goal' && user && session?.access_token) {
      const { goals } = await fetchUserGoals(user, session.access_token)
      const goal = goals.find((g: Goal) => g.id === nodeId)
      if (goal) {
        // Look up aspect color from the graph data or aspects list
        const goalAspect = graphData.goals.find(g => g.id === nodeId)
        const goalColor = goalAspect?.aspect_color || aspects.find(a => a.name === goal.aspect)?.color || '#6b7280'
        setViewingEntity({
          type: 'goal',
          id: goal.id,
          title: goal.title,
          description: goal.description || '',
          color: goalColor,
        })
        setEntityEditContent(goal.description || '')
        setSelectedNoteId(null)
      }
    }

    if (nodeType === 'aspect') {
      const aspect = aspects.find(a => a.id === nodeId)
      if (aspect) {
        setViewingEntity({
          type: 'aspect',
          id: aspect.id,
          title: aspect.name,
          description: aspect.description || '',
          color: aspect.color || '#6b7280',
        })
        setEntityEditContent(aspect.description || '')
        setSelectedNoteId(null)
      }
    }
  }, [user, session?.access_token, aspects, graphData, selectNote])

  const handleEntityDescriptionSave = useCallback(async () => {
    if (!viewingEntity || !user || !session?.access_token) return
    if (entityEditContent === viewingEntity.description) return

    if (viewingEntity.type === 'goal') {
      await updateUserGoal(user, session.access_token, viewingEntity.id, {
        description: entityEditContent,
      })
    } else if (viewingEntity.type === 'aspect') {
      await updateUserAspect(user, viewingEntity.id, {
        description: entityEditContent,
      }, session.access_token)
    }

    setViewingEntity(prev => prev ? { ...prev, description: entityEditContent } : null)
  }, [viewingEntity, entityEditContent, user, session?.access_token])

  const handleGraphBackgroundAction = useCallback((action: string) => {
    if (action === 'new-note') {
      setViewingEntity(null)
      setIsCreating(true)
      if (!newNoteAspectId && aspects.length > 0) {
        setNewNoteAspectId(aspects[0]?.id ?? '')
      }
    }
    if (action === 'new-goal') {
      // TODO: open goal creation UI when available
    }
  }, [aspects, newNoteAspectId])

  const handleNodeAction = useCallback(async (action: string, nodeType: string, nodeId: string) => {
    if (!user || !session?.access_token) return
    if (action === 'archive' && nodeType === 'aspect') {
      await updateUserAspect(user, nodeId, { archived_at: new Date().toISOString() }, session.access_token)
      refetchGraph()
    } else if (action === 'delete' && nodeType === 'goal') {
      await deleteUserGoal(user, session.access_token, nodeId)
      refetchGraph()
    } else if (action === 'delete' && nodeType === 'note') {
      await deleteUserNotes(user, session.access_token, nodeId)
      setAllNotes(prev => prev.filter(n => n.id !== nodeId))
      if (selectedNoteId === nodeId) {
        setSelectedNoteId(null)
        setEditContent('')
      }
      refetchGraph()
    }
  }, [user, session?.access_token, selectedNoteId, refetchGraph])

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
        className="page-enter"
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
                  setNewNoteAspectId(aspects[0]?.id ?? '')
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

              {dropdownOpen && sortedNotes.length > 0 && (
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
                  {sortedNotes.map(note => (
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

          {/* Search bar */}
          <div ref={searchRef} style={{ position: 'relative', flexShrink: 0 }}>
            <input
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                background: isDarkMode ? '#1f2937' : '#f9fafb',
                color: colors.textPrimary,
                border: `1px solid ${colors.border}`,
                borderRadius: '6px',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            {searchQuery.trim() && (
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
                zIndex: 60,
                maxHeight: '300px',
                overflow: 'auto'
              }}>
                {isSearching ? (
                  <div style={{ padding: '12px', fontSize: '13px', color: colors.textTertiary, textAlign: 'center' }}>
                    Searching...
                  </div>
                ) : searchResults.length === 0 ? (
                  <div style={{ padding: '12px', fontSize: '13px', color: colors.textTertiary, textAlign: 'center' }}>
                    No results found
                  </div>
                ) : (
                  searchResults.map(result => (
                    <button
                      key={result.id}
                      onClick={() => {
                        selectNote(result.id)
                        setSearchQuery('')
                        setSearchResults([])
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        borderBottom: `1px solid ${colors.border}`,
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}>
                        <span style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: result.aspect_color || '#6b7280',
                          flexShrink: 0,
                        }} />
                        <span style={{
                          fontSize: '13px',
                          fontWeight: 600,
                          color: colors.textPrimary,
                          flex: 1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {result.title}
                        </span>
                        <span style={{ fontSize: '11px', color: colors.textTertiary, flexShrink: 0 }}>
                          {result.aspect_name}
                        </span>
                      </div>
                      {result.content && (
                        <span style={{
                          fontSize: '12px',
                          color: colors.textSecondary,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          paddingLeft: '16px',
                        }}>
                          {result.content.slice(0, 100)}
                        </span>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
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
              {/* Template picker */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowTemplatePicker(!showTemplatePicker)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'transparent',
                    color: showTemplatePicker ? colors.textPrimary : colors.textTertiary,
                    border: `1px dashed ${colors.border}`,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    textAlign: 'left',
                  }}
                >
                  {newNoteContent ? 'Template applied' : 'Use a template (optional)'}
                </button>
                {showTemplatePicker && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', zIndex: 60 }}>
                    <TemplatePicker
                      onSelect={(content) => {
                        setNewNoteContent(content)
                        setShowTemplatePicker(false)
                      }}
                      onClose={() => setShowTemplatePicker(false)}
                    />
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={handleCreateNote}
                  disabled={!newNoteTitle.trim()}
                  style={{
                    flex: 1,
                    padding: '8px',
                    background: (!newNoteTitle.trim()) ? '#6b7280' : '#3b82f6',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: (!newNoteTitle.trim()) ? 'not-allowed' : 'pointer',
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
                    setNewNoteContent('')
                    setShowTemplatePicker(false)
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
            {viewingEntity ? (
              <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                padding: '20px',
                background: `linear-gradient(135deg, ${hexToRgba(viewingEntity.color, 0.03)} 0%, transparent 50%)`
              }}>
                {/* Entity type badge */}
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
                    background: viewingEntity.color
                  }} />
                  <span style={{
                    fontSize: '12px',
                    color: viewingEntity.color,
                    fontWeight: '500',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    {viewingEntity.type}
                  </span>
                </div>

                <h2 style={{
                  ...typography.headingLg,
                  margin: 0,
                  fontWeight: 600,
                  color: colors.textPrimary,
                  padding: '4px 8px',
                  marginBottom: '12px',
                }}>
                  {viewingEntity.title}
                </h2>

                <label style={{
                  fontSize: '12px',
                  color: colors.textTertiary,
                  fontWeight: 500,
                  marginBottom: '6px',
                  paddingLeft: '8px',
                }}>
                  Description
                </label>
                <textarea
                  value={entityEditContent}
                  onChange={(e) => setEntityEditContent(e.target.value)}
                  onBlur={handleEntityDescriptionSave}
                  placeholder={`Add a description for this ${viewingEntity.type}...`}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: isDarkMode ? '#1e293b' : '#f9fafb',
                    color: colors.textPrimary,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '8px',
                    fontSize: '14px',
                    lineHeight: '1.6',
                    resize: 'none',
                    outline: 'none',
                    fontFamily: 'inherit',
                  }}
                />

                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  <button
                    onClick={() => setViewingEntity(null)}
                    style={{
                      padding: '6px 14px',
                      background: 'transparent',
                      color: colors.textSecondary,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '13px',
                    }}
                  >
                    Back to notes
                  </button>
                  {viewingEntity.type === 'aspect' && (
                    <button
                      onClick={async () => {
                        if (!user || !session?.access_token) return
                        await updateUserAspect(user, viewingEntity.id, { archived_at: new Date().toISOString() }, session.access_token)
                        setViewingEntity(null)
                        refetchGraph()
                      }}
                      style={{
                        padding: '6px 14px',
                        background: 'transparent',
                        color: '#ef4444',
                        border: '1px solid #ef4444',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '13px',
                      }}
                    >
                      Archive aspect
                    </button>
                  )}
                  {viewingEntity.type === 'goal' && (
                    <button
                      onClick={async () => {
                        if (!user || !session?.access_token) return
                        await deleteUserGoal(user, session.access_token, viewingEntity.id)
                        setViewingEntity(null)
                        refetchGraph()
                      }}
                      style={{
                        padding: '6px 14px',
                        background: 'transparent',
                        color: '#ef4444',
                        border: '1px solid #ef4444',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '13px',
                      }}
                    >
                      Delete goal
                    </button>
                  )}
                  {viewingEntity.type === 'note' && (
                    <button
                      onClick={async () => {
                        if (!user || !session?.access_token) return
                        await deleteUserNotes(user, session.access_token, viewingEntity.id)
                        setAllNotes(prev => prev.filter(n => n.id !== viewingEntity.id))
                        setViewingEntity(null)
                        refetchGraph()
                      }}
                      style={{
                        padding: '6px 14px',
                        background: 'transparent',
                        color: '#ef4444',
                        border: '1px solid #ef4444',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '13px',
                      }}
                    >
                      Delete note
                    </button>
                  )}
                </div>
              </div>
            ) : allNotes.length === 0 ? (
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
                      setNewNoteAspectId(aspects[0]?.id ?? '')
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

                {/* Editable Title */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '12px',
                  flexShrink: 0
                }}>
                  {isEditingTitle ? (
                    <input
                      ref={titleInputRef}
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onBlur={handleSaveTitle}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveTitle()
                        if (e.key === 'Escape') setIsEditingTitle(false)
                      }}
                      style={{
                        ...typography.headingLg,
                        margin: 0,
                        fontWeight: 600,
                        color: colors.textPrimary,
                        background: 'transparent',
                        border: `1px solid ${colors.border}`,
                        borderRadius: '6px',
                        padding: '4px 8px',
                        outline: 'none',
                        flex: 1,
                        marginRight: '12px',
                      }}
                    />
                  ) : (
                    <h2
                      className="editable-title"
                      onClick={handleStartEditTitle}
                      style={{
                        ...typography.headingLg,
                        margin: 0,
                        fontWeight: 600,
                        color: colors.textPrimary,
                        padding: '4px 8px',
                        cursor: 'text',
                        flex: 1,
                        marginRight: '12px',
                      }}
                      title="Click to rename"
                    >
                      {selectedNote.title}
                    </h2>
                  )}
                </div>

                {/* Content - TipTap Editor */}
                <NoteEditor
                  content={editContent}
                  onChange={handleContentChange}
                  onWikiLinkClick={handleWikiLinkClick}
                  notes={allNotes}
                  placeholder="Start typing... Use [[ to link notes"
                />

                <BacklinksPanel
                  noteId={selectedNote.id}
                  onNoteClick={selectNote}
                />
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

        {/* RIGHT COLUMN - Knowledge Graph */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minWidth: '300px'
        }}>
          <NoteGraph
            graphData={graphData}
            onNodeClick={handleGraphNodeClick}
            onCreateLink={async (sourceType, sourceId, targetType, targetId) => {
              if (!session?.access_token) return
              await createEntityLink(session.access_token, sourceType, sourceId, targetType, targetId)
              refetchGraph()
            }}
            onDeleteLink={async (linkId) => {
              if (!session?.access_token) return
              await deleteEntityLink(session.access_token, linkId)
              refetchGraph()
            }}
            onSavePositions={async (positions) => {
              if (!session?.access_token) return
              await saveGraphPositions(session.access_token, positions)
            }}
            onBackgroundAction={handleGraphBackgroundAction}
            onNodeAction={handleNodeAction}
            isLoading={graphLoading}
          />
        </div>
      </div>

      <FloatingChat currentPageOverride="notes" />
    </div>
  )
}

// ============================================================
// MOBILE
// ============================================================

type MobileView = 'list' | 'edit' | 'graph' | 'create'

function NotesPageMobile() {
  const { theme, isDarkMode } = useTheme()
  const { user, session } = useAuth()
  const { aspects } = useAspects()
  const colors = getColors(theme)
  const { data: graphData, isLoading: graphLoading, refetch: refetchGraph } = useKnowledgeGraph()

  const [allNotes, setAllNotes] = useState<Note[]>([])
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
  const [newNoteContent, setNewNoteContent] = useState('')
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)

  // Title editing
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editTitle, setEditTitle] = useState('')

  // Sort user notes by recent, filtering out scribe notes from the list
  const sortedNotes = [...allNotes]
    .filter(n => n.source !== 'scribe')
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())

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
        const notesResult = await fetchUserNotes(user, session.access_token)

        if (!isSubscribed) return

        if (notesResult.error) {
          console.error('Error loading notes:', notesResult.error)
        }

        if (!isEditingRef.current) {
          setAllNotes(notesResult.notes)
        }
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
      supabase.removeChannel(notesChannel)
    }
  }, [user, session])

  // Sync wiki-links after saving note content
  const syncLinksForNote = useCallback(async (noteId: string, content: string) => {
    if (!user || !session?.access_token) return
    const titles = extractWikiLinks(content)
    await syncNoteLinks(user, session.access_token, noteId, titles)
    refetchGraph()
  }, [user, session?.access_token, refetchGraph])

  // Handle wiki-link click: navigate to linked note or create it
  const handleWikiLinkClick = useCallback(async (title: string) => {
    const existing = allNotes.find(n => n.title.toLowerCase() === title.toLowerCase())
    if (existing) {
      setSelectedNoteId(existing.id)
      setEditContent(existing.content || '')
      setMobileView('edit')
    } else if (user && session?.access_token) {
      const defaultAspectId = aspects.length > 0 ? aspects[0]?.id ?? '' : ''
      if (!defaultAspectId) return
      const result = await createUserNotes(user, session.access_token, {
        title,
        content: '',
        aspect_id: defaultAspectId,
        status: 'active'
      })
      if (result.note) {
        const notesResult = await fetchUserNotes(user, session.access_token)
        if (!notesResult.error) {
          setAllNotes(notesResult.notes)
        }
        setSelectedNoteId(result.note.id)
        setEditContent('')
        setMobileView('edit')
      }
    }
  }, [allNotes, user, session?.access_token, aspects])

  const handleCreateNote = async () => {
    if (!user || !session?.access_token || !newNoteTitle.trim()) return

    const result = await createUserNotes(user, session.access_token, {
      title: newNoteTitle.trim(),
      content: newNoteContent,
      aspect_id: newNoteAspectId || undefined,
      status: 'active'
    })

    if (result.note) {
      const notesResult = await fetchUserNotes(user, session.access_token)
      if (!notesResult.error) {
        setAllNotes(notesResult.notes)
      }
      setSelectedNoteId(result.note.id)
      setEditContent(newNoteContent)
      setNewNoteTitle('')
      setNewNoteAspectId('')
      setNewNoteContent('')
      setShowTemplatePicker(false)
      setMobileView('edit')
    } else if (result.error) {
      setError(result.error)
    }
  }

  // Track which note is being edited so saves target the correct note
  const editingNoteIdRef = useRef<string | null>(null)

  const handleContentChange = (newContent: string) => {
    setEditContent(newContent)
    isEditingRef.current = true
    const noteId = selectedNoteId
    editingNoteIdRef.current = noteId

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(async () => {
      if (!user || !session?.access_token || !noteId) return

      await updateUserNotes(user, session.access_token, noteId, {
        content: newContent
      })
      syncLinksForNote(noteId, newContent)
      if (editingNoteIdRef.current === noteId) {
        isEditingRef.current = false
      }
    }, 1000)
  }

  const handleBlur = async () => {
    const noteId = editingNoteIdRef.current || selectedNoteId
    setIsEditing(false)
    isEditingRef.current = false
    editingNoteIdRef.current = null

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = null
    }

    if (!user || !session?.access_token || !noteId) return

    const originalNote = allNotes.find(n => n.id === noteId)
    if (editContent === (originalNote?.content || '')) return

    await updateUserNotes(user, session.access_token, noteId, {
      content: editContent
    })
    syncLinksForNote(noteId, editContent)
  }

  const openNote = (noteId: string) => {
    setSelectedNoteId(noteId)
    const note = allNotes.find(n => n.id === noteId)
    setEditContent(note?.content || '')
    setIsEditing(false)
    setIsEditingTitle(false)
    setMobileView('edit')
  }

  const handleStartEditTitle = () => {
    if (!selectedNote) return
    setEditTitle(selectedNote.title)
    setIsEditingTitle(true)
  }

  const handleSaveTitle = async () => {
    setIsEditingTitle(false)
    if (!user || !session?.access_token || !selectedNote) return
    const trimmed = editTitle.trim()
    if (!trimmed || trimmed === selectedNote.title) return

    await updateUserNotes(user, session.access_token, selectedNote.id, {
      title: trimmed
    })
    const notesResult = await fetchUserNotes(user, session.access_token)
    if (!notesResult.error) {
      setAllNotes(notesResult.notes)
    }
  }

  const handleMobileNodeAction = useCallback(async (action: string, nodeType: string, nodeId: string) => {
    if (!user || !session?.access_token) return
    if (action === 'archive' && nodeType === 'aspect') {
      await updateUserAspect(user, nodeId, { archived_at: new Date().toISOString() }, session.access_token)
      refetchGraph()
    } else if (action === 'delete' && nodeType === 'goal') {
      await deleteUserGoal(user, session.access_token, nodeId)
      refetchGraph()
    } else if (action === 'delete' && nodeType === 'note') {
      await deleteUserNotes(user, session.access_token, nodeId)
      setAllNotes(prev => prev.filter(n => n.id !== nodeId))
      if (selectedNoteId === nodeId) {
        setSelectedNoteId(null)
        setEditContent('')
        setMobileView('list')
      }
      refetchGraph()
    }
  }, [user, session?.access_token, selectedNoteId, refetchGraph])

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
            setNewNoteContent('')
            setShowTemplatePicker(false)
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
            {/* Template picker */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowTemplatePicker(!showTemplatePicker)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: 'transparent',
                  color: newNoteContent ? colors.textPrimary : colors.textTertiary,
                  border: `1px dashed ${colors.border}`,
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  textAlign: 'left',
                  minHeight: '44px',
                }}
              >
                {newNoteContent ? 'Template applied' : 'Use a template (optional)'}
              </button>
              {showTemplatePicker && (
                <div style={{ marginTop: '4px' }}>
                  <TemplatePicker
                    onSelect={(content) => {
                      setNewNoteContent(content)
                      setShowTemplatePicker(false)
                    }}
                    onClose={() => setShowTemplatePicker(false)}
                    isMobile={true}
                  />
                </div>
              )}
            </div>

            <button
              onClick={handleCreateNote}
              disabled={!newNoteTitle.trim()}
              style={{
                padding: '14px',
                background: (!newNoteTitle.trim()) ? '#6b7280' : '#3b82f6',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                cursor: (!newNoteTitle.trim()) ? 'not-allowed' : 'pointer',
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
          title={isEditingTitle ? '' : selectedNote.title}
          onBack={() => {
            handleBlur()
            setIsEditingTitle(false)
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
          {/* Editable title */}
          {isEditingTitle ? (
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={handleSaveTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveTitle()
                if (e.key === 'Escape') setIsEditingTitle(false)
              }}
              autoFocus
              style={{
                fontSize: '18px',
                fontWeight: 600,
                fontFamily: "'EB Garamond', Georgia, serif",
                color: colors.textPrimary,
                background: 'transparent',
                border: `1px solid ${colors.border}`,
                borderRadius: '8px',
                padding: '8px 12px',
                outline: 'none',
                width: '100%',
                marginBottom: '12px',
              }}
            />
          ) : (
            <h2
              onClick={handleStartEditTitle}
              style={{
                fontSize: '18px',
                fontWeight: 600,
                fontFamily: "'EB Garamond', Georgia, serif",
                color: colors.textPrimary,
                margin: '0 0 12px 0',
                padding: '4px 0',
                cursor: 'text',
              }}
              title="Tap to rename"
            >
              {selectedNote.title}
            </h2>
          )}

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

          <NoteEditor
            content={editContent}
            onChange={handleContentChange}
            onWikiLinkClick={handleWikiLinkClick}
            notes={allNotes}
            placeholder="Start typing... Use [[ to link notes"
            isMobile={true}
          />

          <BacklinksPanel
            noteId={selectedNote.id}
            onNoteClick={(id) => openNote(id)}
            isMobile={true}
          />
        </div>
      </div>
    )
  }

  // ============ FULLSCREEN: Knowledge Graph ============
  if (mobileView === 'graph') {
    return (
      <div style={mobileStyles.fullHeight}>
        <MobileHeader
          title="Knowledge Graph"
          onBack={() => setMobileView('list')}
        />
        <div style={{
          flex: 1,
          overflow: 'hidden',
          background: colors.bgPrimary,
        }}>
          <NoteGraph
            graphData={graphData}
            onNodeClick={(nodeType, nodeId) => {
              if (nodeType === 'note') {
                setSelectedNoteId(nodeId)
                const note = allNotes.find(n => n.id === nodeId)
                if (note) {
                  setEditContent(note.content || '')
                  setMobileView('edit')
                }
              }
            }}
            onCreateLink={async (sourceType, sourceId, targetType, targetId) => {
              if (!session?.access_token) return
              await createEntityLink(session.access_token, sourceType, sourceId, targetType, targetId)
              refetchGraph()
            }}
            onDeleteLink={async (linkId) => {
              if (!session?.access_token) return
              await deleteEntityLink(session.access_token, linkId)
              refetchGraph()
            }}
            onSavePositions={async (positions) => {
              if (!session?.access_token) return
              await saveGraphPositions(session.access_token, positions)
            }}
            onNodeAction={handleMobileNodeAction}
            isLoading={graphLoading}
          />
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
                setNewNoteAspectId(aspects[0]?.id ?? '')
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
        {sortedNotes.length === 0 ? (
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
            {sortedNotes.map(note => {
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

        {/* Knowledge Graph card */}
        <button
          onClick={() => setMobileView('graph')}
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
          }}>
            <h2 style={{
              margin: 0,
              fontSize: '18px',
              fontWeight: '600',
              color: colors.textPrimary,
              fontFamily: "'EB Garamond', Georgia, serif"
            }}>
              Knowledge Graph
            </h2>
            <span style={{
              fontSize: '12px',
              color: colors.textTertiary
            }}>
              Tap to explore
            </span>
          </div>
          <p style={{
            margin: '8px 0 0',
            fontSize: '13px',
            color: colors.textSecondary
          }}>
            {graphData.notes.length} notes, {graphData.goals.length} goals, {graphData.links.length} connections
          </p>
        </button>
      </div>
    </div>
  )
}
