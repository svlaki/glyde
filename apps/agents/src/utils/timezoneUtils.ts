/**
 * Timezone utility functions for converting between UTC and user's local time
 * Uses hardcoded offsets for common timezones to avoid dependency on complex timezone libraries
 */

// Hardcoded timezone offset map (in hours from UTC)
// Note: These are standard time offsets. DST handling is simplified for common US timezones
const TIMEZONE_OFFSETS: Record<string, { standard: number; dst: number; dstStart?: string; dstEnd?: string }> = {
  // US Timezones
  'America/New_York': { standard: -5, dst: -4, dstStart: '03-13', dstEnd: '11-06' },      // EST/EDT
  'America/Chicago': { standard: -6, dst: -5, dstStart: '03-13', dstEnd: '11-06' },       // CST/CDT  
  'America/Denver': { standard: -7, dst: -6, dstStart: '03-13', dstEnd: '11-06' },        // MST/MDT
  'America/Los_Angeles': { standard: -8, dst: -7, dstStart: '03-13', dstEnd: '11-06' },   // PST/PDT
  
  // Other common timezones
  'UTC': { standard: 0, dst: 0 },
  'Europe/London': { standard: 0, dst: 1, dstStart: '03-27', dstEnd: '10-30' },           // GMT/BST
  'Europe/Berlin': { standard: 1, dst: 2, dstStart: '03-27', dstEnd: '10-30' },           // CET/CEST
  'Asia/Tokyo': { standard: 9, dst: 9 },                                                  // JST (no DST)
  'Australia/Sydney': { standard: 10, dst: 11, dstStart: '10-01', dstEnd: '04-01' },     // AEST/AEDT
};

/**
 * Check if a date falls within daylight saving time for a given timezone
 * Simplified DST logic - assumes second Sunday in March to first Sunday in November for US
 */
function isDST(date: Date, timezone: string): boolean {
  const tzInfo = TIMEZONE_OFFSETS[timezone];
  if (!tzInfo || !tzInfo.dstStart || !tzInfo.dstEnd) {
    return false; // No DST for this timezone
  }

  const year = date.getFullYear();
  const month = date.getMonth() + 1; // getMonth() is 0-based
  const day = date.getDate();
  
  const [dstStartMonth, dstStartDay] = tzInfo.dstStart.split('-').map(Number);
  const [dstEndMonth, dstEndDay] = tzInfo.dstEnd.split('-').map(Number);
  
  // Simple month-based DST check (not perfectly accurate but good enough)
  if (month > dstStartMonth && month < dstEndMonth) {
    return true;
  } else if (month === dstStartMonth && day >= dstStartDay) {
    return true;
  } else if (month === dstEndMonth && day < dstEndDay) {
    return true;
  }
  
  return false;
}

/**
 * Get the current offset for a timezone (accounting for DST)
 */
export function getTimezoneOffset(timezone: string, date: Date = new Date()): number {
  const tzInfo = TIMEZONE_OFFSETS[timezone];
  if (!tzInfo) {
    console.warn(`Unknown timezone: ${timezone}, defaulting to UTC`);
    return 0;
  }
  
  return isDST(date, timezone) ? tzInfo.dst : tzInfo.standard;
}

/**
 * Convert a UTC time string to user's local time for display
 * @param utcTimeString - ISO string in UTC (e.g., "2025-09-01T13:00:00.000Z")
 * @param timezone - User's timezone (e.g., "America/New_York")
 * @returns ISO string adjusted to local time (but still in ISO format for consistency)
 */
export function convertFromUTC(utcTimeString: string, timezone: string = 'America/New_York'): string {
  if (!utcTimeString) return utcTimeString;
  
  const utcDate = new Date(utcTimeString);
  const offsetHours = getTimezoneOffset(timezone, utcDate);
  
  // Convert to local time by adding the timezone offset
  const localDate = new Date(utcDate.getTime() + (offsetHours * 60 * 60 * 1000));
  
  console.log(`🌍 [TIMEZONE UTILS] Converting UTC "${utcTimeString}" → Local "${localDate.toISOString()}" (${timezone}, offset: ${offsetHours}h)`);
  return localDate.toISOString();
}

/**
 * Convert user's local time to UTC for storage in database
 * @param localTimeString - Time string in user's local timezone
 * @param timezone - User's timezone (e.g., "America/New_York") 
 * @returns ISO string in UTC
 */
export function convertToUTC(localTimeString: string, timezone: string = 'America/New_York'): string {
  if (!localTimeString) return localTimeString;
  
  // If already has timezone info, return as-is
  if (localTimeString.includes('Z') || localTimeString.includes('+') || localTimeString.includes('-', 19)) {
    return localTimeString;
  }
  
  // Parse as local time
  let localDate: Date;
  if (localTimeString.endsWith('.000Z')) {
    // Handle agent-generated timestamps - remove Z and treat as local
    localDate = new Date(localTimeString.replace('.000Z', ''));
  } else {
    localDate = new Date(localTimeString);
  }
  
  const offsetHours = getTimezoneOffset(timezone, localDate);
  
  // Convert to UTC by subtracting the timezone offset
  const utcDate = new Date(localDate.getTime() - (offsetHours * 60 * 60 * 1000));
  
  console.log(`🌍 [TIMEZONE UTILS] Converting Local "${localTimeString}" → UTC "${utcDate.toISOString()}" (${timezone}, offset: ${offsetHours}h)`);
  return utcDate.toISOString();
}

/**
 * Format a UTC time for display in user's timezone
 * @param utcTimeString - UTC time string
 * @param timezone - User's timezone
 * @param options - Intl.DateTimeFormat options
 * @returns Formatted time string
 */
export function formatTimeForUser(
  utcTimeString: string, 
  timezone: string = 'America/New_York',
  options: Intl.DateTimeFormatOptions = {}
): string {
  if (!utcTimeString) return utcTimeString;
  
  const localTime = convertFromUTC(utcTimeString, timezone);
  const date = new Date(localTime);
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    ...options
  };
  
  return new Intl.DateTimeFormat('en-US', defaultOptions).format(date);
}

/**
 * Get current time in user's timezone
 * @param timezone - User's timezone
 * @returns Current time formatted for display
 */
export function getCurrentTimeInTimezone(timezone: string = 'America/New_York'): string {
  const now = new Date();
  const offsetHours = getTimezoneOffset(timezone, now);
  const localTime = new Date(now.getTime() + (offsetHours * 60 * 60 * 1000));
  
  return localTime.toLocaleString('en-US', {
    weekday: 'long',
    month: 'long', 
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Check if a timezone is valid/supported
 */
export function isValidTimezone(timezone: string): boolean {
  return timezone in TIMEZONE_OFFSETS;
}

/**
 * Get all supported timezones
 */
export function getSupportedTimezones(): string[] {
  return Object.keys(TIMEZONE_OFFSETS);
}