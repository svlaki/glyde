/**
 * Timezone utility functions using date-fns-tz for accurate timezone handling
 */
import { format, toDate } from 'date-fns';
import { toZonedTime, fromZonedTime, formatInTimeZone } from 'date-fns-tz';

/**
 * Convert user's local time to UTC for storage in database
 * @param localTimeString - Time string in user's local timezone
 * @param timezone - User's timezone (REQUIRED - e.g., "America/Chicago")
 * @returns ISO string in UTC
 */
export function convertToUTC(localTimeString: string, timezone: string): string {
  if (!localTimeString) return localTimeString;
  if (!timezone) throw new Error('Timezone is required for convertToUTC');

  // If already has timezone info (Z or +/-), parse as UTC
  if (localTimeString.includes('Z') || /[+-]\d{2}:\d{2}$/.test(localTimeString)) {
    return toDate(localTimeString).toISOString();
  }

  // Validate the date string before conversion — catch impossible dates like Feb 29 in non-leap years
  const parsed = new Date(localTimeString);
  if (isNaN(parsed.getTime())) {
    throw new Error(`Invalid date: "${localTimeString}". Check for impossible dates (e.g. Feb 29 in a non-leap year).`);
  }

  // Otherwise, treat as local time in the specified timezone and convert to UTC
  const utcDate = fromZonedTime(localTimeString, timezone);

  console.log(`[TIMEZONE UTILS] Converting Local "${localTimeString}" → UTC "${utcDate.toISOString()}" (${timezone})`);
  return utcDate.toISOString();
}

/**
 * Format a UTC time for display in user's timezone
 * @param utcTimeString - UTC time string
 * @param timezone - User's timezone (REQUIRED - e.g., "America/Chicago")
 * @param formatString - date-fns format string (default: 'h:mm a')
 * @returns Formatted time string
 */
export function formatTimeForUser(
  utcTimeString: string,
  timezone: string,
  formatString: string = 'h:mm a'
): string {
  if (!utcTimeString) return '';
  if (!timezone) throw new Error('Timezone is required for formatTimeForUser');

  return formatInTimeZone(toDate(utcTimeString), timezone, formatString);
}

/**
 * Format UTC event time for agent display
 * @param utcTimeString - UTC time string from database
 * @param timezone - User's timezone (REQUIRED)
 * @returns Formatted string like "Fri, Oct 4 at 4:45 PM"
 */
export function formatEventTime(utcTimeString: string, timezone: string): string {
  if (!utcTimeString) return '';
  if (!timezone) throw new Error('Timezone is required for formatEventTime');

  const date = toDate(utcTimeString);
  const dateStr = formatInTimeZone(date, timezone, 'EEE, MMM d');
  const timeStr = formatInTimeZone(date, timezone, 'h:mm a');

  return `${dateStr} at ${timeStr}`;
}

/**
 * Get current time in user's timezone
 * @param timezone - User's timezone (REQUIRED)
 * @returns Current time formatted for display
 */
export function getCurrentTimeInTimezone(timezone: string): string {
  if (!timezone) throw new Error('Timezone is required for getCurrentTimeInTimezone');
  const now = new Date();

  return formatInTimeZone(now, timezone, 'EEEE, MMMM d, yyyy h:mm a zzz');
}

/**
 * Check if a timezone is valid/supported
 * This is a simple check - date-fns-tz will throw if timezone is invalid
 */
export function isValidTimezone(timezone: string): boolean {
  try {
    formatInTimeZone(new Date(), timezone, 'z');
    return true;
  } catch {
    return false;
  }
}

/**
 * Get common US timezones
 */
export function getSupportedTimezones(): string[] {
  return [
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Phoenix',
    'America/Anchorage',
    'Pacific/Honolulu',
    'UTC'
  ];
}
