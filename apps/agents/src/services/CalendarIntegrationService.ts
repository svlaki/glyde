import ICAL from 'ical.js';
import { google } from 'googleapis';
import { Client } from '@microsoft/microsoft-graph-client';
import { getSupabaseService } from './SupabaseService.js';
import { OnboardingService } from './OnboardingService.js';
import { v4 as uuidv4 } from 'uuid';

interface CalendarEvent {
  event_title: string;
  event_starts_at: string;
  event_ends_at: string;
  event_description?: string;
  event_location?: string;
  recurrence?: any;
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

      events.push({
        event_title: event.summary || 'Untitled Event',
        event_starts_at: startDate.toISOString(),
        event_ends_at: endDate.toISOString(),
        event_description: event.description || '',
        event_location: event.location || '',
        recurrence: null // Simple import without recurrence
      });
    });

    return events;
  }

  /**
   * Import events into user's schema
   */
  static async importEvents(userId: string, events: CalendarEvent[]): Promise<number> {
    const supabase = getSupabaseService().getClient();
    const userSchema = `u_${userId.replace(/-/g, '')}`;

    // Only import events from last 3 months
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const recentEvents = events.filter(event =>
      new Date(event.event_starts_at) >= threeMonthsAgo
    );

    if (recentEvents.length === 0) {
      return 0;
    }

    // Prepare events for insertion
    const eventsToInsert = recentEvents.map(event => ({
      ...event,
      user_id: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    // Insert events in batches of 100
    const batchSize = 100;
    let totalInserted = 0;

    for (let i = 0; i < eventsToInsert.length; i += batchSize) {
      const batch = eventsToInsert.slice(i, i + batchSize);

      const { error, count } = await supabase
        .from(`${userSchema}.events`)
        .insert(batch);

      if (error) {
        console.error('Error inserting events batch:', error);
        // Continue with next batch instead of failing completely
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
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    const scopes = ['https://www.googleapis.com/auth/calendar.readonly'];

    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: userId // Pass userId as state for callback
    });

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
      singleEvents: true,
      orderBy: 'startTime'
    });

    const googleEvents = response.data.items || [];

    const events: CalendarEvent[] = googleEvents.map(event => ({
      event_title: event.summary || 'Untitled Event',
      event_starts_at: event.start?.dateTime || event.start?.date || new Date().toISOString(),
      event_ends_at: event.end?.dateTime || event.end?.date || new Date().toISOString(),
      event_description: event.description || '',
      event_location: event.location || '',
      recurrence: null
    }));

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
      .select('subject,start,end,location,bodyPreview')
      .top(2500)
      .get();

    const microsoftEvents = response.value || [];

    const events: CalendarEvent[] = microsoftEvents.map((event: any) => ({
      event_title: event.subject || 'Untitled Event',
      event_starts_at: event.start?.dateTime || new Date().toISOString(),
      event_ends_at: event.end?.dateTime || new Date().toISOString(),
      event_description: event.bodyPreview || '',
      event_location: event.location?.displayName || '',
      recurrence: null
    }));

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
      .filter(e => e.event_starts_at)
      .sort((a, b) => new Date(a.event_starts_at).getTime() - new Date(b.event_starts_at).getTime());

    const dateRange = {
      start: sortedEvents[0]?.event_starts_at || new Date().toISOString(),
      end: sortedEvents[sortedEvents.length - 1]?.event_starts_at || new Date().toISOString()
    };

    // Update onboarding metadata
    await OnboardingService.updateCalendarImportMetadata(userId, source, eventCount, dateRange);

    return { eventCount, dateRange };
  }
}
