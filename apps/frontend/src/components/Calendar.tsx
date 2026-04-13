import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useAuth } from '../lib/authContext'
import { useAspects } from '../lib/aspectContext'
import { useTheme } from '../lib/themeContext'
import { fetchExpandedEvents, fetchFriendsEvents, updateEvent, deleteEvent, createEvent, updateRecurringEvent, deleteRecurringEvent } from '../lib/calendarService'
import type { CalendarEvent } from '../lib/calendarService'
import { supabase } from '../lib/supabase'
import { getColors, hexToRgba } from '../styles/colors'
import { getTypography, fontFamily, fontSize, fontWeight } from '../styles/typography'
import { EventCard } from './calendar/EventCard'
import { EventFormWrapper } from './calendar/EventFormWrapper'
import { getRecurrenceBadge } from '../lib/recurrenceUtils'
import { computeDayEventLayouts } from '../lib/calendarLayoutUtils'
import { fetchUserSlots, fetchUserSuggestions, moveSlot as moveSlotApi, resizeSlot as resizeSlotApi, swapSlot, confirmSlot, dismissSlot, replenishSlots, generateSuggestionsBatch } from '../lib/suggestionService'
import type { SlotWithSuggestion, ActionSuggestion } from '../lib/suggestionService'
import { SlotBlock } from './SlotBlock'
import { useHorizontalWeekScroll } from '../hooks/useHorizontalWeekScroll'
import { usePointerDrag } from '../hooks/usePointerDrag'
import type { DropTarget } from '../hooks/usePointerDrag'

type ViewType = 'day' | 'week' | 'month'

export function Calendar() {
  const { user, session } = useAuth()
  const { getAspectColor, getAspectById } = useAspects()
  const { theme, isDarkMode } = useTheme()
  const colors = getColors(theme)
  const typography = getTypography(false) // Desktop-scaled mobile fonts
  const [currentDate, setCurrentDate] = useState(new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [friendsEvents, setFriendsEvents] = useState<CalendarEvent[]>([])
  const [showFriendsEvents, setShowFriendsEvents] = useState(() => {
    const saved = localStorage.getItem('calendar-show-friends-events')
    return saved !== 'false' // Default to true
  })
  const [view, setView] = useState<ViewType>('week')
  const [currentTime, setCurrentTime] = useState(new Date())
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [draggingEvent, setDraggingEvent] = useState<CalendarEvent | null>(null)
  const [dragPreview, setDragPreview] = useState<{ date: Date; hour: number; quarter: number } | null>(null)
  const [expandedAllDayDates, setExpandedAllDayDates] = useState<Set<string>>(new Set())
  const [slots, setSlots] = useState<SlotWithSuggestion[]>([])
  const [allSuggestions, setAllSuggestions] = useState<ActionSuggestion[]>([])
  const [slotSuggestionIndex, setSlotSuggestionIndex] = useState<Record<string, number>>({})
  // draggingSlot removed — slots now use unified pointer drag system
  const [resizingSlot, setResizingSlot] = useState<SlotWithSuggestion | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const timeGutterRef = useRef<HTMLDivElement>(null)

  const { getBufferedWeekDates } = useHorizontalWeekScroll({
    scrollRef: scrollContainerRef,
    currentDate,
    onDateChange: setCurrentDate,
    view,
  })

  // Refs for high-performance drag ghost and preview (direct DOM, no React re-render)
  const dragGhostRef = useRef<HTMLDivElement>(null)
  const dragPreviewLineRef = useRef<HTMLDivElement>(null)

  // Unified pointer drag drop handler for both events and slots
  const handlePointerDrop = useCallback(async (sourceId: string, target: DropTarget, sourceType: 'event' | 'slot') => {
    if (!user) return

    const newStart = new Date(target.date)
    newStart.setHours(target.hour, target.quarter * 15, 0, 0)

    if (sourceType === 'slot') {
      const slot = slots.find(s => s.id === sourceId)
      if (!slot) return
      const originalStart = new Date(slot.start_time)
      const originalEnd = new Date(slot.end_time)
      const duration = originalEnd.getTime() - originalStart.getTime()
      const newEnd = new Date(newStart.getTime() + duration)

      setSlots(prev => prev.map(s =>
        s.id === sourceId
          ? { ...s, start_time: newStart.toISOString(), end_time: newEnd.toISOString() }
          : s
      ))
      await moveSlotApi(user, sourceId, newStart.toISOString(), newEnd.toISOString(), session?.access_token)
      return
    }

    // Event drag
    const event = events.find(e => e.id === sourceId)
    if (!event) return

    const originalStart = new Date(event.start_time)
    const originalEnd = new Date(event.end_time)
    const duration = originalEnd.getTime() - originalStart.getTime()
    const newEnd = new Date(newStart.getTime() + duration)

    setEvents(prev => prev.map(e =>
      e.id === sourceId
        ? { ...e, start_time: newStart.toISOString(), end_time: newEnd.toISOString() }
        : e
    ))

    try {
      const { error } = await updateEvent(
        user,
        sourceId,
        {
          ...event,
          start_time: newStart.toISOString(),
          end_time: newEnd.toISOString(),
        },
        session?.access_token,
      )
      if (error) {
        setEvents(prev => prev.map(e =>
          e.id === sourceId
            ? { ...e, start_time: event.start_time, end_time: event.end_time }
            : e
        ))
      }
    } catch {
      setEvents(prev => prev.map(e =>
        e.id === sourceId
          ? { ...e, start_time: event.start_time, end_time: event.end_time }
          : e
      ))
    }
  }, [user, events, slots, session?.access_token])

  const {
    isDragging: isPointerDragging,
    dragSourceId,
    dragSourceType,
    // Preview indicator is now handled via dragPreviewLineRef (direct DOM)
    startDrag,
    wasDragRef,
  } = usePointerDrag({
    scrollContainerRef,
    ghostRef: dragGhostRef,
    previewRef: dragPreviewLineRef,
    onDrop: handlePointerDrop,
  })

  // Start slot drag with sourceType='slot'
  const startSlotDrag = useCallback((e: React.PointerEvent, slotId: string) => {
    startDrag(e, slotId, 'slot')
  }, [startDrag])

  // Helper: fetch events with a 3-month window centered on the viewed date
  const fetchEventsWindowed = useCallback(async (refDate?: Date) => {
    if (!user) return { events: [] as CalendarEvent[], error: null }
    const n = refDate || currentDate
    return fetchExpandedEvents(user, session?.access_token, new Date(n.getFullYear(), n.getMonth() - 1, 1), new Date(n.getFullYear(), n.getMonth() + 2, 0))
  }, [user, session?.access_token, currentDate])

  // Persist friends events toggle
  useEffect(() => {
    localStorage.setItem('calendar-show-friends-events', showFriendsEvents.toString())
  }, [showFriendsEvents])

  // Combine user events and friends events for display
  // Viewer events (shared with role='viewer') only show when friends toggle is on
  const allEvents = useMemo(() => {
    const userEvents = events.filter(e => e.user_role !== 'viewer')
    const viewerEvents = events.filter(e => e.user_role === 'viewer')
    return showFriendsEvents
      ? [...userEvents, ...viewerEvents, ...friendsEvents]
      : userEvents
  }, [events, friendsEvents, showFriendsEvents])


  // Get single day
  const getDayDate = (date: Date) => {
    return [new Date(date)]
  }

  // Get month dates (for month view grid)
  const getMonthDates = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startDay = firstDay.getDay()
    const dates = []

    // Add previous month days
    for (let i = startDay - 1; i >= 0; i--) {
      const prevDate = new Date(year, month, -i)
      dates.push(prevDate)
    }

    // Add current month days
    for (let i = 1; i <= lastDay.getDate(); i++) {
      dates.push(new Date(year, month, i))
    }

    // Add next month days to complete 6 weeks (42 days total)
    const totalDays = 42
    for (let i = 1; dates.length < totalDays; i++) {
      dates.push(new Date(year, month + 1, i))
    }

    return dates
  }

  // Get event color based on aspect
  const getEventColor = (event: CalendarEvent): string => {
    // If event has an aspect, use aspect color
    if (event.aspect) {
      return getAspectColor(event.aspect)
    }
    // Otherwise use event's color or default
    return event.color || '#3b82f6'
  }

  // Check if an event is a shared event with viewer-only access (shows with icon/badge)
  // Member events render normally as the user's own events
  const isSharedEvent = (event: CalendarEvent): boolean => {
    return event.is_shared === true && event.user_role === 'viewer' && !event.is_friend_event
  }

  // Check if an event is in the past
  const isEventPast = (event: CalendarEvent): boolean => {
    return new Date(event.end_time) < new Date()
  }

  // Stable callback for selecting events (used by memoized EventCard)
  const handleSelectEvent = useCallback((event: CalendarEvent) => {
    setSelectedEvent(event)
    setIsFormOpen(true)
  }, [])

  // Stable callback for closing the event form
  const handleCloseForm = useCallback(() => {
    setSelectedEvent(null)
    setIsFormOpen(false)
  }, [])

  // Toggle missed status for past events
  const handleToggleMissed = async (event: CalendarEvent) => {
    if (!user || !session) return

    const newMissedStatus = !event.is_missed
    // Use instance_date + start_time as a unique key for optimistic updates on recurring instances
    const matchInstance = (ev: CalendarEvent) =>
      event.is_instance && event.instance_date
        ? ev.id === event.id && ev.instance_date === event.instance_date
        : ev.id === event.id

    // Optimistic update
    setEvents(prev => prev.map(ev =>
      matchInstance(ev) ? { ...ev, is_missed: newMissedStatus } : ev
    ))
    // Also update selectedEvent so the form reflects the change immediately
    setSelectedEvent(prev =>
      prev && matchInstance(prev) ? { ...prev, is_missed: newMissedStatus } : prev
    )
    try {
      let error: string | null = null

      if (event.is_instance && event.instance_date) {
        // Recurring instance - use instance-specific update
        const result = await updateRecurringEvent(
          user,
          event.parent_event_id || event.id,
          'this_instance',
          { is_missed: newMissedStatus, instance_date: event.instance_date, start_time: event.start_time, end_time: event.end_time } as any,
          session.access_token
        )
        error = result.error
      } else {
        // Regular event
        const result = await updateEvent(
          user,
          event.id,
          { is_missed: newMissedStatus },
          session.access_token
        )
        error = result.error
      }

      if (error) {
        // Revert on error
        setEvents(prev => prev.map(ev =>
          matchInstance(ev) ? { ...ev, is_missed: !newMissedStatus } : ev
        ))
        setSelectedEvent(prev =>
          prev && matchInstance(prev) ? { ...prev, is_missed: !newMissedStatus } : prev
        )
      } else {
        // Refresh to get the new override event from the backend
        if (event.is_instance) {
          const { events: refreshed } = await fetchEventsWindowed()
          if (refreshed) setEvents(refreshed)
        }
      }
    } catch (err) {
      console.error('Error toggling missed status:', err)
      setEvents(prev => prev.map(ev =>
        matchInstance(ev) ? { ...ev, is_missed: !newMissedStatus } : ev
      ))
      setSelectedEvent(prev =>
        prev && matchInstance(prev) ? { ...prev, is_missed: !newMissedStatus } : prev
      )
    }
  }

  // Get all-day events for a specific date (must be declared before allDayBannerInfo IIFE)
  const getAllDayEventsForDate = (date: Date) => {
    return allEvents.filter(event => {
      if (!event.is_all_day) return false
      const eventStart = new Date(event.start_time)
      const eventEnd = new Date(event.end_time)
      // All-day event spans this date if: start <= end-of-day AND end >= start-of-day
      const dayStart = new Date(date)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(date)
      dayEnd.setHours(23, 59, 59, 999)
      return eventStart <= dayEnd && eventEnd > dayStart
    }).sort((a, b) => a.title.localeCompare(b.title))
  }

  const displayDates = view === 'day' ? getDayDate(currentDate) : view === 'week' ? getBufferedWeekDates() : getMonthDates(currentDate)
  const hours = Array.from({ length: 24 }, (_, i) => i)

  // Compute all-day banner height for day/week views (uniform across columns)
  const allDayMaxVisible = 2
  const allDayBannerInfo = (() => {
    if (view === 'month') return { maxCount: 0, height: 0 }
    let maxCount = 0
    for (const date of displayDates) {
      const count = getAllDayEventsForDate(date).length
      if (count > maxCount) maxCount = count
    }
    if (maxCount === 0) return { maxCount: 0, height: 0 }
    // Check if any date is expanded
    const anyExpanded = displayDates.some(d => expandedAllDayDates.has(d.toDateString()))
    const visibleCount = anyExpanded ? maxCount : Math.min(maxCount, allDayMaxVisible)
    // Each pill is ~24px + 3px gap, plus 4px padding top/bottom, plus "+N more" row if needed
    const pillHeight = 24
    const gap = 3
    const padding = 8
    const moreRowHeight = maxCount > allDayMaxVisible && !anyExpanded ? 20 : 0
    const lessRowHeight = anyExpanded && maxCount > allDayMaxVisible ? 20 : 0
    const height = padding + (visibleCount * pillHeight) + ((visibleCount - 1) * gap) + moreRowHeight + lessRowHeight + 1 // +1 for border
    return { maxCount, height }
  })()

  // Load events and set up real-time subscription
  useEffect(() => {
    let isSubscribed = true
    let refreshTimer: NodeJS.Timeout | null = null

    async function loadEvents() {
      if (!user) return

      try {
        const now = new Date()
        // Only fetch future slots (no reason to load past suggestion slots)
        const slotStart = now.toISOString()
        const slotEnd = new Date(now.getTime() + 14 * 86400000).toISOString()

        // Fetch all data in parallel
        const [eventsResult, friendsResult, slotsResult, suggestionsResult] = await Promise.all([
          fetchEventsWindowed(),
          fetchFriendsEvents(user, session?.access_token),
          fetchUserSlots(user, slotStart, slotEnd, session?.access_token),
          fetchUserSuggestions(user, { status: 'open' }, session?.access_token),
        ])

        if (isSubscribed) {
          setEvents(eventsResult.events || [])
          setFriendsEvents((friendsResult.events || []).map(e => ({ ...e, is_friend_event: true })))
          setSlots(slotsResult.slots || [])
          setAllSuggestions(suggestionsResult.suggestions || [])

          // If fewer than 5 open suggestions, trigger batch generation (heavy, runs in background)
          const openSuggestions = suggestionsResult.suggestions || []
          if (openSuggestions.length < 5) {
            generateSuggestionsBatch(user, session?.access_token).then(() => {
              // After batch, refetch slots and suggestions
              const now2 = new Date()
              Promise.all([
                fetchUserSlots(user, now2.toISOString(), new Date(now2.getTime() + 14 * 86400000).toISOString(), session?.access_token),
                fetchUserSuggestions(user, { status: 'open' }, session?.access_token),
              ]).then(([slotsRes, sugRes]) => {
                if (isSubscribed) {
                  if (slotsRes.slots) setSlots(slotsRes.slots)
                  if (sugRes.suggestions) setAllSuggestions(sugRes.suggestions)
                }
              })
            })
          } else {
            // Enough suggestions exist — just replenish slots if needed
            const activeSlots = (slotsResult.slots || []).filter(s => s.status === 'proposed' || s.status === 'edited')
            if (activeSlots.length < 4) {
              replenishSlots(user, session?.access_token).then(() => {
                const now2 = new Date()
                fetchUserSlots(user, now2.toISOString(), new Date(now2.getTime() + 14 * 86400000).toISOString(), session?.access_token)
                  .then(({ slots: fresh }) => { if (isSubscribed && fresh) setSlots(fresh) })
              })
            }
          }
        }
      } catch (error) {
        console.error('[Calendar] Error loading events:', error)
      }
    }

    loadEvents()

    // Periodic refresh to catch Google Calendar synced events
    const syncInterval = setInterval(() => {
      if (isSubscribed) loadEvents()
    }, 60000)

    // Listen for agent-initiated data changes (agent creates via service role,
    // which may not trigger Supabase Realtime reliably)
    const handleAgentChange = () => {
      if (isSubscribed) {
        if (refreshTimer) clearTimeout(refreshTimer)
        refreshTimer = setTimeout(() => loadEvents(), 500)
      }
    }
    window.addEventListener('agent-data-changed', handleAgentChange)

    // Set up real-time subscription for events
    if (!user) return

    const channel = supabase
      .channel(`calendar-events-${user.id}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'events',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          if (refreshTimer) {
            clearTimeout(refreshTimer)
          }
          refreshTimer = setTimeout(() => loadEvents(), 500)
        }
      )
      .subscribe()

    // Cleanup subscription on unmount
    return () => {
      isSubscribed = false
      clearInterval(syncInterval)
      if (refreshTimer) {
        clearTimeout(refreshTimer)
      }
      window.removeEventListener('agent-data-changed', handleAgentChange)
      supabase.removeChannel(channel)
    }
  }, [user, session])

  // Re-fetch events when the viewed month changes
  const [lastFetchedMonth, setLastFetchedMonth] = useState(() => `${currentDate.getFullYear()}-${currentDate.getMonth()}`)
  useEffect(() => {
    const key = `${currentDate.getFullYear()}-${currentDate.getMonth()}`
    if (key !== lastFetchedMonth && user) {
      setLastFetchedMonth(key)
      fetchEventsWindowed(currentDate).then(result => {
        if (result.events) setEvents(result.events)
      })
    }
  }, [currentDate, lastFetchedMonth, user, fetchEventsWindowed])

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000) // Update every minute
    return () => clearInterval(timer)
  }, [])

  // Sync time gutter vertical scroll with main scroll container
  useEffect(() => {
    if (view === 'month') return
    const main = scrollContainerRef.current
    const gutter = timeGutterRef.current
    if (!main || !gutter) return
    const handler = () => { gutter.scrollTop = main.scrollTop }
    main.addEventListener('scroll', handler, { passive: true })
    // Set initial sync
    gutter.scrollTop = main.scrollTop
    return () => main.removeEventListener('scroll', handler)
  }, [view])

  // Auto-scroll to 9am when view changes to day/week
  useEffect(() => {
    if ((view === 'day' || view === 'week') && scrollContainerRef.current) {
      // Scroll to 9am: 36px header + all-day banner + 12px spacer + 9 hours * 60px
      scrollContainerRef.current.scrollTop = 36 + allDayBannerInfo.height + 12 + (9 * 60)
    }
  }, [view])

  // Handle clicking a day in month view
  const handleDayClick = (date: Date) => {
    setCurrentDate(date)
    setView('week')
  }

  const formatTime = (hour: number) => {
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    return `${displayHour}${ampm}`
  }


  // Get timed (non-all-day) events for a specific date and hour
  const getEventsForSlot = (date: Date, hour: number) => {
    const filtered = allEvents.filter(event => {
      if (event.is_all_day) return false
      const eventStart = new Date(event.start_time)
      const eventDate = eventStart.toDateString()
      const eventHour = eventStart.getHours()

      const matches = eventDate === date.toDateString() && eventHour === hour

      return matches
    })
    return filtered
  }

  // Get all timed (non-all-day) events for a specific date (for overlap calculation)
  const getEventsForDay = (date: Date) => {
    return allEvents.filter(event => {
      if (event.is_all_day) return false
      const eventStart = new Date(event.start_time)
      return eventStart.toDateString() === date.toDateString()
    })
  }

  // Pinned visible slot IDs — prevents swap-induced aspect changes from
  // destabilizing which 4 slots are shown (the "teleport" bug).
  // Re-picked only when slot count changes (confirm/dismiss/replenish).
  const pinnedSlotIdsRef = useRef<string[]>([])

  // Pick which 4 slots to show. Uses slot IDs (position-stable), not aspect data.
  const pickVisibleSlotIds = useCallback((allSlots: SlotWithSuggestion[]): string[] => {
    // Filter out past slots (end_time already passed)
    const now = Date.now()
    const future = allSlots.filter(s => new Date(s.end_time).getTime() > now)
    const sorted = [...future].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    if (sorted.length <= 4) return sorted.map(s => s.id)

    const picked: string[] = []
    const usedAspects = new Set<string>()

    // Pass 1: one per unique aspect (earliest of each)
    for (const s of sorted) {
      if (picked.length >= 4) break
      const key = s.aspect_id || s.aspect_name || 'none'
      if (!usedAspects.has(key)) {
        usedAspects.add(key)
        picked.push(s.id)
      }
    }

    // Pass 2: fill remaining, prefer different days
    if (picked.length < 4) {
      const usedDays = new Set(picked.map(id => {
        const slot = sorted.find(s => s.id === id)
        return slot ? new Date(slot.start_time).toDateString() : ''
      }))
      for (const s of sorted) {
        if (picked.length >= 4) break
        if (picked.includes(s.id)) continue
        const day = new Date(s.start_time).toDateString()
        if (!usedDays.has(day)) {
          picked.push(s.id)
          usedDays.add(day)
        }
      }
    }

    // Pass 3: just fill
    for (const s of sorted) {
      if (picked.length >= 4) break
      if (!picked.includes(s.id)) {
        picked.push(s.id)
      }
    }

    return picked
  }, [])

  // Re-pick visible IDs only when the set of slot IDs changes (not on swap updates)
  const slotIdSet = useMemo(() => slots.map(s => s.id).sort().join(','), [slots])
  useEffect(() => {
    const currentIds = new Set(slots.map(s => s.id))
    const pinnedStillValid = pinnedSlotIdsRef.current.every(id => currentIds.has(id))

    // Only re-pick if pinned IDs are stale (slot removed/added) or empty
    if (!pinnedStillValid || pinnedSlotIdsRef.current.length === 0) {
      pinnedSlotIdsRef.current = pickVisibleSlotIds(slots)
    }
  }, [slotIdSet, pickVisibleSlotIds, slots])

  // Resolve pinned IDs to actual slot objects (with latest suggestion data from swaps)
  const visibleSlots = useMemo(() => {
    const now = Date.now()
    const pinned = pinnedSlotIdsRef.current
    const result = pinned
      .map(id => slots.find(s => s.id === id))
      .filter((s): s is SlotWithSuggestion => s != null && new Date(s.end_time).getTime() > now)
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())

    // If pinned set has shrunk below 4 (e.g. past slots expired), re-pick
    if (result.length < 4 && slots.length > result.length) {
      pinnedSlotIdsRef.current = pickVisibleSlotIds(slots)
      return pinnedSlotIdsRef.current
        .map(id => slots.find(s => s.id === id))
        .filter((s): s is SlotWithSuggestion => s != null && new Date(s.end_time).getTime() > now)
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    }

    return result
  }, [slots, pickVisibleSlotIds])

  // Get suggestion slots for a specific date
  const getSlotsForDay = (date: Date): SlotWithSuggestion[] => {
    return visibleSlots.filter(slot => {
      const slotStart = new Date(slot.start_time)
      return slotStart.toDateString() === date.toDateString()
    })
  }

  const getSlotsForSlot = (date: Date, hour: number): SlotWithSuggestion[] => {
    return visibleSlots.filter(slot => {
      const slotStart = new Date(slot.start_time)
      return slotStart.toDateString() === date.toDateString() && slotStart.getHours() === hour
    })
  }

  // Slot action handlers
  // Click slot to open event form pre-filled with suggestion data
  const handleSlotClick = (slot: SlotWithSuggestion) => {
    const template: any = {
      title: slot.suggestion_title,
      start_time: slot.start_time,
      end_time: slot.end_time,
      description: slot.suggestion_description || '',
      aspect: slot.aspect_name || '',
      _fromSlotId: slot.id,
    }
    setSelectedEvent(template)
    setIsFormOpen(true)
  }

  // Build ordered suggestion list for carousel, excluding suggestions on other VISIBLE slots
  const getCarouselOrder = (currentSlotId: string): ActionSuggestion[] => {
    const otherVisibleSuggestionIds = new Set(
      visibleSlots.filter(s => s.id !== currentSlotId).map(s => s.suggestion_id)
    )
    return allSuggestions.filter(s => !otherVisibleSuggestionIds.has(s.id))
  }

  const handleSlotSwapDirection = async (slotId: string, direction: 'prev' | 'next') => {
    if (!user) return
    const carousel = getCarouselOrder(slotId)
    if (carousel.length === 0) return

    const currentSlot = slots.find(s => s.id === slotId)
    if (!currentSlot) return

    // Find current index
    const currentIdx = carousel.findIndex(s => s.id === currentSlot.suggestion_id)
    const prevIdx = slotSuggestionIndex[slotId]
    const baseIdx = currentIdx >= 0 ? currentIdx : (prevIdx ?? 0)

    const nextIdx = direction === 'next'
      ? (baseIdx + 1) % carousel.length
      : (baseIdx - 1 + carousel.length) % carousel.length

    const newSuggestion = carousel[nextIdx]
    if (!newSuggestion) return

    // Track index for this slot
    setSlotSuggestionIndex(prev => ({ ...prev, [slotId]: nextIdx }))

    // Resolve aspect details for the new suggestion
    const aspect = newSuggestion.aspect_id ? getAspectById(newSuggestion.aspect_id) : undefined

    // Optimistic local update — only change suggestion data, keep slot times stable
    setSlots(prev => prev.map(s => {
      if (s.id !== slotId) return s
      const updated: SlotWithSuggestion = {
        ...s,
        suggestion_id: newSuggestion.id,
        suggestion_title: newSuggestion.title,
        suggestion_type: newSuggestion.suggestion_type,
      }
      if (newSuggestion.description != null) updated.suggestion_description = newSuggestion.description
      if (newSuggestion.estimated_minutes != null) updated.estimated_minutes = newSuggestion.estimated_minutes
      if (newSuggestion.energy_level != null) updated.energy_level = newSuggestion.energy_level
      if (newSuggestion.aspect_id != null) updated.aspect_id = newSuggestion.aspect_id
      if (aspect?.name != null) updated.aspect_name = aspect.name
      if (aspect?.color != null) updated.aspect_color = aspect.color
      return updated
    }))

    // Persist to backend with targeted suggestion
    swapSlot(user, slotId, session?.access_token, newSuggestion.id)
  }

  const handleSlotConfirm = async (slotId: string) => {
    if (!user) return
    const { event_id } = await confirmSlot(user, slotId, session?.access_token)
    if (event_id) {
      setSlots(prev => prev.filter(s => s.id !== slotId))
      const { events: refreshed } = await fetchEventsWindowed()
      if (refreshed) setEvents(refreshed)
      // Replenish to maintain 4 active slots
      replenishSlots(user, session?.access_token).then(() => {
        const now2 = new Date()
        fetchUserSlots(user, now2.toISOString(), new Date(now2.getTime() + 14 * 86400000).toISOString(), session?.access_token)
          .then(({ slots: fresh }) => { if (fresh) setSlots(fresh) })
      })
    }
  }

  const handleSlotDismiss = async (slotId: string) => {
    if (!user) return
    const { error } = await dismissSlot(user, slotId, undefined, session?.access_token)
    if (!error) {
      setSlots(prev => prev.filter(s => s.id !== slotId))
      // Replenish to maintain 4 active slots
      replenishSlots(user, session?.access_token).then(() => {
        const now2 = new Date()
        fetchUserSlots(user, now2.toISOString(), new Date(now2.getTime() + 14 * 86400000).toISOString(), session?.access_token)
          .then(({ slots: fresh }) => { if (fresh) setSlots(fresh) })
      })
    }
  }

  const handleSlotResizeStart = (e: React.MouseEvent, slot: SlotWithSuggestion) => {
    setResizingSlot(slot)
    const startY = e.clientY
    const originalEnd = new Date(slot.end_time)
    let latestEndTime = slot.end_time

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY
      const deltaMinutes = Math.round(deltaY / 1) // 1px per minute (60px per hour)
      const snappedMinutes = Math.round(deltaMinutes / 15) * 15
      const newEnd = new Date(originalEnd.getTime() + snappedMinutes * 60 * 1000)
      // Minimum 60 minutes
      const minEnd = new Date(new Date(slot.start_time).getTime() + 60 * 60 * 1000)
      const clampedEnd = newEnd < minEnd ? minEnd : newEnd
      latestEndTime = clampedEnd.toISOString()
      // Optimistic local update
      setSlots(prev => prev.map(s =>
        s.id === slot.id ? { ...s, end_time: latestEndTime } : s
      ))
    }

    const onMouseUp = async () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      setResizingSlot(null)
      if (user) {
        await resizeSlotApi(user, slot.id, latestEndTime, session?.access_token)
      }
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  // Overlap layout now handled by computeDayEventLayouts from calendarLayoutUtils

  // Get events for a specific date (for month view)
  // All-day events sorted first, then timed events by start time
  const getEventsForDate = (date: Date) => {
    return allEvents.filter(event => {
      if (event.is_all_day) {
        // All-day events span the date if start <= end-of-day and end > start-of-day
        const eventStart = new Date(event.start_time)
        const eventEnd = new Date(event.end_time)
        const dayStart = new Date(date)
        dayStart.setHours(0, 0, 0, 0)
        const dayEnd = new Date(date)
        dayEnd.setHours(23, 59, 59, 999)
        return eventStart <= dayEnd && eventEnd > dayStart
      }
      const eventStart = new Date(event.start_time)
      return eventStart.toDateString() === date.toDateString()
    }).sort((a, b) => {
      // All-day events first
      if (a.is_all_day && !b.is_all_day) return -1
      if (!a.is_all_day && b.is_all_day) return 1
      return new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    })
  }

  // Calculate event position and height
  const getEventStyle = (event: CalendarEvent) => {
    const start = new Date(event.start_time)
    const end = new Date(event.end_time)

    const startMinutes = start.getMinutes()
    const durationMs = end.getTime() - start.getTime()
    const durationMinutes = durationMs / (1000 * 60)

    // Each hour is 60px, so each minute is 1px
    const top = startMinutes
    const height = Math.max(durationMinutes, 15) // Minimum 15px height

    return { top, height }
  }

  // Navigation handlers
  const handlePrev = () => {
    const newDate = new Date(currentDate)
    if (view === 'day') {
      newDate.setDate(newDate.getDate() - 1)
    } else if (view === 'week') {
      newDate.setDate(newDate.getDate() - 7)
    } else {
      newDate.setMonth(newDate.getMonth() - 1)
    }
    setCurrentDate(newDate)
  }

  const handleNext = () => {
    const newDate = new Date(currentDate)
    if (view === 'day') {
      newDate.setDate(newDate.getDate() + 1)
    } else if (view === 'week') {
      newDate.setDate(newDate.getDate() + 7)
    } else {
      newDate.setMonth(newDate.getMonth() + 1)
    }
    setCurrentDate(newDate)
  }

  // Event save handler
  const handleSaveEvent = useCallback(async (eventData: Partial<CalendarEvent>) => {
    if (!user) return

    try {
      if (eventData.id) {
        // Update existing event
        const { error } = await updateEvent(
          user,
          eventData.id,
          {
            title: eventData.title!,
            start_time: eventData.start_time!,
            end_time: eventData.end_time!,
            ...(eventData.description ? { description: eventData.description } : {}),
            ...(eventData.aspect ? { aspect: eventData.aspect } : {}),
            ...(eventData.visibility ? { visibility: eventData.visibility } : {}),
            ...(eventData.reminder_minutes !== undefined ? { reminder_minutes: eventData.reminder_minutes } : {})
          },
          session?.access_token
        )

        if (error) {
          console.error('Failed to update event:', error)
          throw new Error('Failed to update event: ' + error)
        } else {
          // Update local state
          setEvents(events.map(e => {
            if (e.id === eventData.id) {
              return { ...e, ...eventData } as CalendarEvent
            }
            return e
          }))
          setSelectedEvent(null)
          setIsFormOpen(false)
        }
      } else {
        // Create new event
        const { event: newEvent, error } = await createEvent(
          user,
          {
            title: eventData.title!,
            start_time: eventData.start_time!,
            end_time: eventData.end_time!,
            ...(eventData.description ? { description: eventData.description } : {}),
            ...(eventData.aspect ? { aspect: eventData.aspect } : {}),
            ...(eventData.visibility ? { visibility: eventData.visibility } : {}),
            ...(eventData.reminder_minutes !== undefined ? { reminder_minutes: eventData.reminder_minutes } : {})
          },
          session?.access_token
        )

        if (error) {
          console.error('Failed to create event:', error)
          throw new Error('Failed to create event: ' + error)
        } else if (newEvent) {
          setEvents([...events, newEvent])
          // If created from a suggestion slot, dismiss the slot and replenish
          const slotId = (selectedEvent as any)?._fromSlotId
          if (slotId) {
            await dismissSlot(user, slotId, 'confirmed via edit', session?.access_token)
            setSlots(prev => prev.filter(s => s.id !== slotId))
            replenishSlots(user, session?.access_token).then(() => {
              const now2 = new Date()
              fetchUserSlots(user, now2.toISOString(), new Date(now2.getTime() + 14 * 86400000).toISOString(), session?.access_token)
                .then(({ slots: fresh }) => { if (fresh) setSlots(fresh) })
            })
          }
          setSelectedEvent(null)
          setIsFormOpen(false)
        }
      }
    } catch (error) {
      console.error('Error saving event:', error)
      throw error
    }
  }, [user, session, events, selectedEvent, fetchEventsWindowed, slots])

  // Handle saving recurring events
  const handleSaveRecurring = useCallback(async (eventData: Partial<CalendarEvent>, scope: 'this_instance' | 'entire_series', recurrenceRule?: string) => {
    if (!user || !session) return
    if (eventData.id) {
      const updates: Record<string, any> = {}
      if (eventData.title) updates.title = eventData.title
      if (eventData.start_time) updates.start_time = eventData.start_time
      if (eventData.end_time) updates.end_time = eventData.end_time
      if (eventData.description) updates.description = eventData.description
      if (eventData.aspect) updates.aspect = eventData.aspect
      if (eventData.visibility) updates.visibility = eventData.visibility
      if (eventData.reminder_minutes !== undefined) updates.reminder_minutes = eventData.reminder_minutes

      if (recurrenceRule) updates.recurrence_rule = recurrenceRule
      if (scope === 'this_instance' && selectedEvent?.instance_date) {
        updates.instance_date = selectedEvent.instance_date
      }
      await updateRecurringEvent(user, eventData.id, scope, updates, session.access_token)
    }
    const { events: refreshed } = await fetchEventsWindowed()
    setEvents(refreshed || [])
    setSelectedEvent(null)
    setIsFormOpen(false)
  }, [user, session, selectedEvent, fetchEventsWindowed])

  // Handle deleting events
  const handleDeleteEvent = useCallback(async (scope?: 'this_instance' | 'entire_series') => {
    if (!selectedEvent || !user) return
    if (scope) {
      await deleteRecurringEvent(user, selectedEvent.id, scope, session?.access_token)
      const { events: refreshed } = await fetchEventsWindowed()
      setEvents(refreshed || [])
    } else {
      await deleteEvent(user, selectedEvent.id, session?.access_token)
      setEvents(prev => prev.filter(e => e.id !== selectedEvent.id))
    }
    setSelectedEvent(null)
    setIsFormOpen(false)
  }, [user, session, selectedEvent, fetchEventsWindowed])

  // Handle clicking on calendar to create new event
  const handleCalendarClick = (date: Date, hour: number, halfHour: number) => {
    const startTime = new Date(date)
    startTime.setHours(hour, halfHour * 30, 0, 0)

    const endTime = new Date(startTime)
    endTime.setHours(startTime.getHours() + 1) // Default 1 hour duration

    // Create a template event (no id means it's new)
    const newEventTemplate: any = {
      title: '',
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      description: '',
      aspect: ''
    }

    setSelectedEvent(newEventTemplate)
    setIsFormOpen(true)
  }

  // State for dragging tasks from TodoList
  const [draggingTask, setDraggingTask] = useState<boolean>(false)

  // Handle drag over for HTML5 native drag (tasks from sidebar only)
  const handleDragOver = (e: React.DragEvent, date: Date, hour: number) => {
    e.preventDefault()

    const hasTask = e.dataTransfer.types.includes('application/glyde-task')
    if (!hasTask) return

    e.dataTransfer.dropEffect = 'copy'
    setDraggingTask(true)

    const rect = e.currentTarget.getBoundingClientRect()
    const offsetY = e.clientY - rect.top
    const quarterHeight = rect.height / 4
    const quarter = Math.max(0, Math.min(3, Math.round(offsetY / quarterHeight - 0.5)))

    setDragPreview({ date, hour, quarter })
  }

  // Handle drop for HTML5 native drag (tasks from sidebar only)
  const handleDrop = async (e: React.DragEvent, date: Date, hour: number) => {
    e.preventDefault()
    if (!user) return

    const taskData = e.dataTransfer.getData('application/glyde-task')
    if (!taskData) {
      setDragPreview(null)
      return
    }

    const rect = e.currentTarget.getBoundingClientRect()
    const offsetY = e.clientY - rect.top
    const quarterHeight = rect.height / 4
    const snappedQuarter = Math.max(0, Math.min(3, Math.round(offsetY / quarterHeight - 0.5)))

    const newStartTime = new Date(date)
    newStartTime.setHours(hour, snappedQuarter * 15, 0, 0)

    try {
      const task = JSON.parse(taskData)
      const durationMinutes = task.estimated_duration || 60
      const newEndTime = new Date(newStartTime.getTime() + durationMinutes * 60 * 1000)

      const { event: newEvent, error } = await createEvent(
        user,
        {
          title: task.title,
          start_time: newStartTime.toISOString(),
          end_time: newEndTime.toISOString(),
          description: task.description || `Scheduled time for task: ${task.title}`,
          aspect: task.aspect_name || task.aspect || ''
        },
        session?.access_token
      )

      if (error) {
        alert('Failed to schedule task: ' + error)
      } else if (newEvent) {
        setEvents([...events, newEvent])
      }
    } catch {
      alert('Error scheduling task')
    } finally {
      setDraggingTask(false)
      setDragPreview(null)
    }
  }

  return (
    <div style={{
      height: '100%',
      width: '100%',
      flex: 1,
      background: colors.bgSecondary,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative'
    }}>
      {/* Calendar Header - Mobile-style design */}
      <div style={{
        padding: '12px 16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: `1px solid ${colors.border}`,
        background: colors.bgSecondary,
      }}>
        <h2 style={{
          ...typography.headingLg,
          fontWeight: fontWeight.bold,
          color: colors.textPrimary,
          margin: 0
        }}>
          {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h2>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Friends Events Toggle */}
          <button
            onClick={() => setShowFriendsEvents(!showFriendsEvents)}
            title={showFriendsEvents ? "Hide friends' events" : "Show friends' events"}
            style={{
              padding: '6px 10px',
              ...typography.labelMd,
              fontWeight: showFriendsEvents ? fontWeight.semibold : fontWeight.medium,
              background: showFriendsEvents ? hexToRgba('#10b981', 0.15) : colors.bgTertiary,
              color: showFriendsEvents ? '#10b981' : colors.textSecondary,
              border: `1px solid ${showFriendsEvents ? hexToRgba('#10b981', 0.3) : colors.border}`,
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            Friends
            {(friendsEvents.length > 0 || events.some(e => e.user_role === 'viewer')) && (
              <span style={{
                background: showFriendsEvents ? '#10b981' : colors.textTertiary,
                color: '#fff',
                fontSize: fontSize.xs,
                fontWeight: fontWeight.semibold,
                padding: '1px 5px',
                borderRadius: '10px',
                minWidth: '18px',
                textAlign: 'center'
              }}>
                {new Set([
                  ...friendsEvents.map(e => (e as any).parent_event_id || e.id),
                  ...events.filter(e => e.user_role === 'viewer').map(e => (e as any).parent_event_id || e.id)
                ]).size}
              </span>
            )}
          </button>

          {/* View Toggle - Mobile pill style */}
          <div style={{
            display: 'flex',
            gap: '4px',
            background: colors.bgTertiary,
            padding: '4px',
            borderRadius: '10px'
          }}>
            {(['day', 'week', 'month'] as ViewType[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                style={{
                  padding: '6px 14px',
                  ...typography.labelLg,
                  fontWeight: view === v ? fontWeight.semibold : fontWeight.medium,
                  background: view === v ? colors.bgSecondary : 'transparent',
                  color: view === v ? colors.textPrimary : colors.textSecondary,
                  border: 'none',
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                  borderRadius: '8px',
                  transition: 'all 0.15s',
                  boxShadow: view === v ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                {v}
              </button>
            ))}
          </div>

          {/* Navigation - Mobile style buttons */}
          <div style={{ display: 'flex', gap: '4px', marginLeft: '8px' }}>
            <button
              onClick={handlePrev}
              style={{
                padding: '8px',
                background: colors.bgTertiary,
                color: colors.textSecondary,
                border: `1px solid ${colors.border}`,
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s'
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
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              style={{
                padding: '8px 14px',
                ...typography.labelLg,
                fontWeight: 500,
                background: colors.bgTertiary,
                color: colors.textSecondary,
                border: `1px solid ${colors.border}`,
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.15s'
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
              Today
            </button>
            <button
              onClick={handleNext}
              style={{
                padding: '8px',
                background: colors.bgTertiary,
                color: colors.textSecondary,
                border: `1px solid ${colors.border}`,
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s'
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
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {/* Fixed Time Column - outside scroll container so it never scrolls away */}
        {view !== 'month' && (
          <div
            className="calendar-time-gutter"
            style={{
              width: '52px',
              minWidth: '52px',
              flexShrink: 0,
              background: colors.bgSecondary,
              zIndex: 20,
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {/* Inner wrapper scrolls vertically in sync with main grid */}
            <div
              ref={timeGutterRef}
              style={{ height: '100%', overflow: 'hidden', position: 'relative' }}
            >
              {/* Timezone header - sticky top */}
              <div style={{
                position: 'sticky',
                top: 0,
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: fontSize.xs,
                fontFamily: fontFamily.sans,
                fontWeight: fontWeight.normal,
                color: colors.textTertiary,
                background: colors.bgSecondary,
                zIndex: 30,
              }}>
                {new Date().toLocaleTimeString('en-US', { timeZoneName: 'short' }).split(' ').pop()}
              </div>
              {/* All-day banner spacer */}
              {allDayBannerInfo.height > 0 && (
                <div style={{
                  height: `${allDayBannerInfo.height}px`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: fontSize.xs,
                  fontFamily: fontFamily.sans,
                  color: colors.textTertiary,
                  borderBottom: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
                  boxSizing: 'border-box',
                }}>
                  all-day
                </div>
              )}
              {/* Spacer for gap between header and first hour */}
              <div style={{ height: '12px' }} />
              {hours.map(hour => (
                <div key={hour} style={{ height: '60px', position: 'relative' }}>
                  <span style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    transform: 'translateY(-50%)',
                    fontSize: fontSize.xs,
                    fontFamily: fontFamily.sans,
                    color: colors.textTertiary,
                    background: colors.bgSecondary,
                    textAlign: 'center',
                    whiteSpace: 'nowrap'
                  }}>
                    {formatTime(hour)}
                  </span>
                </div>
              ))}
              {/* Current time label */}
              {(() => {
                const now = currentTime
                const topPos = (now.getHours() * 60) + now.getMinutes() + 36
                  + allDayBannerInfo.height + 12
                const todayInView = displayDates.some(d => d.toDateString() === new Date().toDateString())
                if (!todayInView) return null
                return (
                  <div style={{
                    position: 'absolute',
                    top: `${topPos}px`,
                    left: 0,
                    right: 0,
                    transform: 'translateY(-50%)',
                    fontSize: fontSize.xs,
                    fontFamily: fontFamily.sans,
                    fontWeight: fontWeight.semibold,
                    color: colors.error,
                    background: colors.bgSecondary,
                    textAlign: 'center',
                    zIndex: 26,
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                  }}>
                    {now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </div>
                )
              })()}
            </div>
          </div>
        )}

        {/* Main scrollable area */}
        <div
          ref={scrollContainerRef}
          className={view === 'week' ? 'calendar-week-scroll' : undefined}
          style={{
            flex: 1,
            overflow: 'auto',
            position: 'relative',
          }}
        >
        {view === 'month' ? (
          // Month View - Mobile-style grid
          <div style={{ padding: '0', height: '100%', overflow: 'hidden' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gridTemplateRows: 'auto repeat(6, 1fr)',
              height: '100%'
            }}>
              {/* Week day headers - Match day/week view style */}
              {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((day, index) => (
                <div key={index} style={{
                  padding: '8px 4px',
                  textAlign: 'center',
                  fontSize: fontSize.sm,
                  fontFamily: fontFamily.sans,
                  fontWeight: fontWeight.medium,
                  color: colors.textTertiary,
                  background: colors.bgSecondary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.02em',
                }}>
                  {day}
                </div>
              ))}
              {/* Month dates - Mobile-style cells */}
              {displayDates.map((date, idx) => {
                const isToday = date.toDateString() === new Date().toDateString()
                const isCurrentMonth = date.getMonth() === currentDate.getMonth()
                const dayEvents = getEventsForDate(date)
                const col = idx % 7

                return (
                  <div
                    key={idx}
                    onClick={() => handleDayClick(date)}
                    style={{
                      padding: '8px',
                      background: colors.bgSecondary,
                      color: isCurrentMonth ? colors.textPrimary : colors.textTertiary,
                      cursor: 'pointer',
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      minWidth: 0,
                      minHeight: '80px',
                      overflow: 'hidden',
                      borderBottom: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
                      borderRight: col < 6 ? `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}` : 'none',
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = colors.bgHover
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = colors.bgSecondary
                    }}
                  >
                    {/* Date number - Mobile style circle for today */}
                    <div style={{
                      ...typography.bodySm,
                      fontWeight: isToday ? 600 : 400,
                      color: isToday ? colors.bgPrimary : 'inherit',
                      background: isToday ? colors.accent : 'transparent',
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '6px',
                      flexShrink: 0
                    }}>
                      {date.getDate()}
                    </div>

                    {/* Events - Mobile style with 2 visible + "+X more" */}
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '3px',
                      overflow: 'hidden',
                      flex: 1,
                      minHeight: 0
                    }}>
                      {dayEvents.slice(0, 2).map((event) => {
                        const eventColor = getEventColor(event)
                        const isFriendEvent = event.is_friend_event
                        const isShared = isSharedEvent(event)
                        const isAllDay = event.is_all_day
                        return (
                          <div
                            key={event.id}
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedEvent(event)
                              setIsFormOpen(true)
                            }}
                            style={{
                              background: isAllDay
                                ? hexToRgba(eventColor, (isFriendEvent || event.user_role === 'viewer') ? 0.12 : 0.2)
                                : hexToRgba(eventColor, (isFriendEvent || event.user_role === 'viewer') ? 0.08 : 0.12),
                              borderLeft: isAllDay ? 'none' : `2px solid ${eventColor}`,
                              color: isAllDay ? eventColor : colors.textPrimary,
                              fontSize: fontSize.xs,
                              fontFamily: fontFamily.sans,
                              fontWeight: isAllDay ? fontWeight.semibold : fontWeight.medium,
                              padding: '3px 6px',
                              borderRadius: '4px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              cursor: 'pointer',
                              transition: 'background 0.15s ease',
                              flexShrink: 0,
                              opacity: (isFriendEvent || event.user_role === 'viewer') ? 0.7 : 1,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = hexToRgba(eventColor, isFriendEvent ? 0.12 : (isAllDay ? 0.3 : 0.2))
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = hexToRgba(eventColor, isFriendEvent ? (isAllDay ? 0.12 : 0.08) : (isAllDay ? 0.2 : 0.12))
                            }}
                            title={`${event.title}${isFriendEvent ? ` (${event.owner_display_name || 'Friend'})` : ''}${getRecurrenceBadge(event) ? ' (recurring)' : ''}${isAllDay ? ' (all day)' : ` - ${new Date(event.start_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}`}
                          >
                            {(isFriendEvent || (isShared && event.owner_avatar_url)) && (
                              <span style={{
                                width: '12px',
                                height: '12px',
                                borderRadius: '50%',
                                background: hexToRgba(eventColor, 0.3),
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '7px',
                                flexShrink: 0,
                                overflow: 'hidden'
                              }}>
                                {event.owner_avatar_url ? (
                                  <img src={event.owner_avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                  event.owner_display_name?.charAt(0)?.toUpperCase() || 'F'
                                )}
                              </span>
                            )}
                            {/* Shared event role badge in month view */}
                            {isShared && (
                              <span style={{
                                fontSize: '6px',
                                fontFamily: fontFamily.sans,
                                fontWeight: fontWeight.semibold,
                                textTransform: 'uppercase',
                                letterSpacing: '0.3px',
                                padding: '0px 3px',
                                borderRadius: '2px',
                                background: hexToRgba(eventColor, 0.2),
                                color: eventColor,
                                flexShrink: 0
                              }}>
                                {event.user_role === 'viewer' ? 'V' : 'M'}
                              </span>
                            )}
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{event.title}</span>
                            {(event.aspect_name || event.aspect) && (
                              <span style={{
                                fontSize: '7px',
                                fontFamily: fontFamily.sans,
                                fontWeight: fontWeight.medium,
                                color: eventColor,
                                opacity: 0.5,
                                flexShrink: 0,
                                whiteSpace: 'nowrap'
                              }}>
                                {event.aspect_name || event.aspect}
                              </span>
                            )}
                            {getRecurrenceBadge(event) && (
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.6 }}>
                                <path d="M21.5 2v6h-6" /><path d="M2.5 22v-6h6" /><path d="M2.5 11.5a10 10 0 0 1 18.4-4.5" /><path d="M21.5 12.5a10 10 0 0 1-18.4 4.5" />
                              </svg>
                            )}
                            {/* Missed indicator in month view (display only) */}
                            {!isFriendEvent && isEventPast(event) && event.is_missed && (
                              <span style={{
                                fontSize: '7px',
                                fontFamily: fontFamily.sans,
                                fontWeight: fontWeight.semibold,
                                textTransform: 'uppercase',
                                color: '#ef4444',
                                flexShrink: 0,
                                letterSpacing: '0.3px'
                              }}>
                                Missed
                              </span>
                            )}
                          </div>
                        )
                      })}
                      {dayEvents.length > 2 && (
                        <div style={{
                          fontSize: fontSize.xs,
                          fontFamily: fontFamily.sans,
                          fontWeight: fontWeight.medium,
                          color: colors.textSecondary,
                          padding: '2px 6px'
                        }}>
                          +{dayEvents.length - 2} more
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          // Day/Week View
          <div style={{ display: 'flex', minHeight: '100%', position: 'relative' }}>
            {/* Days Columns - grouped by week for horizontal scroll */}
            {(view === 'week'
              ? Array.from({ length: displayDates.length / 7 }, (_, weekIdx) => ({
                  key: weekIdx,
                  dates: displayDates.slice(weekIdx * 7, weekIdx * 7 + 7),
                  offset: weekIdx * 7,
                }))
              : [{ key: 0, dates: displayDates, offset: 0 }]
            ).map(weekGroup => (
              <div
                key={weekGroup.key}
                style={{
                  display: 'flex',
                  ...(view === 'week' ? {
                    flex: '0 0 100%',
                  } : {
                    flex: 1,
                  }),
                }}
              >
            {weekGroup.dates.map((date, i) => {
              const dayIndex = weekGroup.offset + i
              const isToday = date.toDateString() === new Date().toDateString()
              const dayEvents = getEventsForDay(date)
              const daySlots = getSlotsForDay(date)
              // Combine events and slots for overlap-aware layout
              const allDayItems = [
                ...dayEvents,
                ...daySlots.map(s => ({ id: s.id, start_time: s.start_time, end_time: s.end_time }))
              ]
              const dayLayouts = computeDayEventLayouts(allDayItems, { minWidthPercent: 50 })
              const todayBg = isToday
                ? (isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.025)')
                : 'transparent'

              return (
                <div
                  key={dayIndex}
                  style={{
                    flex: 1,
                    minWidth: view === 'day' ? '300px' : '100px',
                    position: 'relative',
                    backgroundColor: todayBg,
                    backgroundImage: dayIndex > 0
                      ? `linear-gradient(${isDarkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'} 50%, transparent 50%)`
                      : 'none',
                    backgroundSize: dayIndex > 0 ? '1px 6px' : 'auto',
                    backgroundRepeat: dayIndex > 0 ? 'repeat-y' : 'no-repeat',
                    backgroundPosition: dayIndex > 0 ? 'left top' : 'initial',
                  }}
                >
                  {/* Day Header - Mobile style */}
                  <div style={{
                    position: 'sticky',
                    top: 0,
                    height: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    fontSize: fontSize.sm,
                    fontFamily: fontFamily.sans,
                    fontWeight: fontWeight.medium,
                    color: isToday ? colors.accent : colors.textTertiary,
                    background: isToday
                      ? hexToRgba(colors.bgSecondary, 0.97)
                      : colors.bgSecondary,
                    zIndex: 10,
                    textTransform: 'uppercase',
                    letterSpacing: '0.02em',
                  }}>
                    <span>
                      {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][date.getDay()]}
                    </span>
                    <span style={{ fontWeight: isToday ? fontWeight.semibold : fontWeight.medium }}>
                      {date.getDate()}
                    </span>
                  </div>

                  {/* All-Day Events Banner */}
                  {allDayBannerInfo.height > 0 && (() => {
                    const allDayEvents = getAllDayEventsForDate(date)
                    const dateKey = date.toDateString()
                    const anyExpanded = displayDates.some(d => expandedAllDayDates.has(d.toDateString()))
                    const visibleEvents = anyExpanded ? allDayEvents : allDayEvents.slice(0, allDayMaxVisible)
                    const hiddenCount = allDayEvents.length - allDayMaxVisible

                    return (
                      <div style={{
                        height: `${allDayBannerInfo.height}px`,
                        padding: '4px 6px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '3px',
                        borderBottom: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
                        background: isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
                        overflow: 'hidden',
                        boxSizing: 'border-box',
                      }}>
                        {visibleEvents.map(event => {
                          const eventColor = getEventColor(event)
                          const isFriendEvent = event.is_friend_event
                          return (
                            <div
                              key={`allday-${event.id}`}
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedEvent(event)
                                setIsFormOpen(true)
                              }}
                              style={{
                                height: '24px',
                                background: hexToRgba(eventColor, isFriendEvent ? 0.1 : 0.15),
                                color: eventColor,
                                fontSize: fontSize.xs,
                                fontFamily: fontFamily.sans,
                                fontWeight: fontWeight.medium,
                                padding: '3px 8px',
                                borderRadius: '4px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                cursor: 'pointer',
                                transition: 'background 0.15s ease',
                                opacity: isFriendEvent ? 0.7 : 1,
                                flexShrink: 0,
                                boxSizing: 'border-box',
                                lineHeight: '18px',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = hexToRgba(eventColor, isFriendEvent ? 0.15 : 0.25)
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = hexToRgba(eventColor, isFriendEvent ? 0.1 : 0.15)
                              }}
                              title={event.title}
                            >
                              {event.title}
                            </div>
                          )
                        })}
                        {!anyExpanded && hiddenCount > 0 && (
                          <div
                            onClick={(e) => {
                              e.stopPropagation()
                              setExpandedAllDayDates(prev => {
                                const next = new Set(prev)
                                next.add(dateKey)
                                return next
                              })
                            }}
                            style={{
                              height: '20px',
                              fontSize: fontSize.xs,
                              fontFamily: fontFamily.sans,
                              fontWeight: fontWeight.medium,
                              color: colors.textTertiary,
                              cursor: 'pointer',
                              padding: '2px 8px',
                              flexShrink: 0,
                              boxSizing: 'border-box',
                              lineHeight: '16px',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = colors.textPrimary
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = colors.textTertiary
                            }}
                          >
                            +{hiddenCount} more
                          </div>
                        )}
                        {anyExpanded && hiddenCount > 0 && (
                          <div
                            onClick={(e) => {
                              e.stopPropagation()
                              setExpandedAllDayDates(prev => {
                                const next = new Set(prev)
                                next.delete(dateKey)
                                return next
                              })
                            }}
                            style={{
                              height: '20px',
                              fontSize: fontSize.xs,
                              fontFamily: fontFamily.sans,
                              fontWeight: fontWeight.medium,
                              color: colors.textTertiary,
                              cursor: 'pointer',
                              padding: '2px 8px',
                              flexShrink: 0,
                              boxSizing: 'border-box',
                              lineHeight: '16px',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = colors.textPrimary
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = colors.textTertiary
                            }}
                          >
                            show less
                          </div>
                        )}
                      </div>
                    )
                  })()}

                  {/* Spacer for gap between header and first hour */}
                  <div style={{ height: '12px' }} />

                  {/* Current Time Red Line */}
                  {isToday && (() => {
                    const now = currentTime
                    const lineTop = (now.getHours() * 60) + now.getMinutes()
                    return (
                      <div
                        data-testid="current-time-line"
                        style={{
                          position: 'absolute',
                          top: `${36 + allDayBannerInfo.height + 12 + lineTop}px`,
                          left: `-${dayIndex * 100}%`,
                          width: `${displayDates.length * 100}%`,
                          height: '2px',
                          background: colors.error,
                          zIndex: 50,
                          pointerEvents: 'none',
                        }}
                      />
                    )
                  })()}

                  {/* Time Slots - Mobile-style hour grid */}
                  {hours.map(hour => {
                    const slotEvents = getEventsForSlot(date, hour)
                    const isPreviewSlot = dragPreview &&
                      dragPreview.date.toDateString() === date.toDateString() &&
                      dragPreview.hour === hour
                    // Pointer drag preview handled by dragPreviewLineRef (direct DOM, no React)

                    return (
                      <div
                        key={hour}
                        data-drop-target=""
                        data-drop-date={date.toISOString()}
                        data-drop-hour={hour}
                        style={{ position: 'relative' }}
                        onDragOver={(e) => handleDragOver(e, date, hour)}
                        onDrop={(e) => handleDrop(e, date, hour)}
                      >
                        {/* Four 15-minute blocks per hour for drag/drop precision */}
                        {[0, 1, 2, 3].map(quarter => {
                          // Mobile-style: subtle borders at hour marks only
                          const borderStyle = quarter === 3
                            ? `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`
                            : 'none'

                          return (
                            <div
                              key={quarter}
                              style={{
                                height: '15px',
                                borderBottom: borderStyle,
                                background: 'transparent',
                                cursor: 'pointer',
                                transition: 'background 0.1s',
                                position: 'relative'
                              }}
                              onClick={(e) => {
                                if (!draggingEvent) {
                                  e.stopPropagation()
                                  const halfHour = Math.floor(quarter / 2)
                                  handleCalendarClick(date, hour, halfHour)
                                }
                              }}
                              onMouseEnter={(e) => {
                                if (!draggingEvent) {
                                  e.currentTarget.style.background = colors.bgHover
                                }
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent'
                              }}
                            />
                          )
                        })}

                        {/* Drag preview indicator (native drag - tasks from sidebar) */}
                        {isPreviewSlot && draggingTask && (
                          <div
                            style={{
                              position: 'absolute',
                              top: `${(dragPreview!.quarter / 4) * 100}%`,
                              left: '0',
                              right: '0',
                              height: '4px',
                              background: '#10b981',
                              zIndex: 100,
                              pointerEvents: 'none',
                              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
                            }}
                          />
                        )}
                        {/* Pointer drag preview is handled by dragPreviewLineRef (direct DOM, no React) */}

                        {/* Render events - Memoized event cards */}
                        {slotEvents.map(event => {
                          const { top, height } = getEventStyle(event)
                          const layout = dayLayouts.get(event.id) || { width: '100%', left: '4px', right: '4px', zIndex: 3 }
                          return (
                            <EventCard
                              key={event.id}
                              event={event}
                              eventColor={getEventColor(event)}
                              layout={layout}
                              top={top}
                              height={height}
                              isFriendEvent={!!event.is_friend_event}
                              isShared={isSharedEvent(event)}
                              isViewerEvent={event.user_role === 'viewer'}
                              isPast={isEventPast(event)}
                              isDragSource={isPointerDragging && dragSourceId === event.id}
                              typography={typography}
                              fontFamily={fontFamily}
                              fontSize={fontSize}
                              fontWeight={fontWeight}
                              onSelect={handleSelectEvent}
                              onPointerDown={startDrag}
                              isPointerDragging={isPointerDragging}
                              wasDragRef={wasDragRef}
                            />
                          )
                        })}

                        {/* Render suggestion slots */}
                        {getSlotsForSlot(date, hour).map(slot => {
                          const slotStart = new Date(slot.start_time)
                          const slotEnd = new Date(slot.end_time)
                          const topPos = slotStart.getMinutes()
                          const heightPos = Math.max((slotEnd.getTime() - slotStart.getTime()) / (1000 * 60), 15)
                          const layout = dayLayouts.get(slot.id) || { width: '100%', left: '4px', right: '4px', zIndex: 3 }

                          return (
                            <SlotBlock
                              key={`slot-${slot.id}`}
                              slot={slot}
                              top={topPos}
                              height={heightPos}
                              layout={layout}
                              defaultColor={colors.textSecondary}
                              onSwapPrev={(id) => handleSlotSwapDirection(id, 'prev')}
                              onSwapNext={(id) => handleSlotSwapDirection(id, 'next')}
                              onConfirm={handleSlotConfirm}
                              onDismiss={handleSlotDismiss}
                              onClick={handleSlotClick}
                              onPointerDown={startSlotDrag}
                              isDragSource={isPointerDragging && dragSourceId === slot.id}
                              isPointerDragging={isPointerDragging}
                              wasDragRef={wasDragRef}
                              onResizeStart={handleSlotResizeStart}
                            />
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              )
            })}
            </div>
            ))}

          </div>
        )}

      </div>
      </div>

      {/* Unified Event Form - extracted to prevent full Calendar re-renders */}
      <EventFormWrapper
        selectedEvent={selectedEvent}
        isFormOpen={isFormOpen}
        isViewerOnly={
          (selectedEvent?.aspect_id ? getAspectById(selectedEvent.aspect_id)?.member_role === 'viewer' : false)
          || selectedEvent?.user_role === 'viewer'
        }
        onClose={handleCloseForm}
        onSave={handleSaveEvent}
        onSaveRecurring={handleSaveRecurring}
        onToggleMissed={handleToggleMissed}
        onDelete={handleDeleteEvent}
      />

      {/* Drag ghost — positioned via direct DOM manipulation by usePointerDrag (no re-renders) */}
      <div
        ref={dragGhostRef}
        style={{
          display: 'none',
          position: 'fixed',
          left: 0,
          top: 0,
          zIndex: 10000,
          pointerEvents: 'none',
          willChange: 'transform',
        }}
      >
        {isPointerDragging && dragSourceId && (() => {
          if (dragSourceType === 'slot') {
            const slot = slots.find(s => s.id === dragSourceId)
            if (!slot) return null
            const slotColor = slot.aspect_color || colors.textSecondary
            return (
              <div style={{
                width: '100%',
                height: '100%',
                background: hexToRgba(slotColor, 0.12),
                border: `2px dashed ${hexToRgba(slotColor, 0.5)}`,
                borderRadius: '4px',
                padding: '3px 8px',
                overflow: 'hidden',
                backdropFilter: 'blur(4px)',
              }}>
                <div style={{
                  ...typography.labelMd,
                  fontWeight: fontWeight.semibold,
                  color: slotColor,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {slot.suggestion_title}
                </div>
              </div>
            )
          }
          const event = events.find(e => e.id === dragSourceId)
          if (!event) return null
          const eventColor = getEventColor(event)
          return (
            <div style={{
              width: '100%',
              height: '100%',
              background: hexToRgba(eventColor, 0.18),
              borderLeft: `3px solid ${eventColor}`,
              borderRadius: '4px',
              padding: '3px 8px',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              backdropFilter: 'blur(4px)',
            }}>
              <div style={{
                ...typography.labelMd,
                fontWeight: fontWeight.semibold,
                color: eventColor,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {event.title}
              </div>
            </div>
          )
        })()}
      </div>

      {/* Drop preview line — positioned via direct DOM manipulation by usePointerDrag */}
      <div
        ref={dragPreviewLineRef}
        style={{
          display: 'none',
          position: 'absolute',
          height: '3px',
          background: colors.accent,
          zIndex: 100,
          pointerEvents: 'none',
          borderRadius: '2px',
          boxShadow: `0 0 8px ${hexToRgba(colors.accent, 0.4)}`,
        }}
      />
    </div>
  )
}

