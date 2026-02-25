/**
 * Converts Microsoft Graph recurrence patterns to RFC 5545 RRULE strings.
 *
 * Microsoft Graph uses a structured object format for recurrence:
 *   { pattern: { type, interval, daysOfWeek, ... }, range: { type, endDate, numberOfOccurrences, ... } }
 *
 * This module converts that to standard RRULE format used internally.
 */

interface MicrosoftRecurrencePattern {
  type: 'daily' | 'weekly' | 'absoluteMonthly' | 'relativeMonthly' | 'absoluteYearly' | 'relativeYearly';
  interval: number;
  daysOfWeek?: string[];
  dayOfMonth?: number;
  month?: number;
  index?: 'first' | 'second' | 'third' | 'fourth' | 'last';
  firstDayOfWeek?: string;
}

interface MicrosoftRecurrenceRange {
  type: 'endDate' | 'noEnd' | 'numbered';
  startDate?: string;
  endDate?: string;
  numberOfOccurrences?: number;
  recurrenceTimeZone?: string;
}

export interface MicrosoftRecurrence {
  pattern: MicrosoftRecurrencePattern;
  range: MicrosoftRecurrenceRange;
}

const DAY_MAP: Record<string, string> = {
  sunday: 'SU',
  monday: 'MO',
  tuesday: 'TU',
  wednesday: 'WE',
  thursday: 'TH',
  friday: 'FR',
  saturday: 'SA',
};

const INDEX_MAP: Record<string, string> = {
  first: '1',
  second: '2',
  third: '3',
  fourth: '4',
  last: '-1',
};

/**
 * Convert a Microsoft Graph recurrence object to an RRULE string.
 * Returns null if the recurrence cannot be converted.
 */
export function microsoftRecurrenceToRRule(recurrence: MicrosoftRecurrence): string | null {
  if (!recurrence?.pattern?.type) return null;

  const { pattern, range } = recurrence;
  const parts: string[] = [];

  // FREQ
  switch (pattern.type) {
    case 'daily':
      parts.push('FREQ=DAILY');
      break;
    case 'weekly':
      parts.push('FREQ=WEEKLY');
      break;
    case 'absoluteMonthly':
    case 'relativeMonthly':
      parts.push('FREQ=MONTHLY');
      break;
    case 'absoluteYearly':
    case 'relativeYearly':
      parts.push('FREQ=YEARLY');
      break;
    default:
      return null;
  }

  // INTERVAL
  if (pattern.interval && pattern.interval > 1) {
    parts.push(`INTERVAL=${pattern.interval}`);
  }

  // BYDAY (weekly or relative patterns)
  if (pattern.daysOfWeek && pattern.daysOfWeek.length > 0) {
    const rruleDays = pattern.daysOfWeek
      .map(d => DAY_MAP[d.toLowerCase()])
      .filter(Boolean);

    if (rruleDays.length > 0) {
      if ((pattern.type === 'relativeMonthly' || pattern.type === 'relativeYearly') && pattern.index) {
        // For relative patterns, prefix the day with the week number
        const weekNum = INDEX_MAP[pattern.index] || '1';
        const prefixedDays = rruleDays.map(d => `${weekNum}${d}`);
        parts.push(`BYDAY=${prefixedDays.join(',')}`);
      } else {
        parts.push(`BYDAY=${rruleDays.join(',')}`);
      }
    }
  }

  // BYMONTHDAY (absoluteMonthly)
  if (pattern.type === 'absoluteMonthly' && pattern.dayOfMonth) {
    parts.push(`BYMONTHDAY=${pattern.dayOfMonth}`);
  }

  // BYMONTH (yearly patterns)
  if ((pattern.type === 'absoluteYearly' || pattern.type === 'relativeYearly') && pattern.month) {
    parts.push(`BYMONTH=${pattern.month}`);
  }

  // BYMONTHDAY (absoluteYearly)
  if (pattern.type === 'absoluteYearly' && pattern.dayOfMonth) {
    parts.push(`BYMONTHDAY=${pattern.dayOfMonth}`);
  }

  // Range: UNTIL or COUNT
  if (range) {
    if (range.type === 'endDate' && range.endDate) {
      // Convert end date to RRULE UNTIL format (YYYYMMDD)
      const untilDate = range.endDate.replace(/-/g, '');
      parts.push(`UNTIL=${untilDate}T235959Z`);
    } else if (range.type === 'numbered' && range.numberOfOccurrences) {
      parts.push(`COUNT=${range.numberOfOccurrences}`);
    }
    // 'noEnd' = no UNTIL/COUNT needed
  }

  return parts.join(';');
}

/**
 * Strip HTML tags from a string (for Microsoft event body.content).
 * Returns plain text content.
 */
export function stripHtmlTags(html: string): string {
  if (!html) return '';

  return html
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Decode common HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Collapse multiple whitespace/newlines
    .replace(/\s+/g, ' ')
    .trim();
}
