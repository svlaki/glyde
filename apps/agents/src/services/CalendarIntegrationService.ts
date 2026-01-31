import ICAL from 'ical.js';
import { google } from 'googleapis';
import { getSupabaseService } from './SupabaseService.js';
import { OnboardingService } from './OnboardingService.js';

interface CalendarEvent {
  title: string;
  start_time: string;
  end_time: string;
  description?: string;
  location?: string;
  recurrence_rule?: string | null;
  is_recurring?: boolean;
  external_id?: string | null;  // Google Calendar ID for deduplication
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

      // Extract UID for deduplication (standard ICS property)
      const uid = event.uid || null;

      events.push({
        title: event.summary || 'Untitled Event',
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        description: event.description || '',
        location: event.location || '',
        recurrence_rule: rruleString,
        is_recurring: !!rruleString,
        external_id: uid ? `ics:${uid}` : null  // Use UID for deduplication if available
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

    // Separate events with external_id (can upsert) from those without (ICS imports)
    const eventsWithExternalId = recentEvents.filter(e => e.external_id);
    const eventsWithoutExternalId = recentEvents.filter(e => !e.external_id);

    let totalInserted = 0;
    const batchSize = 100;

    // Upsert events with external_id (Google/Outlook) - prevents duplicates on re-import
    for (let i = 0; i < eventsWithExternalId.length; i += batchSize) {
      const batch = eventsWithExternalId.slice(i, i + batchSize).map(event => ({
        user_id: userId,
        title: event.title,
        start_time: event.start_time,
        end_time: event.end_time,
        description: event.description || null,
        location: event.location || null,
        recurrence_rule: event.recurrence_rule || null,
        is_recurring: event.is_recurring || false,
        external_id: event.external_id,
        updated_at: new Date().toISOString()
      }));

      const { error, count } = await supabase
        .from('events')
        .upsert(batch, {
          onConflict: 'user_id,external_id',
          ignoreDuplicates: false  // Update existing events with new data
        });

      if (error) {
        console.error('Error upserting events batch:', error);
        continue;
      }

      totalInserted += count || batch.length;
    }

    // For ICS imports (no external_id), check for duplicates by title+start_time
    for (let i = 0; i < eventsWithoutExternalId.length; i += batchSize) {
      const batch = eventsWithoutExternalId.slice(i, i + batchSize);
      
      // Check which events already exist
      const existingCheck = await Promise.all(
        batch.map(async (event) => {
          const { data } = await supabase
            .from('events')
            .select('id')
            .eq('user_id', userId)
            .eq('title', event.title)
            .eq('start_time', event.start_time)
            .limit(1);
          return { event, exists: (data && data.length > 0) };
        })
      );

      // Only insert events that don't already exist
      const newEvents = existingCheck
        .filter(({ exists }) => !exists)
        .map(({ event }) => ({
          user_id: userId,
          title: event.title,
          start_time: event.start_time,
          end_time: event.end_time,
          description: event.description || null,
          location: event.location || null,
          recurrence_rule: event.recurrence_rule || null,
          is_recurring: event.is_recurring || false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));

      if (newEvents.length > 0) {
        const { error, count } = await supabase
          .from('events')
          .insert(newEvents);

        if (error) {
          console.error('Error inserting ICS events batch:', error);
          continue;
        }

        totalInserted += count || newEvents.length;
      }
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
        is_recurring: !!rrule,
        external_id: event.id ? `google:${event.id}` : null  // Prefix with source for uniqueness
      };
    });

    return events;
  }

  /**
   * Complete calendar import flow (import events + update metadata)
   */
  static async completeCalendarImport(
    userId: string,
    source: 'google' | 'ics',
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
