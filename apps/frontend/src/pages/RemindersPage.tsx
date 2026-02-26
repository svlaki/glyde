import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../lib/authContext'
import { useTheme } from '../lib/themeContext'
import { useAspects } from '../lib/aspectContext'
import { usePlatform } from '../hooks/usePlatform'
import { fetchReminders, deleteReminder, snoozeReminder, dismissEventReminders } from '../lib/remindersService'
import type { Reminder } from '../lib/remindersService'
import { VerticalSidebar, SIDEBAR_WIDTH } from '../components/VerticalSidebar'
import { MobileHeader } from '../components/mobile/MobileHeader'
import { ScopeDialog } from '../components/event/ScopeDialog'
import { getColors, hexToRgba } from '../styles/colors'
import { getTypography } from '../styles/typography'
import { mobileStyles, mobileSpacing } from '../styles/mobileStyles'

export function RemindersPage() {
  const { isMobile } = usePlatform()

  if (isMobile) {
    return <RemindersPageMobile />
  }

  return <RemindersPageDesktop />
}

function isRecurringEventReminder(reminder: Reminder): boolean {
  return !!reminder.metadata?.event_reminder_id && !!reminder.metadata?.instance_date
}

function isEventReminder(reminder: Reminder): boolean {
  return !!reminder.metadata?.event_reminder_id
}

function getTimeUntil(triggerAt: string): string {
  const now = Date.now()
  const trigger = new Date(triggerAt).getTime()
  const diff = trigger - now

  if (diff <= 0) return 'now'

  const minutes = Math.floor(diff / 60000)
  if (minutes === 0) return 'in <1m'
  if (minutes < 60) return `in ${minutes}m`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `in ${hours}h ${minutes % 60}m`

  const days = Math.floor(hours / 24)
  return `in ${days}d ${hours % 24}h`
}

function formatTriggerTime(triggerAt: string): string {
  const date = new Date(triggerAt)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  const isTomorrow = date.toDateString() === tomorrow.toDateString()

  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

  if (isToday) return `Today at ${time}`
  if (isTomorrow) return `Tomorrow at ${time}`

  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }) + ` at ${time}`
}

// Shared hook for reminders state and actions
function useReminders() {
  const { user, session } = useAuth()
  const { getAspectColor } = useAspects()
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(true)
  const [scopeTarget, setScopeTarget] = useState<Reminder | null>(null)

  const loadReminders = useCallback(async () => {
    if (!user || !session) return
    setLoading(true)
    try {
      const { reminders: data } = await fetchReminders(user, session.access_token)
      setReminders(data)
    } finally {
      setLoading(false)
    }
  }, [user, session])

  useEffect(() => {
    loadReminders()
  }, [loadReminders])

  const handleDismiss = useCallback(async (reminder: Reminder) => {
    if (isRecurringEventReminder(reminder)) {
      setScopeTarget(reminder)
      return
    }
    if (!user || !session) return
    await deleteReminder(user, session.access_token, reminder.id)
    await loadReminders()
  }, [user, session, loadReminders])

  const handleScopeConfirm = useCallback(async (scope: 'this_instance' | 'entire_series') => {
    if (!user || !session || !scopeTarget) return
    const eventId = scopeTarget.metadata?.event_reminder_id
    if (scope === 'this_instance' || !eventId) {
      await deleteReminder(user, session.access_token, scopeTarget.id)
    } else {
      await dismissEventReminders(user, session.access_token, eventId)
    }
    setScopeTarget(null)
    await loadReminders()
  }, [user, session, scopeTarget, loadReminders])

  const handleSnooze = useCallback(async (reminder: Reminder, minutes: number) => {
    if (!user || !session) return
    await snoozeReminder(user, session.access_token, reminder.id, minutes)
    await loadReminders()
  }, [user, session, loadReminders])

  return {
    reminders,
    loading,
    scopeTarget,
    setScopeTarget,
    handleDismiss,
    handleScopeConfirm,
    handleSnooze,
    getAspectColor,
  }
}

function ReminderCard({
  reminder,
  onDismiss,
  onSnooze,
  colors,
  aspectColor,
  isMobile,
}: {
  reminder: Reminder
  onDismiss: (reminder: Reminder) => void
  onSnooze: (reminder: Reminder, minutes: number) => void
  colors: ReturnType<typeof getColors>
  aspectColor?: string
  isMobile?: boolean
}) {
  const [showSnooze, setShowSnooze] = useState(false)
  const isPast = new Date(reminder.trigger_at) <= new Date()
  const isEvent = isEventReminder(reminder)

  return (
    <div
      style={{
        padding: isMobile ? '16px' : '14px 16px',
        background: colors.bgTertiary,
        borderRadius: '8px',
        borderLeft: `3px solid ${aspectColor || (isEvent ? colors.accent : colors.textTertiary)}`,
        transition: 'all 0.15s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: isMobile ? '15px' : '14px',
            fontWeight: 500,
            color: colors.textPrimary,
            marginBottom: '4px',
          }}>
            {reminder.message}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: '12px',
              color: isPast ? '#ef4444' : colors.textSecondary,
              fontWeight: isPast ? 500 : 400,
            }}>
              {formatTriggerTime(reminder.trigger_at)}
            </span>
            <span style={{
              fontSize: '11px',
              color: isPast ? '#ef4444' : colors.textTertiary,
              background: isPast ? 'rgba(239, 68, 68, 0.1)' : hexToRgba(colors.textTertiary, 0.1),
              padding: '1px 6px',
              borderRadius: '4px',
            }}>
              {isPast ? 'overdue' : getTimeUntil(reminder.trigger_at)}
            </span>
            {isEvent && (
              <span style={{
                fontSize: '11px',
                color: colors.accent,
                background: hexToRgba(colors.accent, 0.1),
                padding: '1px 6px',
                borderRadius: '4px',
              }}>
                event
              </span>
            )}
            {reminder.status === 'snoozed' && (
              <span style={{
                fontSize: '11px',
                color: '#f59e0b',
                background: 'rgba(245, 158, 11, 0.1)',
                padding: '1px 6px',
                borderRadius: '4px',
              }}>
                snoozed
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
          <button
            onClick={() => setShowSnooze(!showSnooze)}
            style={{
              padding: '6px 10px',
              fontSize: '12px',
              background: 'transparent',
              border: `1px solid ${colors.border}`,
              borderRadius: '6px',
              color: colors.textSecondary,
              cursor: 'pointer',
            }}
            title="Snooze"
          >
            Snooze
          </button>
          <button
            onClick={() => onDismiss(reminder)}
            style={{
              padding: '6px 10px',
              fontSize: '12px',
              background: 'transparent',
              border: `1px solid ${colors.border}`,
              borderRadius: '6px',
              color: colors.textSecondary,
              cursor: 'pointer',
            }}
            title="Dismiss"
          >
            Dismiss
          </button>
        </div>
      </div>

      {showSnooze && (
        <div style={{
          display: 'flex',
          gap: '6px',
          marginTop: '10px',
          paddingTop: '10px',
          borderTop: `1px solid ${colors.border}`,
          flexWrap: 'wrap',
        }}>
          {[
            { label: '15 min', minutes: 15 },
            { label: '1 hour', minutes: 60 },
            { label: '3 hours', minutes: 180 },
            { label: 'Tomorrow 9am', minutes: -1 },
          ].map(opt => (
            <button
              key={opt.label}
              onClick={() => {
                if (opt.minutes === -1) {
                  const now = new Date()
                  const tomorrow9 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0, 0, 0)
                  const minutesUntil = Math.round((tomorrow9.getTime() - now.getTime()) / 60000)
                  onSnooze(reminder, minutesUntil)
                } else {
                  onSnooze(reminder, opt.minutes)
                }
                setShowSnooze(false)
              }}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                background: colors.bgSecondary,
                border: `1px solid ${colors.border}`,
                borderRadius: '6px',
                color: colors.textPrimary,
                cursor: 'pointer',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ReminderList({
  reminders,
  onDismiss,
  onSnooze,
  colors,
  getAspectColor,
  loading,
  isMobile,
}: {
  reminders: Reminder[]
  onDismiss: (reminder: Reminder) => void
  onSnooze: (reminder: Reminder, minutes: number) => void
  colors: ReturnType<typeof getColors>
  getAspectColor: (id: string) => string
  loading: boolean
  isMobile?: boolean
}) {
  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: colors.textTertiary, fontSize: '14px' }}>
        Loading...
      </div>
    )
  }

  if (reminders.length === 0) {
    return (
      <div style={{
        padding: '40px 20px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        alignItems: 'center',
      }}>
        <div style={{ fontSize: '14px', color: colors.textTertiary }}>
          No upcoming reminders
        </div>
        <div style={{ fontSize: '13px', color: colors.textTertiary }}>
          Reminders created by your AI assistant or set on events will appear here.
        </div>
      </div>
    )
  }

  // Group by date
  const groups: { label: string; items: Reminder[] }[] = []
  const now = new Date()

  for (const reminder of reminders) {
    const date = new Date(reminder.trigger_at)
    const isOverdue = date <= now
    const isToday = date.toDateString() === now.toDateString()
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    const isTomorrow = date.toDateString() === tomorrow.toDateString()

    let label: string
    if (isOverdue && !isToday) {
      label = 'Overdue'
    } else if (isToday) {
      label = 'Today'
    } else if (isTomorrow) {
      label = 'Tomorrow'
    } else {
      label = date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
    }

    const existingIndex = groups.findIndex(g => g.label === label)
    if (existingIndex >= 0) {
      groups[existingIndex] = {
        ...groups[existingIndex],
        items: [...groups[existingIndex].items, reminder],
      }
    } else {
      groups.push({ label, items: [reminder] })
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {groups.map(group => (
        <div key={group.label}>
          <div style={{
            fontSize: '13px',
            fontWeight: 600,
            color: group.label === 'Overdue' ? '#ef4444' : colors.textSecondary,
            marginBottom: '8px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            {group.label}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {group.items.map(reminder => (
              <ReminderCard
                key={reminder.id}
                reminder={reminder}
                onDismiss={onDismiss}
                onSnooze={onSnooze}
                colors={colors}
                aspectColor={reminder.aspect_id ? getAspectColor(reminder.aspect_id) : undefined}
                isMobile={isMobile}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// Desktop layout
function RemindersPageDesktop() {
  const { theme } = useTheme()
  const colors = getColors(theme)
  const typography = getTypography(false)
  const {
    reminders, loading, scopeTarget, setScopeTarget,
    handleDismiss, handleScopeConfirm, handleSnooze, getAspectColor,
  } = useReminders()

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      overflow: 'hidden',
      background: colors.bgPrimary,
    }}>
      <VerticalSidebar />

      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        minHeight: 0,
        marginLeft: `${SIDEBAR_WIDTH}px`,
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 30px',
          borderBottom: `1px solid ${colors.border}`,
          background: colors.bgSecondary,
        }}>
          <h2 style={{
            ...typography.headingLg,
            fontWeight: 600,
            color: colors.textPrimary,
            margin: 0,
          }}>
            Reminders
          </h2>
          <p style={{
            ...typography.bodySm,
            color: colors.textSecondary,
            margin: '6px 0 0 0',
          }}>
            Upcoming reminders from your events and AI assistant
          </p>
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '24px 30px',
          maxWidth: '700px',
        }}>
          <ReminderList
            reminders={reminders}
            onDismiss={handleDismiss}
            onSnooze={handleSnooze}
            colors={colors}
            getAspectColor={getAspectColor}
            loading={loading}
          />
        </div>
      </div>

      <ScopeDialog
        isOpen={!!scopeTarget}
        onClose={() => setScopeTarget(null)}
        action="delete"
        isInstance={true}
        onConfirm={handleScopeConfirm}
      />
    </div>
  )
}

// Mobile layout
function RemindersPageMobile() {
  const { theme } = useTheme()
  const colors = getColors(theme)
  const {
    reminders, loading, scopeTarget, setScopeTarget,
    handleDismiss, handleScopeConfirm, handleSnooze, getAspectColor,
  } = useReminders()

  return (
    <div style={mobileStyles.fullHeight}>
      <MobileHeader title="Reminders" showMenu showSearch />
      <div style={{
        ...mobileStyles.scrollContainer,
        background: colors.bgPrimary,
        paddingLeft: mobileSpacing.paddingX,
        paddingRight: mobileSpacing.paddingX,
        paddingTop: mobileSpacing.paddingTop,
        paddingBottom: mobileSpacing.paddingBottomNoTabs,
      }}>
        <ReminderList
          reminders={reminders}
          onDismiss={handleDismiss}
          onSnooze={handleSnooze}
          colors={colors}
          getAspectColor={getAspectColor}
          loading={loading}
          isMobile
        />
      </div>

      <ScopeDialog
        isOpen={!!scopeTarget}
        onClose={() => setScopeTarget(null)}
        action="delete"
        isInstance={true}
        onConfirm={handleScopeConfirm}
      />
    </div>
  )
}
