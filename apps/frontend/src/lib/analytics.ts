import { supabase } from './supabase'
import { Capacitor } from '@capacitor/core'

interface AnalyticsEvent {
  user_id: string
  event_name: string
  event_category: string
  event_properties: Record<string, any>
  session_id: string
  page_path: string
  device_type: string
  created_at: string
}

let userId: string | null = null
let sessionId: string | null = null
let eventQueue: AnalyticsEvent[] = []
let flushTimer: ReturnType<typeof setInterval> | null = null
let unloadHandler: (() => void) | null = null
let visibilityHandler: (() => void) | null = null
let flushRetries = 0

const FLUSH_INTERVAL_MS = 10_000
const FLUSH_THRESHOLD = 20
const MAX_FLUSH_RETRIES = 2

function getSessionId(): string {
  if (sessionId) return sessionId
  let stored = sessionStorage.getItem('glyde_session_id')
  if (!stored) {
    stored = crypto.randomUUID()
    sessionStorage.setItem('glyde_session_id', stored)
  }
  sessionId = stored
  return stored
}

function getDeviceType(): string {
  const platform = Capacitor.getPlatform()
  if (platform === 'ios') return 'ios'
  if (platform === 'android') return 'android'
  return 'web'
}

function getPagePath(): string {
  return window.location.pathname
}

async function flushEvents() {
  if (eventQueue.length === 0 || !userId) return

  const batch = eventQueue.splice(0, eventQueue.length)

  try {
    const { error } = await supabase.from('beta_analytics_events').insert(batch)
    if (error) throw error
    flushRetries = 0
  } catch {
    // Re-queue on failure up to MAX_FLUSH_RETRIES to avoid silent data loss
    if (flushRetries < MAX_FLUSH_RETRIES) {
      eventQueue.unshift(...batch)
      flushRetries++
    }
    // Beyond max retries, drop the batch to prevent unbounded growth
  }
}

export function initAnalytics(id: string) {
  userId = id

  // Track session start
  trackEvent('session_start', 'engagement')

  // Set up periodic flush
  if (flushTimer) clearInterval(flushTimer)
  flushTimer = setInterval(flushEvents, FLUSH_INTERVAL_MS)

  // Clean up previous listeners if any
  if (unloadHandler) window.removeEventListener('beforeunload', unloadHandler)
  if (visibilityHandler) document.removeEventListener('visibilitychange', visibilityHandler)

  // Flush on page unload / visibility change
  unloadHandler = () => flushEvents()
  visibilityHandler = () => {
    if (document.visibilityState === 'hidden') flushEvents()
  }
  window.addEventListener('beforeunload', unloadHandler)
  document.addEventListener('visibilitychange', visibilityHandler)
}

export function trackEvent(
  name: string,
  category: string,
  properties: Record<string, any> = {}
) {
  if (!userId) return

  eventQueue.push({
    user_id: userId,
    event_name: name,
    event_category: category,
    event_properties: properties,
    session_id: getSessionId(),
    page_path: getPagePath(),
    device_type: getDeviceType(),
    created_at: new Date().toISOString(),
  })

  if (eventQueue.length >= FLUSH_THRESHOLD) {
    flushEvents()
  }
}

export function trackPageView(path: string) {
  trackEvent('page_view', 'navigation', { path })
}

export function shutdownAnalytics() {
  if (flushTimer) {
    clearInterval(flushTimer)
    flushTimer = null
  }
  flushEvents()
  if (unloadHandler) {
    window.removeEventListener('beforeunload', unloadHandler)
    unloadHandler = null
  }
  if (visibilityHandler) {
    document.removeEventListener('visibilitychange', visibilityHandler)
    visibilityHandler = null
  }
  userId = null
  sessionId = null
}
