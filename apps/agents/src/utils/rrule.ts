import pkg from 'rrule';
const { RRuleSet, RRule, rrulestr } = pkg;
import * as chrono from 'chrono-node';

/**
 * Recurrence configuration that can be converted to/from RRULE
 */
export interface RecurrenceConfig {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  interval?: number;
  byweekday?: (0 | 1 | 2 | 3 | 4 | 5 | 6)[]; // 0=Sunday, 1=Monday, etc.
  bymonthday?: number[];
  bymonth?: number[];
  count?: number;
  until?: Date;
}

/**
 * Parse natural language recurrence pattern to RRULE format
 * Examples:
 *   "every Monday at 10am" -> "FREQ=WEEKLY;BYDAY=MO"
 *   "daily for 30 days" -> "FREQ=DAILY;COUNT=30"
 *   "every 2 weeks on Tuesday and Thursday" -> "FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,TH"
 */
export function parseNaturalLanguageRecurrence(
  text: string,
  baseDate: Date = new Date()
): { rrule: string; nextOccurrence: Date } | null {
  try {
    // Use chrono-node to find date/time patterns
    const results = chrono.parse(text, baseDate);

    if (results.length === 0) {
      return null;
    }

    // Try to extract recurrence pattern from text
    const lowerText = text.toLowerCase();

    // Default to weekly if specific pattern not found
    let freq = 'WEEKLY';
    let interval = 1;
    let byweekday: string[] = [];
    let count: number | undefined;
    let until: Date | undefined;

    // Check frequency
    if (lowerText.includes('daily') || lowerText.includes('every day')) {
      freq = 'DAILY';
    } else if (lowerText.includes('weekly') || lowerText.includes('every week')) {
      freq = 'WEEKLY';
    } else if (lowerText.includes('monthly') || lowerText.includes('every month')) {
      freq = 'MONTHLY';
    } else if (lowerText.includes('yearly') || lowerText.includes('annually') || lowerText.includes('every year')) {
      freq = 'YEARLY';
    }

    // Check for interval (e.g., "every 2 weeks")
    const intervalMatch = text.match(/every\s+(\d+)\s+(day|week|month|year)/i);
    if (intervalMatch) {
      interval = parseInt(intervalMatch[1], 10);
    }

    // Extract weekdays
    const dayNames: { [key: string]: string } = {
      sunday: 'SU', sunday_: 'SU',
      monday: 'MO', mon: 'MO', 'mon.': 'MO',
      tuesday: 'TU', tue: 'TU', 'tue.': 'TU',
      wednesday: 'WE', wed: 'WE', 'wed.': 'WE',
      thursday: 'TH', thu: 'TH', 'thu.': 'TH',
      friday: 'FR', fri: 'FR', 'fri.': 'FR',
      saturday: 'SA', sat: 'SA', 'sat.': 'SA'
    };

    for (const [day, abbrev] of Object.entries(dayNames)) {
      if (lowerText.includes(day)) {
        byweekday.push(abbrev);
      }
    }

    // Extract duration (e.g., "for 30 days", "for 12 weeks")
    const durationMatch = text.match(/for\s+(\d+)\s+(day|week|month|year)s?/i);
    if (durationMatch) {
      const num = parseInt(durationMatch[1], 10);
      const unit = durationMatch[2].toLowerCase();
      count = num; // Simplified: just use the number as count

      // If we have a unit, we could convert to actual end date, but for now keep simple
    }

    // Extract until date (e.g., "until December 31")
    const untilMatch = text.match(/until\s+([a-zA-Z\s\d,]+)(?:\s|$)/i);
    if (untilMatch) {
      const untilResults = chrono.parse(untilMatch[1], baseDate);
      if (untilResults.length > 0) {
        until = untilResults[0].start?.date();
      }
    }

    // Build RRULE string
    let rruleStr = `FREQ=${freq}`;

    if (interval > 1) {
      rruleStr += `;INTERVAL=${interval}`;
    }

    if (byweekday.length > 0) {
      rruleStr += `;BYDAY=${byweekday.join(',')}`;
    }

    if (count) {
      rruleStr += `;COUNT=${count}`;
    }

    if (until) {
      rruleStr += `;UNTIL=${until.toISOString().split('T')[0].replace(/-/g, '')}`;
    }

    // Validate the RRULE
    if (!validateRRule(rruleStr)) {
      return null;
    }

    // Get next occurrence
    const nextOccurrence = getNextOccurrence(rruleStr, baseDate) || baseDate;

    return {
      rrule: rruleStr,
      nextOccurrence
    };
  } catch (error) {
    console.error('❌ [RRule] Error parsing natural language recurrence:', error);
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
  } catch (error) {
    console.error('❌ [RRule] Invalid RRULE format:', rrule, error);
    return false;
  }
}

/**
 * Expand RRULE into individual date instances
 * @param rrule RFC 5545 RRULE string
 * @param startTime ISO 8601 start time for the first occurrence
 * @param endDate End date for expansion (defaults to 1 year from start)
 * @param limit Maximum number of occurrences to generate
 */
export function expandRecurrence(
  rrule: string,
  startTime: Date,
  endDate?: Date,
  limit: number = 365
): Date[] {
  try {
    if (!validateRRule(rrule)) {
      console.warn('⚠️  [RRule] Invalid RRULE, returning empty list:', rrule);
      return [];
    }

    // Default end date to 1 year from start
    const expandEndDate = endDate || new Date(startTime.getTime() + 365 * 24 * 60 * 60 * 1000);

    // Parse RRULE
    const rule = rrulestr(rrule, { dtstart: startTime });

    // Generate occurrences
    const occurrences = rule.between(startTime, expandEndDate, true);

    // Apply limit
    return occurrences.slice(0, limit);
  } catch (error) {
    console.error('❌ [RRule] Error expanding recurrence:', error);
    return [];
  }
}

/**
 * Expand RRULE with custom start/end times for each occurrence
 * @param rrule RFC 5545 RRULE string
 * @param startTime ISO 8601 start time for the first occurrence
 * @param endTime ISO 8601 end time (duration will be preserved across occurrences)
 * @param expandUntil End date for expansion
 */
export function expandRecurrenceWithEndTime(
  rrule: string,
  startTime: Date,
  endTime: Date,
  expandUntil?: Date
): Array<{ start: Date; end: Date }> {
  try {
    const duration = endTime.getTime() - startTime.getTime();
    const startDates = expandRecurrence(rrule, startTime, expandUntil);

    return startDates.map(start => ({
      start,
      end: new Date(start.getTime() + duration)
    }));
  } catch (error) {
    console.error('❌ [RRule] Error expanding recurrence with end times:', error);
    return [];
  }
}

/**
 * Get the next occurrence after a given date
 */
export function getNextOccurrence(rrule: string, after: Date): Date | null {
  try {
    const rule = rrulestr(rrule, { dtstart: after });
    const nextDate = rule.after(after, true);
    return nextDate;
  } catch (error) {
    console.error('❌ [RRule] Error getting next occurrence:', error);
    return null;
  }
}

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
    console.error('❌ [RRule] Error formatting RRULE:', error);
    return rrule;
  }
}

/**
 * Parse RRULE string into components (for display/editing)
 */
export function parseRRule(rrule: string): RecurrenceConfig | null {
  try {
    const parts = rrule.split(';');
    const params: { [key: string]: string } = {};

    for (const part of parts) {
      const [key, value] = part.split('=');
      if (key && value) {
        params[key] = value;
      }
    }

    const config: RecurrenceConfig = {
      freq: (params.FREQ as any) || 'DAILY'
    };

    if (params.INTERVAL) {
      config.interval = parseInt(params.INTERVAL, 10);
    }

    if (params.BYDAY) {
      const dayMap: { [key: string]: 0 | 1 | 2 | 3 | 4 | 5 | 6 } = {
        SU: 0,
        MO: 1,
        TU: 2,
        WE: 3,
        TH: 4,
        FR: 5,
        SA: 6
      };
      config.byweekday = params.BYDAY.split(',')
        .map(d => dayMap[d])
        .filter(d => d !== undefined) as (0 | 1 | 2 | 3 | 4 | 5 | 6)[];
    }

    if (params.BYMONTHDAY) {
      config.bymonthday = params.BYMONTHDAY.split(',').map(d => parseInt(d, 10));
    }

    if (params.BYMONTH) {
      config.bymonth = params.BYMONTH.split(',').map(m => parseInt(m, 10));
    }

    if (params.COUNT) {
      config.count = parseInt(params.COUNT, 10);
    }

    if (params.UNTIL) {
      const dateStr = params.UNTIL.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
      config.until = new Date(dateStr);
    }

    return config;
  } catch (error) {
    console.error('❌ [RRule] Error parsing RRULE:', error);
    return null;
  }
}

/**
 * Build RRULE string from configuration
 */
export function buildRRule(config: RecurrenceConfig): string {
  let rrule = `FREQ=${config.freq}`;

  if (config.interval && config.interval > 1) {
    rrule += `;INTERVAL=${config.interval}`;
  }

  if (config.byweekday && config.byweekday.length > 0) {
    const dayMap: { [key: number]: string } = {
      0: 'SU',
      1: 'MO',
      2: 'TU',
      3: 'WE',
      4: 'TH',
      5: 'FR',
      6: 'SA'
    };
    const days = config.byweekday.map(d => dayMap[d]).join(',');
    rrule += `;BYDAY=${days}`;
  }

  if (config.bymonthday && config.bymonthday.length > 0) {
    rrule += `;BYMONTHDAY=${config.bymonthday.join(',')}`;
  }

  if (config.bymonth && config.bymonth.length > 0) {
    rrule += `;BYMONTH=${config.bymonth.join(',')}`;
  }

  if (config.count) {
    rrule += `;COUNT=${config.count}`;
  }

  if (config.until) {
    const dateStr = config.until.toISOString().split('T')[0].replace(/-/g, '');
    rrule += `;UNTIL=${dateStr}`;
  }

  return rrule;
}
