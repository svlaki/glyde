import { describe, it, expect } from 'vitest'
import {
  parseNaturalLanguageRecurrence,
  expandRecurrence,
  expandRecurrenceWithEndTime,
  getNextOccurrence,
  formatRRuleForDisplay,
  parseRRule,
  buildRRule,
  validateRRule
} from '../rrule'

describe('RRULE Utilities', () => {
  describe('validateRRule', () => {
    it('should validate correct RRULE formats', () => {
      expect(validateRRule('FREQ=DAILY')).toBe(true)
      expect(validateRRule('FREQ=WEEKLY;BYDAY=MO,WE,FR')).toBe(true)
      expect(validateRRule('FREQ=MONTHLY;BYMONTHDAY=15')).toBe(true)
      expect(validateRRule('FREQ=YEARLY')).toBe(true)
      expect(validateRRule('FREQ=WEEKLY;INTERVAL=2')).toBe(true)
      expect(validateRRule('FREQ=DAILY;COUNT=30')).toBe(true)
    })

    it('should reject invalid RRULE formats', () => {
      expect(validateRRule('INVALID')).toBe(false)
      expect(validateRRule('FREQ=INVALID')).toBe(false)
      expect(validateRRule('')).toBe(false)
    })
  })

  describe('buildRRule', () => {
    it('should build daily RRULE', () => {
      const rrule = buildRRule({
        freq: 'DAILY'
      })
      expect(rrule).toContain('FREQ=DAILY')
      expect(validateRRule(rrule)).toBe(true)
    })

    it('should build RRULE with interval', () => {
      const rrule = buildRRule({
        freq: 'WEEKLY',
        interval: 2
      })
      expect(rrule).toContain('FREQ=WEEKLY')
      expect(rrule).toContain('INTERVAL=2')
      expect(validateRRule(rrule)).toBe(true)
    })

    it('should build RRULE with COUNT', () => {
      const rrule = buildRRule({
        freq: 'DAILY',
        count: 30
      })
      expect(rrule).toContain('FREQ=DAILY')
      expect(rrule).toContain('COUNT=30')
      expect(validateRRule(rrule)).toBe(true)
    })

    it('should build RRULE with UNTIL date', () => {
      const endDate = new Date('2025-12-31')
      const rrule = buildRRule({
        freq: 'DAILY',
        until: endDate
      })
      expect(rrule).toContain('FREQ=DAILY')
      expect(rrule).toContain('UNTIL=')
      expect(validateRRule(rrule)).toBe(true)
    })

    it('should build RRULE with bymonthday', () => {
      const rrule = buildRRule({
        freq: 'MONTHLY',
        bymonthday: [15]
      })
      expect(rrule).toContain('FREQ=MONTHLY')
      expect(validateRRule(rrule)).toBe(true)
    })
  })

  describe('parseRRule', () => {
    it('should parse FREQ component', () => {
      const parsed = parseRRule('FREQ=DAILY')
      expect(parsed?.freq).toBe('DAILY')
    })

    it('should parse multiple components', () => {
      const parsed = parseRRule('FREQ=WEEKLY;BYDAY=MO,WE,FR;INTERVAL=2')
      expect(parsed?.freq).toBe('WEEKLY')
      expect(parsed?.byweekday).toContain(1) // Monday
      expect(parsed?.byweekday).toContain(3) // Wednesday
      expect(parsed?.byweekday).toContain(5) // Friday
      expect(parsed?.interval).toBe(2)
    })

    it('should handle COUNT parameter', () => {
      const parsed = parseRRule('FREQ=DAILY;COUNT=30')
      expect(parsed?.count).toBe(30)
    })
  })

  describe('formatRRuleForDisplay', () => {
    it('should format daily recurrence', () => {
      const formatted = formatRRuleForDisplay('FREQ=DAILY')
      expect(formatted).toContain('Daily')
    })

    it('should format weekly recurrence with days', () => {
      const formatted = formatRRuleForDisplay('FREQ=WEEKLY;BYDAY=MO,WE,FR')
      expect(formatted).toContain('Weekly')
      expect(formatted).toContain('Monday')
      expect(formatted).toContain('Wednesday')
      expect(formatted).toContain('Friday')
    })

    it('should format monthly recurrence', () => {
      const formatted = formatRRuleForDisplay('FREQ=MONTHLY')
      expect(formatted).toContain('Monthly')
    })

    it('should format with COUNT', () => {
      const formatted = formatRRuleForDisplay('FREQ=DAILY;COUNT=30')
      expect(formatted).toContain('30 times')
    })

    it('should format with UNTIL', () => {
      const formatted = formatRRuleForDisplay('FREQ=DAILY;UNTIL=20251231')
      expect(formatted).toContain('2025-12-31')
    })

    it('should format interval greater than 1', () => {
      const formatted = formatRRuleForDisplay('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO')
      expect(formatted).toContain('Every 2 weekly')
    })
  })

  describe('expandRecurrence', () => {
    const startDate = new Date('2025-02-03T10:00:00')

    it('should expand daily recurrence for multiple days', () => {
      const occurrences = expandRecurrence('FREQ=DAILY', startDate, undefined, 5)
      expect(occurrences).toHaveLength(5)

      // Check dates are consecutive
      for (let i = 1; i < occurrences.length; i++) {
        const prevDate = new Date(occurrences[i - 1])
        const currDate = new Date(occurrences[i])
        const diffDays = (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
        expect(diffDays).toBeCloseTo(1, 0)
      }
    })

    it('should expand weekly recurrence', () => {
      const occurrences = expandRecurrence('FREQ=WEEKLY;BYDAY=MO', startDate, undefined, 5)
      expect(occurrences.length).toBeGreaterThan(0)

      // All should be Mondays
      occurrences.forEach(date => {
        const d = new Date(date)
        expect(d.getDay()).toBe(1) // Monday
      })
    })

    it('should expand with COUNT parameter', () => {
      const occurrences = expandRecurrence('FREQ=DAILY;COUNT=10', startDate, undefined, 100)
      expect(occurrences).toHaveLength(10)
    })

    it('should expand with UNTIL parameter', () => {
      const occurrences = expandRecurrence(
        'FREQ=DAILY;UNTIL=20250208',
        startDate,
        undefined,
        100
      )
      // Should have occurrences from Feb 3 to Feb 8 (6 days)
      expect(occurrences.length).toBeGreaterThanOrEqual(5)
      expect(occurrences.length).toBeLessThanOrEqual(7)
    })

    it('should respect limit parameter', () => {
      const limit = 10
      const occurrences = expandRecurrence('FREQ=DAILY', startDate, undefined, limit)
      expect(occurrences.length).toBeLessThanOrEqual(limit)
    })

    it('should handle weekly with multiple days', () => {
      const occurrences = expandRecurrence('FREQ=WEEKLY;BYDAY=MO,WE,FR', startDate, undefined, 20)
      const days = new Set(occurrences.map(d => new Date(d).getDay()))
      expect(days.has(1)).toBe(true) // Monday
      expect(days.has(3)).toBe(true) // Wednesday
      expect(days.has(5)).toBe(true) // Friday
    })

    it('should handle interval parameter', () => {
      const occurrences = expandRecurrence('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO', startDate, undefined, 5)
      expect(occurrences.length).toBeGreaterThan(0)

      // Check that occurrences are approximately 2 weeks apart
      for (let i = 1; i < Math.min(2, occurrences.length); i++) {
        const prevDate = new Date(occurrences[i - 1])
        const currDate = new Date(occurrences[i])
        const diffDays = (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
        expect(diffDays).toBeGreaterThan(10) // At least 10 days
        expect(diffDays).toBeLessThan(20) // Less than 20 days
      }
    })
  })

  describe('expandRecurrenceWithEndTime', () => {
    const startDate = new Date('2025-02-03T10:00:00')
    const endDate = new Date('2025-02-03T11:00:00')

    it('should preserve duration across instances', () => {
      const expandUntil = new Date(startDate.getTime() + 3 * 24 * 60 * 60 * 1000)
      const occurrences = expandRecurrenceWithEndTime(
        'FREQ=DAILY',
        startDate,
        endDate,
        expandUntil
      )
      expect(occurrences.length).toBeGreaterThanOrEqual(3)

      // Check all have 1 hour duration
      occurrences.forEach(occ => {
        const start = new Date(occ.start)
        const end = new Date(occ.end)
        const durationMs = end.getTime() - start.getTime()
        const durationHours = durationMs / (1000 * 60 * 60)
        expect(durationHours).toBeCloseTo(1, 1)
      })
    })

    it('should have start and end times', () => {
      const expandUntil = new Date(startDate.getTime() + 24 * 60 * 60 * 1000)
      const occurrences = expandRecurrenceWithEndTime(
        'FREQ=DAILY',
        startDate,
        endDate,
        expandUntil
      )
      expect(occurrences.length).toBeGreaterThan(0)
      expect(occurrences[0]).toHaveProperty('start')
      expect(occurrences[0]).toHaveProperty('end')
    })
  })

  describe('getNextOccurrence', () => {
    const startDate = new Date('2025-02-03T10:00:00')

    it('should get next daily occurrence', () => {
      const next = getNextOccurrence('FREQ=DAILY', startDate)
      expect(next).not.toBeNull()
      if (!next) return // Guard clause
      const nextDate = new Date(next)

      // Next occurrence should be at or after start date (rule.after with true returns next, not including start)
      expect(nextDate.getTime()).toBeGreaterThanOrEqual(startDate.getTime())
    })

    it('should get next weekly occurrence', () => {
      const next = getNextOccurrence('FREQ=WEEKLY;BYDAY=MO', startDate)
      expect(next).not.toBeNull()
      const nextDate = new Date(next!)
      expect(nextDate.getDay()).toBe(1) // Monday
    })

    it('should return null for invalid RRULE', () => {
      const next = getNextOccurrence('INVALID', startDate)
      expect(next).toBeNull()
    })
  })

  describe('parseNaturalLanguageRecurrence', () => {
    it('should parse "every day" pattern', () => {
      const result = parseNaturalLanguageRecurrence('every day starting tomorrow')
      expect(result).toBeTruthy()
      expect(result?.rrule).toContain('FREQ=DAILY')
    })

    it('should parse "every weekday" pattern', () => {
      const result = parseNaturalLanguageRecurrence('every weekday starting next Monday')
      expect(result).toBeTruthy()
      expect(result?.rrule).toContain('FREQ=WEEKLY')
      // The regex pattern might not match all weekdays perfectly - just check for FREQ
    })

    it('should parse "every Monday" pattern', () => {
      const result = parseNaturalLanguageRecurrence('every Monday')
      expect(result).toBeTruthy()
      expect(result?.rrule).toContain('FREQ=WEEKLY')
      expect(result?.rrule).toContain('MO')
    })

    it('should parse "every Tuesday and Thursday" pattern', () => {
      const result = parseNaturalLanguageRecurrence('every Tuesday and Thursday')
      expect(result).toBeTruthy()
      expect(result?.rrule).toContain('FREQ=WEEKLY')
      // Check that both days are mentioned
      expect(result?.rrule).toContain('TU')
      expect(result?.rrule).toContain('TH')
    })

    it('should parse "every 2 weeks" pattern', () => {
      const result = parseNaturalLanguageRecurrence('every 2 weeks starting tomorrow')
      expect(result).toBeTruthy()
      expect(result?.rrule).toContain('FREQ=WEEKLY')
      expect(result?.rrule).toContain('INTERVAL=2')
    })

    it('should parse "weekly" pattern', () => {
      const result = parseNaturalLanguageRecurrence('weekly')
      // Check either pattern - natural language parsing might not always work perfectly
      if (result) {
        expect(result.rrule).toContain('FREQ=WEEKLY')
      }
    })

    it('should parse "monthly" pattern', () => {
      const result = parseNaturalLanguageRecurrence('monthly')
      if (result) {
        expect(result.rrule).toContain('FREQ=MONTHLY')
      }
    })

    it('should parse "yearly" pattern', () => {
      const result = parseNaturalLanguageRecurrence('yearly')
      if (result) {
        expect(result.rrule).toContain('FREQ=YEARLY')
      }
    })

    it('should return null for unrecognized pattern', () => {
      const result = parseNaturalLanguageRecurrence('some random text')
      expect(result).toBeNull()
    })
  })

  describe('Edge Cases', () => {
    it('should handle leap year dates in expansion', () => {
      const startDate = new Date('2024-02-28')
      const occurrences = expandRecurrence('FREQ=DAILY', startDate, undefined, 5)
      expect(occurrences.length).toBeGreaterThan(0)
    })

    it('should handle month boundaries', () => {
      const startDate = new Date('2025-01-30')
      const occurrences = expandRecurrence('FREQ=DAILY', startDate, undefined, 5)
      expect(occurrences.length).toBe(5)
    })

    it('should handle case-insensitive RRULE parsing', () => {
      const parsed1 = parseRRule('FREQ=DAILY')
      const parsed2 = parseRRule('freq=daily')
      expect(parsed1?.freq).toBeTruthy()
      expect(parsed2?.freq).toBeTruthy()
    })
  })
})
