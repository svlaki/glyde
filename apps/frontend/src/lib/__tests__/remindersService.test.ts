import {
  fetchReminders,
  deleteReminder,
  snoozeReminder,
  dismissEventReminders,
} from '../remindersService'

const mockUser = { id: 'user-123' } as any
const mockToken = 'test-token'

const testReminder = {
  id: 'reminder-1',
  user_id: 'user-123',
  message: 'Test reminder',
  trigger_at: '2026-02-26T10:00:00Z',
  status: 'pending' as const,
  created_by: 'user' as const,
  metadata: {},
  created_at: '2026-02-25T10:00:00Z',
  updated_at: '2026-02-25T10:00:00Z',
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('fetchReminders', () => {
  it('returns error when user is null', async () => {
    const result = await fetchReminders(null as any, mockToken)
    expect(result).toEqual({ reminders: [], error: 'User not authenticated' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('returns error when accessToken is null', async () => {
    const result = await fetchReminders(mockUser, null as any)
    expect(result).toEqual({ reminders: [], error: 'User not authenticated' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('calls correct URL with POST method and headers', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ reminders: [testReminder] }),
    } as Response)

    await fetchReminders(mockUser, mockToken)

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/reminders'),
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mockToken}`,
        },
      })
    )
  })

  it('sends user_id in the request body', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ reminders: [] }),
    } as Response)

    await fetchReminders(mockUser, mockToken)

    const callArgs = vi.mocked(fetch).mock.calls[0]
    const body = JSON.parse(callArgs[1]!.body as string)
    expect(body.user_id).toBe('user-123')
  })

  it('passes filters in the request body', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ reminders: [] }),
    } as Response)

    await fetchReminders(mockUser, mockToken, {
      status: 'pending',
      includeHistory: true,
    })

    const callArgs = vi.mocked(fetch).mock.calls[0]
    const body = JSON.parse(callArgs[1]!.body as string)
    expect(body.status).toBe('pending')
    expect(body.include_history).toBe(true)
  })

  it('returns reminders on success', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ reminders: [testReminder] }),
    } as Response)

    const result = await fetchReminders(mockUser, mockToken)
    expect(result.reminders).toEqual([testReminder])
    expect(result.error).toBeNull()
  })

  it('returns error on non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Server error' }),
    } as Response)

    const result = await fetchReminders(mockUser, mockToken)
    expect(result.reminders).toEqual([])
    expect(result.error).toBe('Server error')
  })

  it('returns default error message on non-ok response without error field', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: async () => ({}),
    } as Response)

    const result = await fetchReminders(mockUser, mockToken)
    expect(result.reminders).toEqual([])
    expect(result.error).toBe('Failed to fetch reminders')
  })

  it('returns error on network failure', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Network error'))

    const result = await fetchReminders(mockUser, mockToken)
    expect(result.reminders).toEqual([])
    expect(result.error).toBe('Failed to fetch reminders')
  })

  it('returns empty reminders array when response has no reminders field', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response)

    const result = await fetchReminders(mockUser, mockToken)
    expect(result.reminders).toEqual([])
    expect(result.error).toBeNull()
  })
})

describe('deleteReminder', () => {
  it('returns error when user is null', async () => {
    const result = await deleteReminder(null as any, mockToken, 'reminder-1')
    expect(result).toEqual({ success: false, error: 'User not authenticated' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('returns error when accessToken is null', async () => {
    const result = await deleteReminder(mockUser, null as any, 'reminder-1')
    expect(result).toEqual({ success: false, error: 'User not authenticated' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('calls correct URL with POST method', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as Response)

    await deleteReminder(mockUser, mockToken, 'reminder-1')

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/reminders/delete'),
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mockToken}`,
        },
      })
    )
  })

  it('sends user_id and reminder_id in request body', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as Response)

    await deleteReminder(mockUser, mockToken, 'reminder-1')

    const callArgs = vi.mocked(fetch).mock.calls[0]
    const body = JSON.parse(callArgs[1]!.body as string)
    expect(body.user_id).toBe('user-123')
    expect(body.reminder_id).toBe('reminder-1')
  })

  it('returns success on ok response', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as Response)

    const result = await deleteReminder(mockUser, mockToken, 'reminder-1')
    expect(result).toEqual({ success: true, error: null })
  })

  it('returns error on non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Not found' }),
    } as Response)

    const result = await deleteReminder(mockUser, mockToken, 'reminder-1')
    expect(result).toEqual({ success: false, error: 'Not found' })
  })

  it('returns default error message on non-ok response without error field', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: async () => ({}),
    } as Response)

    const result = await deleteReminder(mockUser, mockToken, 'reminder-1')
    expect(result.error).toBe('Failed to delete reminder')
  })

  it('returns error on network failure', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Network error'))

    const result = await deleteReminder(mockUser, mockToken, 'reminder-1')
    expect(result).toEqual({ success: false, error: 'Failed to delete reminder' })
  })
})

describe('snoozeReminder', () => {
  it('returns error when user is null', async () => {
    const result = await snoozeReminder(null as any, mockToken, 'reminder-1', 15)
    expect(result).toEqual({ success: false, error: 'User not authenticated' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('returns error when accessToken is null', async () => {
    const result = await snoozeReminder(mockUser, null as any, 'reminder-1', 15)
    expect(result).toEqual({ success: false, error: 'User not authenticated' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('calls correct URL with POST method', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as Response)

    await snoozeReminder(mockUser, mockToken, 'reminder-1', 15)

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/reminders/snooze'),
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mockToken}`,
        },
      })
    )
  })

  it('sends user_id, reminder_id, and snooze_minutes in request body', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as Response)

    await snoozeReminder(mockUser, mockToken, 'reminder-1', 30)

    const callArgs = vi.mocked(fetch).mock.calls[0]
    const body = JSON.parse(callArgs[1]!.body as string)
    expect(body.user_id).toBe('user-123')
    expect(body.reminder_id).toBe('reminder-1')
    expect(body.snooze_minutes).toBe(30)
  })

  it('returns success on ok response', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as Response)

    const result = await snoozeReminder(mockUser, mockToken, 'reminder-1', 15)
    expect(result).toEqual({ success: true, error: null })
  })

  it('returns error on non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Reminder not found' }),
    } as Response)

    const result = await snoozeReminder(mockUser, mockToken, 'reminder-1', 15)
    expect(result).toEqual({ success: false, error: 'Reminder not found' })
  })

  it('returns default error message on non-ok response without error field', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: async () => ({}),
    } as Response)

    const result = await snoozeReminder(mockUser, mockToken, 'reminder-1', 15)
    expect(result.error).toBe('Failed to snooze reminder')
  })

  it('returns error on network failure', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Network error'))

    const result = await snoozeReminder(mockUser, mockToken, 'reminder-1', 15)
    expect(result).toEqual({ success: false, error: 'Failed to snooze reminder' })
  })
})

describe('dismissEventReminders', () => {
  it('returns error when user is null', async () => {
    const result = await dismissEventReminders(null as any, mockToken, 'event-1')
    expect(result).toEqual({ success: false, error: 'User not authenticated' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('returns error when accessToken is null', async () => {
    const result = await dismissEventReminders(mockUser, null as any, 'event-1')
    expect(result).toEqual({ success: false, error: 'User not authenticated' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('calls correct URL with POST method', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as Response)

    await dismissEventReminders(mockUser, mockToken, 'event-1')

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/reminders/dismiss-event'),
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mockToken}`,
        },
      })
    )
  })

  it('sends user_id and event_id in request body', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as Response)

    await dismissEventReminders(mockUser, mockToken, 'event-1')

    const callArgs = vi.mocked(fetch).mock.calls[0]
    const body = JSON.parse(callArgs[1]!.body as string)
    expect(body.user_id).toBe('user-123')
    expect(body.event_id).toBe('event-1')
  })

  it('returns success on ok response', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as Response)

    const result = await dismissEventReminders(mockUser, mockToken, 'event-1')
    expect(result).toEqual({ success: true, error: null })
  })

  it('returns error on non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Event not found' }),
    } as Response)

    const result = await dismissEventReminders(mockUser, mockToken, 'event-1')
    expect(result).toEqual({ success: false, error: 'Event not found' })
  })

  it('returns default error message on non-ok response without error field', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: async () => ({}),
    } as Response)

    const result = await dismissEventReminders(mockUser, mockToken, 'event-1')
    expect(result.error).toBe('Failed to dismiss event reminders')
  })

  it('returns error on network failure', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Network error'))

    const result = await dismissEventReminders(mockUser, mockToken, 'event-1')
    expect(result).toEqual({
      success: false,
      error: 'Failed to dismiss event reminders',
    })
  })
})
