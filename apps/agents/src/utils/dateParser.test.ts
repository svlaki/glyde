import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DateParser } from './dateParser'

describe('DateParser', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('parses "tomorrow at 2pm" with a 1h duration', () => {
    const fixedNow = new Date('2025-01-15T10:00:00Z')
    vi.setSystemTime(fixedNow)
    const { startTime, endTime } = DateParser.parseNaturalLanguage('Schedule meeting tomorrow at 2pm')
    const start = new Date(startTime)
    const end = new Date(endTime)
    // Should be next local day at 14:00, with 1 hour duration
    expect(end.getTime() - start.getTime()).toBe(60 * 60 * 1000)
  })

  it('defaults to 9am when time missing for tomorrow', () => {
    const fixedNow = new Date('2025-01-15T10:00:00Z')
    vi.setSystemTime(fixedNow)
    const { startTime } = DateParser.parseNaturalLanguage('Book lunch tomorrow')
    const start = new Date(startTime)
    expect(start.getHours()).toBe(9)
  })

  it('extracts a reasonable title', () => {
    const title = DateParser.extractTitle('Schedule dinner tomorrow at 7pm')
    expect(title.toLowerCase()).toContain('dinner')
  })
})


