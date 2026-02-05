/**
 * Timezone Context
 * Provides centralized timezone management for the frontend
 * - Fetches user timezone from profile
 * - Provides utility functions for timezone conversions
 * - Mirrors agent timezoneUtils.ts functionality
 */
import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { toDate } from 'date-fns';
import { toZonedTime, fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { useAuth } from './authContext';

const AGENT_SERVICE_URL = import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000';

interface TimezoneContextValue {
  /** User's timezone from profile (IANA format, e.g., "America/Chicago") */
  timezone: string;
  /** Whether timezone is currently being loaded */
  isLoading: boolean;
  /** Convert user's local time to UTC for storage in database */
  convertToUTC: (localTimeString: string) => string;
  /** Format a UTC time for display in user's timezone */
  formatTimeForUser: (utcTimeString: string, formatString?: string) => string;
  /** Format UTC event time for display (e.g., "Fri, Oct 4 at 4:45 PM") */
  formatEventTime: (utcTimeString: string) => string;
  /** Convert UTC to user's timezone as Date object */
  toUserTime: (utcTimeString: string) => Date;
  /** Get current time in user's timezone */
  getCurrentTime: () => string;
  /** Check if a timezone string is valid */
  isValidTimezone: (tz: string) => boolean;
  /** Refresh timezone from profile */
  refreshTimezone: () => Promise<void>;
}

const TimezoneContext = createContext<TimezoneContextValue | undefined>(undefined);

export function TimezoneProvider({ children }: { children: ReactNode }) {
  const { user, session } = useAuth();
  const [timezone, setTimezone] = useState<string>('America/New_York'); // Default
  const [isLoading, setIsLoading] = useState(true);

  const fetchTimezone = useCallback(async () => {
    if (!user || !session?.access_token) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch(`${AGENT_SERVICE_URL}/api/profile`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        console.error('Failed to fetch user timezone from profile');
        return;
      }

      const profile = await response.json();

      if (profile?.timezone) {
        setTimezone(profile.timezone);
        console.log(`[TimezoneContext] Loaded user timezone: ${profile.timezone}`);
      }
    } catch (error) {
      console.error('Error fetching timezone:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, session]);

  useEffect(() => {
    fetchTimezone();
  }, [fetchTimezone]);

  /**
   * Convert user's local time to UTC for storage in database
   */
  const convertToUTC = useCallback(
    (localTimeString: string): string => {
      if (!localTimeString) return localTimeString;

      // If already has timezone info (Z or +/-), parse as UTC
      if (localTimeString.includes('Z') || /[+-]\d{2}:\d{2}$/.test(localTimeString)) {
        return toDate(localTimeString).toISOString();
      }

      // Otherwise, treat as local time in the specified timezone and convert to UTC
      const utcDate = fromZonedTime(localTimeString, timezone);
      return utcDate.toISOString();
    },
    [timezone]
  );

  /**
   * Format a UTC time for display in user's timezone
   */
  const formatTimeForUser = useCallback(
    (utcTimeString: string, formatString: string = 'h:mm a'): string => {
      if (!utcTimeString) return '';
      return formatInTimeZone(toDate(utcTimeString), timezone, formatString);
    },
    [timezone]
  );

  /**
   * Format UTC event time for display
   */
  const formatEventTime = useCallback(
    (utcTimeString: string): string => {
      if (!utcTimeString) return '';

      const date = toDate(utcTimeString);
      const dateStr = formatInTimeZone(date, timezone, 'EEE, MMM d');
      const timeStr = formatInTimeZone(date, timezone, 'h:mm a');

      return `${dateStr} at ${timeStr}`;
    },
    [timezone]
  );

  /**
   * Convert UTC to user's timezone as Date object
   */
  const toUserTime = useCallback(
    (utcTimeString: string): Date => {
      if (!utcTimeString) return new Date();
      const date = typeof utcTimeString === 'string' ? new Date(utcTimeString) : utcTimeString;
      return toZonedTime(date, timezone);
    },
    [timezone]
  );

  /**
   * Get current time in user's timezone
   */
  const getCurrentTime = useCallback((): string => {
    const now = new Date();
    return formatInTimeZone(now, timezone, 'EEEE, MMMM d, yyyy h:mm a zzz');
  }, [timezone]);

  /**
   * Check if a timezone string is valid
   */
  const isValidTimezone = useCallback((tz: string): boolean => {
    try {
      formatInTimeZone(new Date(), tz, 'z');
      return true;
    } catch {
      return false;
    }
  }, []);

  const value: TimezoneContextValue = {
    timezone,
    isLoading,
    convertToUTC,
    formatTimeForUser,
    formatEventTime,
    toUserTime,
    getCurrentTime,
    isValidTimezone,
    refreshTimezone: fetchTimezone,
  };

  return <TimezoneContext.Provider value={value}>{children}</TimezoneContext.Provider>;
}

/**
 * Hook to access timezone context
 * Provides timezone value and utility functions
 *
 * @example
 * ```tsx
 * const { timezone, convertToUTC, formatTimeForUser, toUserTime } = useTimezone();
 *
 * // Convert local time to UTC for storage
 * const utcTime = convertToUTC('2025-11-05T14:00:00');
 *
 * // Format UTC time for display
 * const displayTime = formatTimeForUser(event.start_time);
 *
 * // Convert UTC to Date object in user's timezone
 * const localDate = toUserTime(event.start_time);
 * ```
 */
export function useTimezone() {
  const context = useContext(TimezoneContext);
  if (!context) {
    throw new Error('useTimezone must be used within a TimezoneProvider');
  }
  return context;
}
