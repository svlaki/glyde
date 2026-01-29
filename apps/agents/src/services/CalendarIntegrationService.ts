import ICAL from 'ical.js';
import { google } from 'googleapis';
import { Client } from '@microsoft/microsoft-graph-client';
import { getSupabaseService } from './SupabaseService.js';
import { OnboardingService } from './OnboardingService.js';
import { v4 as uuidv4 } from 'uuid';

interface CalendarEvent {
  title: string;
  start_time: string;
  end_time: string;
  description?: string;
  location?: string;
  recurrence_rule?: string | null;
  is_recurring?: boolean;
}

/**
 * Convert Microsoft Graph API recurrence pattern to RFC 5545 RRULE format
 */
function convertMicrosoftRecurrenceToRRule(recurrence: any): string | null {
  if (!recurrence?.pattern) return null;

  const pattern = recurrence.pattern;
  const range = recurrence.range;
  const parts: string[] = [];

  // Map Microsoft recurrence type to RRULE FREQ
  const freqMap: Record<string, string> = {
    daily: 'DAILY',
    weekly: 'WEEKLY',
    absoluteMonthly: 'MONTHLY',
    relativeMonthly: 'MONTHLY',
    absoluteYearly: 'YEARLY',
    relativeYearly: 'YEARLY'
  };

  const freq = freqMap[pattern.type];
  if (!freq) return null;

  parts.push(`FREQ=${freq}`);

  // Add interval if > 1
  if (pattern.interval && pattern.interval > 1) {
    parts.push(`INTERVAL=${pattern.interval}`);
  }

  // Add day of week for weekly recurrence
  if (pattern.daysOfWeek && pattern.daysOfWeek.length > 0) {
    const dayMap: Record<string, string> = {
      sunday: 'SU', monday: 'MO', tuesday: 'TU', wednesday: 'WE',
      thursday: 'TH', friday: 'FR', saturday: 'SA'
    };
    const days = pattern.daysOfWeek.map((d: string) => dayMap[d.toLowerCase()]).filter(Boolean);
    if (days.length > 0) {
      parts.push(`BYDAY=${days.join(',')}`);
    }
  }

  // Add day of month for monthly recurrence
  if (pattern.dayOfMonth) {
    parts.push(`BYMONTHDAY=${pattern.dayOfMonth}`);
  }

  // Add month for yearly recurrence
  if (pattern.month) {
    parts.push(`BYMONTH=${pattern.month}`);
  }

  // Add end condition from range
  if (range) {
    if (range.type === 'endDate' && range.endDate) {
      // Convert to RRULE UNTIL format (YYYYMMDD)
      const endDate = new Date(range.endDate);
      const until = endDate.toISOString().replace(/[-:]/g, '').split('T')[0];
      parts.push(`UNTIL=${until}`);
    } else if (range.type === 'numbered' && range.numberOfOccurrences) {
      parts.push(`COUNT=${range.numberOfOccurrences}`);
    }
  }

  return parts.join(';');
}

export class CalendarIntegrationService {
  /**
   * Parse .ics file and return events
   */
  static parseICSFile(fileBuffer: Buffer): CalendarEvent[] {
    const icsData = fileBuffer.toString('utf-8');
    const jcalData = ICAL.parse(icsData);
    const comp = new ICAL.Component(jcalData);
    const vevents = comp.getAllSubcomponents('vevent');

    const events: CalendarEvent[] = [];

    vevents.forEach((vevent) => {
      const event = new ICAL.Event(vevent);

      // Skip if event doesn't have a start time
      if (!event.startDate) return;

      const startDate = event.startDate.toJSDate();
      const endDate = event.endDate ? event.endDate.toJSDate() : new Date(startDate.getTime() + 3600000); // 1 hour default

      // Extract RRULE if present
      const rruleProp = vevent.getFirstProperty('rrule');
      let rruleString: string | null = null;
      if (rruleProp) {
        const rruleValue = rruleProp.getFirstValue();
        if (rruleValue) {
          // ICAL.js returns the RRULE as an object, convert to string
          rruleString = rruleValue.toString();
        }
      }

      events.push({
        title: event.summary || 'Untitled Event',
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        description: event.description || '',
        location: event.location || '',
        recurrence_rule: rruleString,
        is_recurring: !!rruleString
      });
    });

    return events;
  }

  /**
   * Import events into public.events table
   */
  static async importEvents(userId: string, events: CalendarEvent[]): Promise<number> {
    const supabase = getSupabaseService().getClient();

    // Only import events from last 3 months
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const recentEvents = events.filter(event =>
      new Date(event.start_time) >= threeMonthsAgo
    );

    if (recentEvents.length === 0) {
      return 0;
    }

    // Prepare events for insertion (map to public.events column names)
    const eventsToInsert = recentEvents.map(event => ({
      user_id: userId,
      title: event.event_title,
      start_time: event.event_starts_at,
      end_time: event.event_ends_at,
      description: event.event_description || null,
      location: event.event_location || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    // Insert events in batches of 100
    const batchSize = 100;
    let totalInserted = 0;

    for (let i = 0; i < eventsToInsert.length; i += batchSize) {
      const batch = eventsToInsert.slice(i, i + batchSize);

      const { error, count } = await supabase
        .from('events')
        .insert(batch);

      if (error) {
        continue;
      }

      totalInserted += count || batch.length;
    }

    return totalInserted;
  }

  /**
   * Get Google OAuth URL
   */
  static getGoogleAuthUrl(userId: string): string {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    console.log('Google OAuth Config:', {
      clientId: clientId ? `${clientId.substring(0, 20)}...` : 'MISSING',
      clientSecret: clientSecret ? 'SET' : 'MISSING',
      redirectUri: redirectUri || 'MISSING'
    });

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error(`Google OAuth not configured. Missing: ${!clientId ? 'GOOGLE_CLIENT_ID ' : ''}${!clientSecret ? 'GOOGLE_CLIENT_SECRET ' : ''}${!redirectUri ? 'GOOGLE_REDIRECT_URI' : ''}`);
    }

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    const scopes = ['https://www.googleapis.com/auth/calendar.readonly'];

    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: userId // Pass userId as state for callback
    });

    console.log('Generated Google OAuth URL:', url);
    return url;
  }

  /**
   * Handle Google OAuth callback and exchange code for token
   */
  static async handleGoogleCallback(code: string, state: string): Promise<string> {
    const userId = state; // state contains userId

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Store access token temporarily (in production, use secure storage)
    // For now, return it to be used immediately for import
    return tokens.access_token || '';
  }

  /**
   * Import events from Google Calendar
   */
  static async importGoogleEvents(userId: string, accessToken: string): Promise<CalendarEvent[]> {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({ access_token: accessToken });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Get events from last 3 months
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: threeMonthsAgo.toISOString(),
      timeMax: new Date().toISOString(),
      maxResults: 2500,
      singleEvents: false,  // Get parent recurring events with RRULE instead of expanded instances
      orderBy: 'updated'    // Can't use startTime when singleEvents is false
    });

    const googleEvents = response.data.items || [];

    const events: CalendarEvent[] = googleEvents.map(event => {
      // Extract RRULE from recurrence array (format: ["RRULE:FREQ=WEEKLY;BYDAY=MO", ...])
      const rrule = event.recurrence?.find(r => r.startsWith('RRULE:'))?.replace('RRULE:', '') || null;

      return {
        title: event.summary || 'Untitled Event',
        start_time: event.start?.dateTime || event.start?.date || new Date().toISOString(),
        end_time: event.end?.dateTime || event.end?.date || new Date().toISOString(),
        description: event.description || '',
        location: event.location || '',
        recurrence_rule: rrule,
        is_recurring: !!rrule
      };
    });

    return events;
  }

  /**
   * Get Microsoft OAuth URL
   */
  static getMicrosoftAuthUrl(userId: string): string {
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const redirectUri = process.env.MICROSOFT_REDIRECT_URI || '';

    // Debug logging
    console.log('Microsoft OAuth Config:', {
      clientId: clientId ? 'Set' : 'MISSING',
      redirectUri: redirectUri || 'MISSING',
      fullRedirectUri: redirectUri
    });

    if (!clientId || !redirectUri) {
      throw new Error('Microsoft OAuth not configured. Please set MICROSOFT_CLIENT_ID and MICROSOFT_REDIRECT_URI in .env file');
    }

    const scopes = encodeURIComponent('Calendars.Read offline_access');
    const encodedRedirectUri = encodeURIComponent(redirectUri);

    const url = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodedRedirectUri}&response_mode=query&scope=${scopes}&state=${userId}`;

    return url;
  }

  /**
   * Handle Microsoft OAuth callback
   */
  static async handleMicrosoftCallback(code: string, state: string): Promise<string> {
    const userId = state;

    // Exchange code for token
    const tokenEndpoint = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

    const params = new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID || '',
      scope: 'Calendars.Read offline_access',
      code: code,
      redirect_uri: process.env.MICROSOFT_REDIRECT_URI || '',
      grant_type: 'authorization_code',
      client_secret: process.env.MICROSOFT_CLIENT_SECRET || ''
    });

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    });

    const data = await response.json() as any;

    if (!response.ok) {
      throw new Error(`Failed to exchange code for token: ${data.error_description || 'Unknown error'}`);
    }

    return data.access_token || '';
  }

  /**
   * Import events from Microsoft Calendar
   */
  static async importMicrosoftEvents(userId: string, accessToken: string): Promise<CalendarEvent[]> {
    const client = Client.init({
      authProvider: (done) => {
        done(null, accessToken);
      }
    });

    // Get events from last 3 months
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const response = await client
      .api('/me/calendar/events')
      .filter(`start/dateTime ge '${threeMonthsAgo.toISOString()}'`)
      .select('subject,start,end,location,bodyPreview,recurrence')
      .top(2500)
      .get();

    const microsoftEvents = response.value || [];

    const events: CalendarEvent[] = microsoftEvents.map((event: any) => {
      // Convert Microsoft recurrence pattern to RRULE
      const rrule = event.recurrence ? convertMicrosoftRecurrenceToRRule(event.recurrence) : null;

      return {
        title: event.subject || 'Untitled Event',
        start_time: event.start?.dateTime || new Date().toISOString(),
        end_time: event.end?.dateTime || new Date().toISOString(),
        description: event.bodyPreview || '',
        location: event.location?.displayName || '',
        recurrence_rule: rrule,
        is_recurring: !!rrule
      };
    });

    return events;
  }

  /**
   * Complete calendar import flow (import events + update metadata)
   */
  static async completeCalendarImport(
    userId: string,
    source: 'google' | 'outlook' | 'ics',
    events: CalendarEvent[]
  ): Promise<{ eventCount: number; dateRange: { start: string; end: string } }> {
    // Import events
    const eventCount = await this.importEvents(userId, events);

    // Get date range
    const sortedEvents = events
      .filter(e => e.start_time)
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

    const dateRange = {
      start: sortedEvents[0]?.start_time || new Date().toISOString(),
      end: sortedEvents[sortedEvents.length - 1]?.start_time || new Date().toISOString()
    };

    // Update onboarding metadata
    await OnboardingService.updateCalendarImportMetadata(userId, source, eventCount, dateRange);

    return { eventCount, dateRange };
  }
}
