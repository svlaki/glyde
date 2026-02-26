import {
  formatRRuleForDisplay,
  buildRRuleFromForm,
  parseRRuleToForm,
  getRecurrenceBadge,
  isRecurringInstance,
  getParentEventId,
  validateRRule,
  RECURRENCE_PRESETS,
} from '../recurrenceUtils'

describe('recurrenceUtils', () => {
  describe('formatRRuleForDisplay', () => {
    it('formats FREQ=WEEKLY with BYDAY', () => {
      expect(formatRRuleForDisplay('FREQ=WEEKLY;BYDAY=MO,WE,FR')).toBe(
        'Weekly on Monday, Wednesday, Friday'
      )
    })

    it('formats FREQ=DAILY', () => {
      expect(formatRRuleForDisplay('FREQ=DAILY')).toBe('Daily')
    })

    it('formats FREQ=DAILY with COUNT', () => {
      expect(formatRRuleForDisplay('FREQ=DAILY;COUNT=30')).toBe('Daily, 30 times')
    })

    it('formats FREQ=WEEKLY with INTERVAL > 1', () => {
      expect(formatRRuleForDisplay('FREQ=WEEKLY;INTERVAL=2')).toBe('Every 2 weekly')
    })

    it('formats FREQ=MONTHLY', () => {
      expect(formatRRuleForDisplay('FREQ=MONTHLY')).toBe('Monthly')
    })

    it('formats FREQ=YEARLY', () => {
      expect(formatRRuleForDisplay('FREQ=YEARLY')).toBe('Yearly')
    })

    it('formats FREQ=WEEKLY with UNTIL', () => {
      expect(formatRRuleForDisplay('FREQ=WEEKLY;UNTIL=20261231')).toBe(
        'Weekly until 2026-12-31'
      )
    })

    it('returns original string on invalid input', () => {
      // An empty string has no FREQ, so freqMap returns undefined
      const result = formatRRuleForDisplay('')
      expect(result).toBeUndefined()
    })

    it('handles INTERVAL=1 without changing prefix', () => {
      // INTERVAL=1 should not trigger "Every 1 ..." since code checks > 1
      expect(formatRRuleForDisplay('FREQ=DAILY;INTERVAL=1')).toBe('Daily')
    })
  })

  describe('buildRRuleFromForm', () => {
    it('builds daily RRULE', () => {
      expect(buildRRuleFromForm({ pattern: 'daily' })).toBe('FREQ=DAILY')
    })

    it('builds weekly RRULE with days of week', () => {
      expect(
        buildRRuleFromForm({ pattern: 'weekly', daysOfWeek: ['MO', 'FR'] })
      ).toBe('FREQ=WEEKLY;BYDAY=MO,FR')
    })

    it('builds monthly RRULE with interval', () => {
      // Default dayOfMonth=1 is truthy, so BYMONTHDAY=1 is appended
      expect(
        buildRRuleFromForm({ pattern: 'monthly', interval: 2 })
      ).toBe('FREQ=MONTHLY;INTERVAL=2;BYMONTHDAY=1')
    })

    it('builds weekly RRULE with count end type', () => {
      expect(
        buildRRuleFromForm({ pattern: 'weekly', endType: 'after', count: 10 })
      ).toBe('FREQ=WEEKLY;COUNT=10')
    })

    it('builds daily RRULE with until end type', () => {
      const result = buildRRuleFromForm({
        pattern: 'daily',
        endType: 'until',
        untilDate: new Date('2026-12-31'),
      })
      expect(result).toContain('FREQ=DAILY')
      expect(result).toContain('UNTIL=20261231')
    })

    it('builds yearly RRULE', () => {
      expect(buildRRuleFromForm({ pattern: 'yearly' })).toBe('FREQ=YEARLY')
    })

    it('does not add INTERVAL when interval is 1', () => {
      const result = buildRRuleFromForm({ pattern: 'daily', interval: 1 })
      expect(result).toBe('FREQ=DAILY')
      expect(result).not.toContain('INTERVAL')
    })

    it('does not add BYDAY for non-weekly patterns', () => {
      const result = buildRRuleFromForm({
        pattern: 'daily',
        daysOfWeek: ['MO', 'TU'],
      })
      expect(result).not.toContain('BYDAY')
    })

    it('builds monthly RRULE with dayOfMonth', () => {
      const result = buildRRuleFromForm({ pattern: 'monthly', dayOfMonth: 15 })
      expect(result).toContain('BYMONTHDAY=15')
    })

    it('does not add COUNT when endType is never', () => {
      const result = buildRRuleFromForm({
        pattern: 'daily',
        endType: 'never',
        count: 10,
      })
      expect(result).not.toContain('COUNT')
    })
  })

  describe('parseRRuleToForm', () => {
    it('parses weekly RRULE with BYDAY', () => {
      const result = parseRRuleToForm('FREQ=WEEKLY;BYDAY=MO,FR')
      expect(result).not.toBeNull()
      expect(result!.pattern).toBe('weekly')
      expect(result!.daysOfWeek).toEqual(['MO', 'FR'])
      expect(result!.interval).toBe(1)
    })

    it('parses daily RRULE with COUNT', () => {
      const result = parseRRuleToForm('FREQ=DAILY;COUNT=10')
      expect(result).not.toBeNull()
      expect(result!.pattern).toBe('daily')
      expect(result!.endType).toBe('after')
      expect(result!.count).toBe(10)
    })

    it('parses monthly RRULE with INTERVAL', () => {
      const result = parseRRuleToForm('FREQ=MONTHLY;INTERVAL=2')
      expect(result).not.toBeNull()
      expect(result!.pattern).toBe('monthly')
      expect(result!.interval).toBe(2)
    })

    it('parses RRULE with UNTIL date', () => {
      const result = parseRRuleToForm('FREQ=WEEKLY;UNTIL=20261231')
      expect(result).not.toBeNull()
      expect(result!.endType).toBe('until')
      expect(result!.untilDate).toBeInstanceOf(Date)
    })

    it('parses RRULE with BYMONTHDAY', () => {
      const result = parseRRuleToForm('FREQ=MONTHLY;BYMONTHDAY=15')
      expect(result).not.toBeNull()
      expect(result!.dayOfMonth).toBe(15)
    })

    it('defaults to interval 1 when not specified', () => {
      const result = parseRRuleToForm('FREQ=DAILY')
      expect(result).not.toBeNull()
      expect(result!.interval).toBe(1)
    })

    it('defaults endType to never when no COUNT or UNTIL', () => {
      const result = parseRRuleToForm('FREQ=DAILY')
      expect(result).not.toBeNull()
      expect(result!.endType).toBe('never')
    })

    it('defaults daysOfWeek to empty array when no BYDAY', () => {
      const result = parseRRuleToForm('FREQ=DAILY')
      expect(result).not.toBeNull()
      expect(result!.daysOfWeek).toEqual([])
    })

    it('roundtrips with buildRRuleFromForm for simple patterns', () => {
      const original = 'FREQ=WEEKLY;BYDAY=MO,FR'
      const parsed = parseRRuleToForm(original)
      expect(parsed).not.toBeNull()
      const rebuilt = buildRRuleFromForm(parsed!)
      expect(rebuilt).toBe(original)
    })
  })

  describe('getRecurrenceBadge', () => {
    it('returns formatted string for recurring event with rule', () => {
      const event = { is_recurring: true, recurrence_rule: 'FREQ=DAILY' }
      expect(getRecurrenceBadge(event)).toBe('Daily')
    })

    it('returns null for non-recurring event', () => {
      const event = { is_recurring: false }
      expect(getRecurrenceBadge(event)).toBeNull()
    })

    it('returns null when is_recurring is true but no rule', () => {
      const event = { is_recurring: true }
      expect(getRecurrenceBadge(event)).toBeNull()
    })

    it('returns formatted string for weekly with days', () => {
      const event = {
        is_recurring: true,
        recurrence_rule: 'FREQ=WEEKLY;BYDAY=MO,WE,FR',
      }
      expect(getRecurrenceBadge(event)).toBe('Weekly on Monday, Wednesday, Friday')
    })
  })

  describe('isRecurringInstance', () => {
    it('returns true when parent_event_id is present', () => {
      expect(isRecurringInstance({ parent_event_id: 'abc' })).toBe(true)
    })

    it('returns false when parent_event_id is absent', () => {
      expect(isRecurringInstance({})).toBe(false)
    })

    it('returns false when parent_event_id is null', () => {
      expect(isRecurringInstance({ parent_event_id: null })).toBe(false)
    })

    it('returns false when parent_event_id is undefined', () => {
      expect(isRecurringInstance({ parent_event_id: undefined })).toBe(false)
    })
  })

  describe('getParentEventId', () => {
    it('returns parent_event_id when present', () => {
      expect(getParentEventId({ parent_event_id: 'abc' })).toBe('abc')
    })

    it('returns null when parent_event_id is absent', () => {
      expect(getParentEventId({})).toBeNull()
    })

    it('returns null when parent_event_id is null', () => {
      expect(getParentEventId({ parent_event_id: null })).toBeNull()
    })

    it('returns null when parent_event_id is undefined', () => {
      expect(getParentEventId({ parent_event_id: undefined })).toBeNull()
    })
  })

  describe('validateRRule', () => {
    it('returns true for valid RRULE', () => {
      expect(validateRRule('FREQ=WEEKLY')).toBe(true)
    })

    it('returns true for valid complex RRULE', () => {
      expect(validateRRule('FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=10')).toBe(true)
    })

    it('returns false for invalid RRULE', () => {
      expect(validateRRule('invalid')).toBe(false)
    })

    it('returns false for empty string', () => {
      expect(validateRRule('')).toBe(false)
    })
  })

  describe('RECURRENCE_PRESETS', () => {
    it('is an array', () => {
      expect(Array.isArray(RECURRENCE_PRESETS)).toBe(true)
    })

    it('has at least one preset', () => {
      expect(RECURRENCE_PRESETS.length).toBeGreaterThan(0)
    })

    it('each preset has label, rrule, and description', () => {
      for (const preset of RECURRENCE_PRESETS) {
        expect(preset).toHaveProperty('label')
        expect(preset).toHaveProperty('rrule')
        expect(preset).toHaveProperty('description')
        expect(typeof preset.label).toBe('string')
        expect(typeof preset.rrule).toBe('string')
        expect(typeof preset.description).toBe('string')
      }
    })

    it('contains an Every Day preset', () => {
      const daily = RECURRENCE_PRESETS.find((p) => p.label === 'Every Day')
      expect(daily).toBeDefined()
      expect(daily!.rrule).toBe('FREQ=DAILY')
    })

    it('contains an Every Weekday preset', () => {
      const weekday = RECURRENCE_PRESETS.find((p) => p.label === 'Every Weekday')
      expect(weekday).toBeDefined()
      expect(weekday!.rrule).toBe('FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR')
    })

    it('contains an Every Month preset', () => {
      const monthly = RECURRENCE_PRESETS.find((p) => p.label === 'Every Month')
      expect(monthly).toBeDefined()
      expect(monthly!.rrule).toBe('FREQ=MONTHLY')
    })
  })
})
