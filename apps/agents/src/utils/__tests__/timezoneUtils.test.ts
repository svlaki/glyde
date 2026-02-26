import {
  convertToUTC,
  formatTimeForUser,
  formatEventTime,
  isValidTimezone,
  getSupportedTimezones,
} from '../../utils/timezoneUtils.js';

// ---------------------------------------------------------------------------
// convertToUTC
// ---------------------------------------------------------------------------

describe('convertToUTC', () => {
  it('converts local time to UTC using the given timezone', () => {
    // 2:00 PM Central (UTC-6) -> 8:00 PM UTC
    const result = convertToUTC('2026-02-26T14:00:00', 'America/Chicago');
    expect(result).toContain('2026-02-26T20:00:00');
    expect(result).toMatch(/Z$/);
  });

  it('parses already-UTC input with Z suffix', () => {
    const result = convertToUTC('2026-02-26T20:00:00Z', 'America/Chicago');
    expect(result).toContain('2026-02-26T20:00:00');
    expect(result).toMatch(/Z$/);
  });

  it('parses already-UTC input with offset notation', () => {
    const result = convertToUTC('2026-02-26T14:00:00-06:00', 'America/Chicago');
    expect(result).toContain('2026-02-26T20:00:00');
    expect(result).toMatch(/Z$/);
  });

  it('returns empty string as-is when input is empty', () => {
    const result = convertToUTC('', 'America/Chicago');
    expect(result).toBe('');
  });

  it('throws when timezone is missing', () => {
    expect(() => convertToUTC('2026-02-26T14:00:00', '')).toThrow(
      'Timezone is required'
    );
  });
});

// ---------------------------------------------------------------------------
// formatTimeForUser
// ---------------------------------------------------------------------------

describe('formatTimeForUser', () => {
  it('formats a UTC time for the user timezone with default format', () => {
    // 8:00 PM UTC -> 2:00 PM Central
    const result = formatTimeForUser('2026-02-26T20:00:00Z', 'America/Chicago');
    expect(result).toBe('2:00 PM');
  });

  it('returns empty string when input is empty', () => {
    const result = formatTimeForUser('', 'America/Chicago');
    expect(result).toBe('');
  });

  it('accepts a custom format string', () => {
    const result = formatTimeForUser(
      '2026-02-26T20:00:00Z',
      'America/Chicago',
      'HH:mm'
    );
    expect(result).toBe('14:00');
  });

  it('throws when timezone is missing', () => {
    expect(() => formatTimeForUser('2026-02-26T20:00:00Z', '')).toThrow(
      'Timezone is required'
    );
  });
});

// ---------------------------------------------------------------------------
// formatEventTime
// ---------------------------------------------------------------------------

describe('formatEventTime', () => {
  it('formats like "Day, Mon D at H:MM AM/PM"', () => {
    const result = formatEventTime('2026-02-26T20:00:00Z', 'America/Chicago');
    // 8:00 PM UTC -> 2:00 PM Central on Thu, Feb 26
    expect(result).toMatch(/Thu, Feb 26 at 2:00 PM/);
  });

  it('returns empty string when input is empty', () => {
    expect(formatEventTime('', 'America/Chicago')).toBe('');
  });

  it('throws when timezone is missing', () => {
    expect(() => formatEventTime('2026-02-26T20:00:00Z', '')).toThrow(
      'Timezone is required'
    );
  });
});

// ---------------------------------------------------------------------------
// isValidTimezone
// ---------------------------------------------------------------------------

describe('isValidTimezone', () => {
  it('returns true for a valid IANA timezone', () => {
    expect(isValidTimezone('America/Chicago')).toBe(true);
    expect(isValidTimezone('America/New_York')).toBe(true);
    expect(isValidTimezone('UTC')).toBe(true);
  });

  it('returns false for an invalid timezone', () => {
    expect(isValidTimezone('Not/A_Timezone')).toBe(false);
    expect(isValidTimezone('foobar')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getSupportedTimezones
// ---------------------------------------------------------------------------

describe('getSupportedTimezones', () => {
  it('returns an array containing expected US timezones', () => {
    const timezones = getSupportedTimezones();
    expect(Array.isArray(timezones)).toBe(true);
    expect(timezones).toContain('America/New_York');
    expect(timezones).toContain('America/Chicago');
    expect(timezones).toContain('America/Denver');
    expect(timezones).toContain('America/Los_Angeles');
    expect(timezones).toContain('UTC');
  });
});
