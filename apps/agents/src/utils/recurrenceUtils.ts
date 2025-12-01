/**
 * Recurrence utility functions for expanding recurring events
 * Uses rrule library (RFC 5545 compliant)
 */
import rrule from 'rrule';
const { RRule } = rrule;
import { DatabaseEvent } from '../types/database.js';

export interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval?: number;  // Every N days/weeks/months/years (default: 1)
  daysOfWeek?: number[];  // 0=Monday, 1=Tuesday, ... 6=Sunday (for weekly)
  dayOfMonth?: number;  // 1-31 (for monthly)
  endDate?: string;  // ISO date string
  count?: number;  // Number of occurrences (alternative to endDate)
}

/**
 * Convert our friendly recurrence rule to RRULE string
 */
export function createRRuleString(rule: RecurrenceRule): string {
  const parts: string[] = [];

  // Frequency
  const freqMap: Record<string, string> = {
    daily: 'DAILY',
    weekly: 'WEEKLY',
    monthly: 'MONTHLY',
    yearly: 'YEARLY'
  };
  parts.push(`FREQ=${freqMap[rule.frequency]}`);

  // Interval
  if (rule.interval && rule.interval > 1) {
    parts.push(`INTERVAL=${rule.interval}`);
  }

  // Days of week (for weekly recurrence)
  if (rule.daysOfWeek && rule.daysOfWeek.length > 0) {
    const dayMap = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
    const days = rule.daysOfWeek.map(d => dayMap[d]).join(',');
    parts.push(`BYDAY=${days}`);
  }

  // Day of month (for monthly recurrence)
  if (rule.dayOfMonth) {
    parts.push(`BYMONTHDAY=${rule.dayOfMonth}`);
  }

  // End date or count
  if (rule.endDate) {
    const endDateFormatted = rule.endDate.replace(/[-:]/g, '').split('.')[0] + 'Z';
    parts.push(`UNTIL=${endDateFormatted}`);
  } else if (rule.count) {
    parts.push(`COUNT=${rule.count}`);
  }

  return parts.join(';');
}

/**
 * Parse an RRULE string back to our friendly format
 */
export function parseRRuleString(rruleString: string): RecurrenceRule | null {
  try {
    const rule = RRule.fromString(`RRULE:${rruleString}`);
    const options = rule.options;

    const freqMap: Record<number, RecurrenceRule['frequency']> = {
      [RRule.DAILY]: 'daily',
      [RRule.WEEKLY]: 'weekly',
      [RRule.MONTHLY]: 'monthly',
      [RRule.YEARLY]: 'yearly'
    };

    const result: RecurrenceRule = {
      frequency: freqMap[options.freq] || 'weekly'
    };

    if (options.interval && options.interval > 1) {
      result.interval = options.interval;
    }

    if (options.byweekday && options.byweekday.length > 0) {
      result.daysOfWeek = options.byweekday.map((d: any) =>
        typeof d === 'number' ? d : d.weekday
      );
    }

    if (options.bymonthday && options.bymonthday.length > 0) {
      result.dayOfMonth = options.bymonthday[0];
    }

    if (options.until) {
      result.endDate = options.until.toISOString();
    }

    if (options.count) {
      result.count = options.count;
    }

    return result;
  } catch (error) {
    console.error('Error parsing RRULE string:', error);
    return null;
  }
}

/**
 * Expand a recurring event into individual occurrences within a date range
 */
export function expandRecurringEvent(
  event: DatabaseEvent & { recurrence_rule?: string; recurrence_end?: string },
  rangeStart: Date,
  rangeEnd: Date,
  maxOccurrences: number = 100
): DatabaseEvent[] {
  if (!event.recurrence_rule) {
    return [event];
  }

  try {
    const eventStart = new Date(event.start_time);
    const eventEnd = new Date(event.end_time);
    const eventDuration = eventEnd.getTime() - eventStart.getTime();

    // Create RRule with the event's start time as dtstart
    const rrule = RRule.fromString(`DTSTART:${formatDateToRRule(eventStart)}\nRRULE:${event.recurrence_rule}`);

    // Get occurrences within the date range
    const occurrences = rrule.between(rangeStart, rangeEnd, true);

    // Limit occurrences
    const limitedOccurrences = occurrences.slice(0, maxOccurrences);

    // Create expanded event instances
    return limitedOccurrences.map((occurrence, index) => {
      const occurrenceEnd = new Date(occurrence.getTime() + eventDuration);

      return {
        ...event,
        // Generate a unique ID for each occurrence (original_id + occurrence_index)
        id: `${event.id}_${index}`,
        start_time: occurrence.toISOString(),
        end_time: occurrenceEnd.toISOString(),
        // Mark as a recurring instance
        parent_event_id: event.id,
        is_recurring: true
      } as DatabaseEvent;
    });
  } catch (error) {
    console.error('Error expanding recurring event:', error);
    return [event];
  }
}

/**
 * Format a Date to RRULE datetime format
 */
function formatDateToRRule(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

/**
 * Helper to create common recurrence patterns
 */
export const RecurrencePatterns = {
  daily: (): RecurrenceRule => ({
    frequency: 'daily'
  }),

  weekdays: (): RecurrenceRule => ({
    frequency: 'weekly',
    daysOfWeek: [0, 1, 2, 3, 4] // Monday-Friday
  }),

  weekly: (dayOfWeek?: number): RecurrenceRule => ({
    frequency: 'weekly',
    daysOfWeek: dayOfWeek !== undefined ? [dayOfWeek] : undefined
  }),

  biweekly: (dayOfWeek?: number): RecurrenceRule => ({
    frequency: 'weekly',
    interval: 2,
    daysOfWeek: dayOfWeek !== undefined ? [dayOfWeek] : undefined
  }),

  monthly: (dayOfMonth?: number): RecurrenceRule => ({
    frequency: 'monthly',
    dayOfMonth: dayOfMonth
  }),

  yearly: (): RecurrenceRule => ({
    frequency: 'yearly'
  })
};

/**
 * Parse natural language recurrence from user input
 */
export function parseNaturalRecurrence(text: string): RecurrenceRule | null {
  const lowerText = text.toLowerCase();

  // Daily patterns
  if (/every\s*day|daily/.test(lowerText)) {
    return RecurrencePatterns.daily();
  }

  // Weekday patterns
  if (/every\s*weekday|weekdays|monday\s*(?:through|to|-)\s*friday/.test(lowerText)) {
    return RecurrencePatterns.weekdays();
  }

  // Weekly patterns with specific days
  const weeklyMatch = lowerText.match(/every\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);
  if (weeklyMatch) {
    const dayMap: Record<string, number> = {
      monday: 0, tuesday: 1, wednesday: 2, thursday: 3,
      friday: 4, saturday: 5, sunday: 6
    };
    return RecurrencePatterns.weekly(dayMap[weeklyMatch[1].toLowerCase()]);
  }

  // Biweekly patterns
  if (/every\s*(other|2)\s*week|bi-?weekly/.test(lowerText)) {
    return RecurrencePatterns.biweekly();
  }

  // Weekly (generic)
  if (/every\s*week|weekly/.test(lowerText)) {
    return RecurrencePatterns.weekly();
  }

  // Monthly patterns
  if (/every\s*month|monthly/.test(lowerText)) {
    return RecurrencePatterns.monthly();
  }

  // Yearly patterns
  if (/every\s*year|yearly|annually/.test(lowerText)) {
    return RecurrencePatterns.yearly();
  }

  return null;
}

/**
 * Get a human-readable description of a recurrence rule
 */
export function describeRecurrence(rule: RecurrenceRule): string {
  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  let description = '';

  switch (rule.frequency) {
    case 'daily':
      description = rule.interval && rule.interval > 1
        ? `Every ${rule.interval} days`
        : 'Daily';
      break;

    case 'weekly':
      if (rule.daysOfWeek && rule.daysOfWeek.length > 0) {
        if (rule.daysOfWeek.length === 5 &&
            rule.daysOfWeek.every(d => d >= 0 && d <= 4)) {
          description = 'Every weekday';
        } else {
          const days = rule.daysOfWeek.map(d => dayNames[d]).join(', ');
          description = rule.interval && rule.interval > 1
            ? `Every ${rule.interval} weeks on ${days}`
            : `Every ${days}`;
        }
      } else {
        description = rule.interval && rule.interval > 1
          ? `Every ${rule.interval} weeks`
          : 'Weekly';
      }
      break;

    case 'monthly':
      if (rule.dayOfMonth) {
        description = rule.interval && rule.interval > 1
          ? `Every ${rule.interval} months on the ${ordinal(rule.dayOfMonth)}`
          : `Monthly on the ${ordinal(rule.dayOfMonth)}`;
      } else {
        description = rule.interval && rule.interval > 1
          ? `Every ${rule.interval} months`
          : 'Monthly';
      }
      break;

    case 'yearly':
      description = rule.interval && rule.interval > 1
        ? `Every ${rule.interval} years`
        : 'Yearly';
      break;
  }

  if (rule.endDate) {
    const endDate = new Date(rule.endDate);
    description += ` until ${endDate.toLocaleDateString()}`;
  } else if (rule.count) {
    description += ` (${rule.count} times)`;
  }

  return description;
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
