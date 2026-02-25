/**
 * Maps Windows timezone names (used by Microsoft Graph API) to IANA timezone names.
 * Covers the ~40 most commonly encountered timezones.
 */
const WINDOWS_TO_IANA: Record<string, string> = {
  'UTC': 'UTC',
  'GMT Standard Time': 'Europe/London',
  'Greenwich Standard Time': 'Atlantic/Reykjavik',
  'W. Europe Standard Time': 'Europe/Berlin',
  'Central Europe Standard Time': 'Europe/Budapest',
  'Romance Standard Time': 'Europe/Paris',
  'Central European Standard Time': 'Europe/Warsaw',
  'E. Europe Standard Time': 'Europe/Chisinau',
  'FLE Standard Time': 'Europe/Kiev',
  'GTB Standard Time': 'Europe/Bucharest',
  'Russian Standard Time': 'Europe/Moscow',
  'Turkey Standard Time': 'Europe/Istanbul',
  'Israel Standard Time': 'Asia/Jerusalem',
  'South Africa Standard Time': 'Africa/Johannesburg',
  'Arab Standard Time': 'Asia/Riyadh',
  'Arabian Standard Time': 'Asia/Dubai',
  'India Standard Time': 'Asia/Kolkata',
  'Sri Lanka Standard Time': 'Asia/Colombo',
  'China Standard Time': 'Asia/Shanghai',
  'Singapore Standard Time': 'Asia/Singapore',
  'Taipei Standard Time': 'Asia/Taipei',
  'Tokyo Standard Time': 'Asia/Tokyo',
  'Korea Standard Time': 'Asia/Seoul',
  'AUS Eastern Standard Time': 'Australia/Sydney',
  'E. Australia Standard Time': 'Australia/Brisbane',
  'Cen. Australia Standard Time': 'Australia/Adelaide',
  'W. Australia Standard Time': 'Australia/Perth',
  'New Zealand Standard Time': 'Pacific/Auckland',
  'Hawaiian Standard Time': 'Pacific/Honolulu',
  'Alaskan Standard Time': 'America/Anchorage',
  'Pacific Standard Time': 'America/Los_Angeles',
  'US Mountain Standard Time': 'America/Phoenix',
  'Mountain Standard Time': 'America/Denver',
  'Central Standard Time': 'America/Chicago',
  'Canada Central Standard Time': 'America/Regina',
  'Eastern Standard Time': 'America/New_York',
  'US Eastern Standard Time': 'America/Indianapolis',
  'Atlantic Standard Time': 'America/Halifax',
  'Newfoundland Standard Time': 'America/St_Johns',
  'SA Pacific Standard Time': 'America/Bogota',
  'SA Eastern Standard Time': 'America/Cayenne',
  'E. South America Standard Time': 'America/Sao_Paulo',
  'Central America Standard Time': 'America/Guatemala',
  'Mexico Standard Time': 'America/Mexico_City',
  'SA Western Standard Time': 'America/La_Paz',
  'Venezuela Standard Time': 'America/Caracas',
  'Argentina Standard Time': 'America/Buenos_Aires',
  'Samoa Standard Time': 'Pacific/Apia',
  'Fiji Standard Time': 'Pacific/Fiji',
  'Tonga Standard Time': 'Pacific/Tongatapu',
  'Bangladesh Standard Time': 'Asia/Dhaka',
  'SE Asia Standard Time': 'Asia/Bangkok',
  'Myanmar Standard Time': 'Asia/Yangon',
  'Nepal Standard Time': 'Asia/Kathmandu',
  'Pakistan Standard Time': 'Asia/Karachi',
  'Afghanistan Standard Time': 'Asia/Kabul',
};

/**
 * Convert a Windows timezone name to an IANA timezone name.
 * Returns the input as-is if it looks like it's already IANA format (contains '/').
 * Falls back to UTC for unknown Windows timezone names.
 */
export function windowsToIana(windowsTz: string): string {
  if (!windowsTz) return 'UTC';

  // Already IANA format
  if (windowsTz.includes('/')) return windowsTz;

  return WINDOWS_TO_IANA[windowsTz] || 'UTC';
}
