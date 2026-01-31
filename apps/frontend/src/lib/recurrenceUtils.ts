/**
 * Frontend utilities for working with recurring events
 * Uses the same rrule library as the backend for consistency
 */

import { RRule, rrulestr } from 'rrule';

/**
 * Format RRULE for human-readable display
 * Examples:
 *   "FREQ=WEEKLY;BYDAY=MO,WE,FR" -> "Weekly on Monday, Wednesday, Friday"
 *   "FREQ=DAILY;COUNT=30" -> "Daily, 30 times"
 */
export function formatRRuleForDisplay(rrule: string): string {
  try {
    const parts = rrule.split(';');
    const params: { [key: string]: string } = {};

    for (const part of parts) {
      const [key, value] = part.split('=');
      if (key && value) {
        params[key] = value;
      }
    }

    // Format frequency
    const freqMap: { [key: string]: string } = {
      DAILY: 'Daily',
      WEEKLY: 'Weekly',
      MONTHLY: 'Monthly',
      YEARLY: 'Yearly'
    };

    let result = freqMap[params.FREQ] || params.FREQ;

    // Add interval
    if (params.INTERVAL && parseInt(params.INTERVAL, 10) > 1) {
      result = `Every ${params.INTERVAL} ${params.FREQ.toLowerCase()}`;
    }

    // Add days of week
    if (params.BYDAY) {
      const dayMap: { [key: string]: string } = {
        MO: 'Monday',
        TU: 'Tuesday',
        WE: 'Wednesday',
        TH: 'Thursday',
        FR: 'Friday',
        SA: 'Saturday',
        SU: 'Sunday'
      };

      const days = params.BYDAY.split(',').map(d => dayMap[d] || d);
      result += ` on ${days.join(', ')}`;
    }

    // Add count
    if (params.COUNT) {
      result += `, ${params.COUNT} times`;
    }

    // Add until date
    if (params.UNTIL) {
      const untilDate = params.UNTIL.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
      result += ` until ${untilDate}`;
    }

    return result;
  } catch (error) {
    console.error('Error formatting RRULE:', error);
    return rrule;
  }
}

/**
 * Get next N occurrences of a recurring event
 *
 * IMPORTANT: The rrule library evaluates BYDAY constraints in UTC.
 * Our events are stored in UTC but represent local times.
 * We convert UTC to "fake UTC" local time for correct day-of-week matching,
 * then convert the results back for display.
 */
export function getNextOccurrences(
  rruleStr: string,
  startTime: Date,
  count: number = 5,
  userTimezone?: string
): Date[] {
  try {
    const tz = userTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

    // Extract local time components from the UTC date
    const options = { timeZone: tz };
    const localYear = parseInt(startTime.toLocaleString('en-US', { ...options, year: 'numeric' }));
    const localMonth = parseInt(startTime.toLocaleString('en-US', { ...options, month: 'numeric' })) - 1;
    const localDay = parseInt(startTime.toLocaleString('en-US', { ...options, day: 'numeric' }));
    const localHour = parseInt(startTime.toLocaleString('en-US', { ...options, hour: 'numeric', hour12: false }));
    const localMinute = parseInt(startTime.toLocaleString('en-US', { ...options, minute: 'numeric' }));

    // Create a "fake UTC" date with local time components
    // This makes rrule evaluate BYDAY in the user's local timezone
    const localDtstart = new Date(Date.UTC(localYear, localMonth, localDay, localHour, localMinute, 0));

    const rule = rrulestr(rruleStr, { dtstart: localDtstart });

    // Get current time in the same "fake UTC" format for filtering
    const now = new Date();
    const nowYear = parseInt(now.toLocaleString('en-US', { ...options, year: 'numeric' }));
    const nowMonth = parseInt(now.toLocaleString('en-US', { ...options, month: 'numeric' })) - 1;
    const nowDay = parseInt(now.toLocaleString('en-US', { ...options, day: 'numeric' }));
    const nowHour = parseInt(now.toLocaleString('en-US', { ...options, hour: 'numeric', hour12: false }));
    const nowMinute = parseInt(now.toLocaleString('en-US', { ...options, minute: 'numeric' }));
    const localNow = new Date(Date.UTC(nowYear, nowMonth, nowDay, nowHour, nowMinute, 0));

    const endDate = new Date(localNow.getTime() + 365 * 24 * 60 * 60 * 1000);
    const searchStart = localNow > localDtstart ? localNow : localDtstart;

    // Get occurrences (these are in "fake UTC" format)
    const fakeUtcOccurrences = rule.between(searchStart, endDate, true).slice(0, count);

    // Convert back to real local dates for display
    // The "fake UTC" dates have local time in UTC fields, so we read UTC and display as-is
    return fakeUtcOccurrences.map(fakeUtc => {
      // Create a real local date from the fake UTC components
      return new Date(
        fakeUtc.getUTCFullYear(),
        fakeUtc.getUTCMonth(),
        fakeUtc.getUTCDate(),
        fakeUtc.getUTCHours(),
        fakeUtc.getUTCMinutes(),
        0
      );
    });
  } catch (error) {
    console.error('Error getting next occurrences:', error);
    return [];
  }
}

/**
 * Format recurrence for display in event details
 */
export function getRecurrenceBadge(event: any): string | null {
  if (!event.is_recurring || !event.recurrence_rule) {
    return null;
  }

  try {
    const description = formatRRuleForDisplay(event.recurrence_rule);
    return description;
  } catch {
    return 'Recurring';
  }
}

/**
 * Check if an event is part of a recurring series
 */
export function isRecurringInstance(event: any): boolean {
  return event.parent_event_id ? true : false;
}

/**
 * Get the parent event ID if this is an instance
 */
export function getParentEventId(event: any): string | null {
  return event.parent_event_id || null;
}

/**
 * Format common recurrence patterns for UI picker
 */
export const RECURRENCE_PRESETS = [
  {
    label: 'Every Day',
    rrule: 'FREQ=DAILY',
    description: 'Occurs every day'
  },
  {
    label: 'Every Weekday',
    rrule: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
    description: 'Occurs Monday through Friday'
  },
  {
    label: 'Every Week',
    rrule: 'FREQ=WEEKLY',
    description: 'Occurs every week on the same day'
  },
  {
    label: 'Every 2 Weeks',
    rrule: 'FREQ=WEEKLY;INTERVAL=2',
    description: 'Occurs every other week'
  },
  {
    label: 'Every Month',
    rrule: 'FREQ=MONTHLY',
    description: 'Occurs every month on the same date'
  },
  {
    label: 'Every Year',
    rrule: 'FREQ=YEARLY',
    description: 'Occurs every year on the same date'
  }
];

/**
 * Convert form data to RRULE
 * @param pattern Pattern type: 'daily', 'weekly', 'monthly', 'yearly'
 * @param interval Repeat every N units
 * @param daysOfWeek Days for weekly: ['MO', 'TU', 'WE', 'TH', 'FR']
 * @param dayOfMonth Day for monthly: 1-31
 * @param endType 'never', 'after', 'until'
 * @param count Number of occurrences (if endType is 'after')
 * @param untilDate End date (if endType is 'until')
 */
export function buildRRuleFromForm({
  pattern,
  interval = 1,
  daysOfWeek = [],
  dayOfMonth = 1,
  endType = 'never',
  count,
  untilDate
}: {
  pattern: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval?: number;
  daysOfWeek?: string[];
  dayOfMonth?: number;
  endType?: 'never' | 'after' | 'until';
  count?: number;
  untilDate?: Date;
}): string {
  const freqMap = {
    daily: 'DAILY',
    weekly: 'WEEKLY',
    monthly: 'MONTHLY',
    yearly: 'YEARLY'
  };

  let rrule = `FREQ=${freqMap[pattern]}`;

  if (interval > 1) {
    rrule += `;INTERVAL=${interval}`;
  }

  if (pattern === 'weekly' && daysOfWeek.length > 0) {
    rrule += `;BYDAY=${daysOfWeek.join(',')}`;
  }

  if (pattern === 'monthly' && dayOfMonth) {
    rrule += `;BYMONTHDAY=${dayOfMonth}`;
  }

  if (endType === 'after' && count) {
    rrule += `;COUNT=${count}`;
  } else if (endType === 'until' && untilDate) {
    const dateStr = untilDate.toISOString().split('T')[0].replace(/-/g, '');
    rrule += `;UNTIL=${dateStr}`;
  }

  return rrule;
}

/**
 * Parse RRULE to get form data (reverse of buildRRuleFromForm)
 */
export function parseRRuleToForm(rrule: string) {
  try {
    const parts = rrule.split(';');
    const params: { [key: string]: string } = {};

    for (const part of parts) {
      const [key, value] = part.split('=');
      if (key && value) {
        params[key] = value;
      }
    }

    const freqMap: { [key: string]: 'daily' | 'weekly' | 'monthly' | 'yearly' } = {
      DAILY: 'daily',
      WEEKLY: 'weekly',
      MONTHLY: 'monthly',
      YEARLY: 'yearly'
    };

    const formData: any = {
      pattern: freqMap[params.FREQ] || 'weekly',
      interval: params.INTERVAL ? parseInt(params.INTERVAL, 10) : 1,
      dayOfMonth: params.BYMONTHDAY ? parseInt(params.BYMONTHDAY, 10) : 1,
      daysOfWeek: params.BYDAY ? params.BYDAY.split(',') : [],
      endType: params.COUNT ? 'after' : params.UNTIL ? 'until' : 'never',
      count: params.COUNT ? parseInt(params.COUNT, 10) : undefined,
      untilDate: params.UNTIL ? new Date(params.UNTIL.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')) : undefined
    };

    return formData;
  } catch (error) {
    console.error('Error parsing RRULE:', error);
    return null;
  }
}

/**
 * Validate RRULE format
 */
export function validateRRule(rrule: string): boolean {
  try {
    rrulestr(rrule, { dtstart: new Date() });
    return true;
  } catch {
    return false;
  }
}
