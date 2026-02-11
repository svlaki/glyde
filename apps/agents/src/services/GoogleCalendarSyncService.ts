import { google, calendar_v3 } from 'googleapis';
import { getConnectionService, UserConnection } from './ConnectionService.js';
import { getSupabaseService } from './SupabaseService.js';
import { getCalendarMappingService } from './CalendarMappingService.js';
import { logger } from '../utils/logger.js';

interface SyncResult {
  eventsCreated: number;
  eventsUpdated: number;
  eventsDeleted: number;
  nextSyncToken: string | null;
}

interface CalendarEvent {
  google_event_id: string;
  title: string;
  start_time: string;
  end_time: string;
  description?: string;
  location?: string;
  recurrence_rule?: string | null;
  is_recurring?: boolean;
  status: 'confirmed' | 'tentative' | 'cancelled';
}

export class GoogleCalendarSyncService {
  private connectionService = getConnectionService();
  private supabaseService = getSupabaseService();
  private calendarMappingService = getCalendarMappingService();

  /**
   * Perform initial full sync for a connection
   */
  async performInitialSync(connection: UserConnection): Promise<SyncResult> {
    logger.info('[GoogleCalendarSyncService] Starting initial sync for connection:', connection.id);

    await this.connectionService.updateSyncStatus(connection.id, 'syncing');

    try {
      const accessToken = await this.connectionService.getValidAccessToken(connection);
      const oauth2Client = this.createOAuthClient(accessToken);
      const calendar = this.createCalendarClient(oauth2Client);

      // Get events from last 3 months
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

      let allEvents: calendar_v3.Schema$Event[] = [];
      let pageToken: string | undefined;
      let nextSyncToken: string | null = null;

      // Paginate through all events
      do {
        const response = await calendar.events.list({
          calendarId: 'primary',
          timeMin: threeMonthsAgo.toISOString(),
          maxResults: 250,
          singleEvents: false,
          orderBy: 'updated',
          pageToken: pageToken
        });

        const events = response.data.items || [];
        allEvents = allEvents.concat(events);
        pageToken = response.data.nextPageToken || undefined;
        nextSyncToken = response.data.nextSyncToken || null;
      } while (pageToken);

      console.log(`[GoogleCalendarSyncService] Fetched ${allEvents.length} events from Google Calendar`);

      // Process events
      const result = await this.processCalendarEvents(allEvents, connection.user_id, connection.id);

      // Update connection with sync token
      await this.connectionService.updateConnection(connection.id, {
        sync_token: nextSyncToken || undefined,
        last_synced_at: new Date().toISOString(),
        sync_status: 'synced',
        sync_error: null
      });

      logger.info('[GoogleCalendarSyncService] Initial sync completed:', result);
      return { ...result, nextSyncToken };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[GoogleCalendarSyncService] Initial sync failed:', error);
      await this.connectionService.updateSyncStatus(connection.id, 'error', errorMessage);
      throw error;
    }
  }

  /**
   * Perform delta sync using sync token
   */
  async performDeltaSync(connection: UserConnection): Promise<SyncResult> {
    logger.info('[GoogleCalendarSyncService] Starting delta sync for connection:', connection.id);

    if (!connection.sync_token) {
      logger.info('[GoogleCalendarSyncService] No sync token, performing initial sync instead');
      return this.performInitialSync(connection);
    }

    await this.connectionService.updateSyncStatus(connection.id, 'syncing');

    try {
      const accessToken = await this.connectionService.getValidAccessToken(connection);
      const oauth2Client = this.createOAuthClient(accessToken);
      const calendar = this.createCalendarClient(oauth2Client);

      let allEvents: calendar_v3.Schema$Event[] = [];
      let pageToken: string | undefined;
      let nextSyncToken: string | null = null;

      // Use sync token for incremental changes
      do {
        const response = await calendar.events.list({
          calendarId: 'primary',
          syncToken: connection.sync_token,
          maxResults: 250,
          pageToken: pageToken,
          showDeleted: true // Get deleted events too
        });

        const events = response.data.items || [];
        allEvents = allEvents.concat(events);
        pageToken = response.data.nextPageToken || undefined;
        nextSyncToken = response.data.nextSyncToken || null;
      } while (pageToken);

      console.log(`[GoogleCalendarSyncService] Delta sync: ${allEvents.length} changed events`);

      // Process events
      const result = await this.processCalendarEvents(allEvents, connection.user_id, connection.id);

      // Update connection
      await this.connectionService.updateConnection(connection.id, {
        sync_token: nextSyncToken || connection.sync_token,
        last_synced_at: new Date().toISOString(),
        sync_status: 'synced',
        sync_error: null
      });

      logger.info('[GoogleCalendarSyncService] Delta sync completed:', result);
      return { ...result, nextSyncToken };
    } catch (error: any) {
      // Handle sync token invalidation (410 Gone)
      if (error.code === 410 || error.status === 410) {
        logger.info('[GoogleCalendarSyncService] Sync token expired, performing full re-sync');
        // Clear sync token and do full sync
        await this.connectionService.updateConnection(connection.id, {
          sync_token: undefined
        });
        return this.performInitialSync(connection);
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[GoogleCalendarSyncService] Delta sync failed:', error);
      await this.connectionService.updateSyncStatus(connection.id, 'error', errorMessage);
      throw error;
    }
  }

  /**
   * Set up a watch subscription for push notifications
   */
  async setupWatchSubscription(connection: UserConnection): Promise<void> {
    logger.info('[GoogleCalendarSyncService] Setting up watch subscription for connection:', connection.id);

    const webhookUrl = process.env.API_BASE_URL
      ? `${process.env.API_BASE_URL}/api/connections/webhook/google`
      : null;

    if (!webhookUrl) {
      logger.warn('[GoogleCalendarSyncService] API_BASE_URL not set, skipping watch subscription');
      return;
    }

    try {
      const accessToken = await this.connectionService.getValidAccessToken(connection);
      const oauth2Client = this.createOAuthClient(accessToken);
      const calendar = this.createCalendarClient(oauth2Client);

      const channelId = `glyde-${connection.id}-${Date.now()}`;

      // Watch for 7 days (maximum allowed by Google)
      const expiration = Date.now() + 7 * 24 * 60 * 60 * 1000;

      const response = await calendar.events.watch({
        calendarId: 'primary',
        requestBody: {
          id: channelId,
          type: 'web_hook',
          address: webhookUrl,
          expiration: String(expiration)
        }
      });

      if (response.data.id && response.data.resourceId && response.data.expiration) {
        await this.connectionService.updateWatchSubscription(
          connection.id,
          response.data.id,
          response.data.resourceId,
          new Date(parseInt(response.data.expiration)).toISOString()
        );

        logger.info('[GoogleCalendarSyncService] Watch subscription created:', {
          channelId: response.data.id,
          expiration: new Date(parseInt(response.data.expiration)).toISOString()
        });
      }
    } catch (error) {
      logger.error('[GoogleCalendarSyncService] Failed to set up watch subscription:', error);
      // Don't throw - watch is optional, sync can still work manually
    }
  }

  /**
   * Stop a watch subscription
   */
  async stopWatchSubscription(connection: UserConnection): Promise<void> {
    if (!connection.watch_channel_id || !connection.watch_resource_id) {
      logger.info('[GoogleCalendarSyncService] No watch subscription to stop');
      return;
    }

    logger.info('[GoogleCalendarSyncService] Stopping watch subscription:', connection.watch_channel_id);

    try {
      const accessToken = await this.connectionService.getValidAccessToken(connection);
      const oauth2Client = this.createOAuthClient(accessToken);
      const calendar = this.createCalendarClient(oauth2Client);

      await calendar.channels.stop({
        requestBody: {
          id: connection.watch_channel_id,
          resourceId: connection.watch_resource_id
        }
      });

      await this.connectionService.clearWatchSubscription(connection.id);
      logger.info('[GoogleCalendarSyncService] Watch subscription stopped');
    } catch (error) {
      logger.error('[GoogleCalendarSyncService] Failed to stop watch subscription:', error);
      // Still clear the subscription info even if stop fails
      await this.connectionService.clearWatchSubscription(connection.id);
    }
  }

  /**
   * Renew a watch subscription
   */
  async renewWatchSubscription(connection: UserConnection): Promise<void> {
    logger.info('[GoogleCalendarSyncService] Renewing watch subscription for connection:', connection.id);

    // Stop old watch first
    await this.stopWatchSubscription(connection);

    // Set up new watch
    await this.setupWatchSubscription(connection);
  }

  /**
   * Perform initial sync for a specific calendar (multi-calendar support)
   */
  async performInitialSyncForCalendar(
    connection: UserConnection,
    calendarId: string,
    mappingId: string,
    categoryId?: string
  ): Promise<SyncResult> {
    logger.info('[GoogleCalendarSyncService] Starting initial sync for calendar:', calendarId);

    try {
      const accessToken = await this.connectionService.getValidAccessToken(connection);
      const oauth2Client = this.createOAuthClient(accessToken);
      const calendar = this.createCalendarClient(oauth2Client);

      // Get events from last 3 months
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

      let allEvents: calendar_v3.Schema$Event[] = [];
      let pageToken: string | undefined;
      let nextSyncToken: string | null = null;

      // Paginate through all events
      do {
        const response = await calendar.events.list({
          calendarId: calendarId,
          timeMin: threeMonthsAgo.toISOString(),
          maxResults: 250,
          singleEvents: false,
          orderBy: 'updated',
          pageToken: pageToken
        });

        const events = response.data.items || [];
        allEvents = allEvents.concat(events);
        pageToken = response.data.nextPageToken || undefined;
        nextSyncToken = response.data.nextSyncToken || null;
      } while (pageToken);

      console.log(`[GoogleCalendarSyncService] Fetched ${allEvents.length} events from calendar ${calendarId}`);

      // Process events with category assignment
      const result = await this.processCalendarEvents(
        allEvents,
        connection.user_id,
        connection.id,
        categoryId
      );

      // Update calendar mapping with sync token
      await this.calendarMappingService.updateSyncToken(mappingId, nextSyncToken);

      logger.info('[GoogleCalendarSyncService] Calendar sync completed:', result);
      return { ...result, nextSyncToken };
    } catch (error) {
      logger.error('[GoogleCalendarSyncService] Calendar sync failed:', error);
      throw error;
    }
  }

  /**
   * Perform delta sync for a specific calendar
   */
  async performDeltaSyncForCalendar(
    connection: UserConnection,
    calendarId: string,
    mappingId: string,
    syncToken: string,
    categoryId?: string
  ): Promise<SyncResult> {
    logger.info('[GoogleCalendarSyncService] Starting delta sync for calendar:', calendarId);

    try {
      const accessToken = await this.connectionService.getValidAccessToken(connection);
      const oauth2Client = this.createOAuthClient(accessToken);
      const calendar = this.createCalendarClient(oauth2Client);

      let allEvents: calendar_v3.Schema$Event[] = [];
      let pageToken: string | undefined;
      let nextSyncToken: string | null = null;

      // Use sync token for incremental changes
      do {
        const response = await calendar.events.list({
          calendarId: calendarId,
          syncToken: syncToken,
          maxResults: 250,
          pageToken: pageToken,
          showDeleted: true
        });

        const events = response.data.items || [];
        allEvents = allEvents.concat(events);
        pageToken = response.data.nextPageToken || undefined;
        nextSyncToken = response.data.nextSyncToken || null;
      } while (pageToken);

      console.log(`[GoogleCalendarSyncService] Delta sync: ${allEvents.length} changed events from ${calendarId}`);

      // Process events with category assignment
      const result = await this.processCalendarEvents(
        allEvents,
        connection.user_id,
        connection.id,
        categoryId
      );

      // Update calendar mapping with new sync token
      await this.calendarMappingService.updateSyncToken(mappingId, nextSyncToken || syncToken);

      logger.info('[GoogleCalendarSyncService] Calendar delta sync completed:', result);
      return { ...result, nextSyncToken };
    } catch (error: any) {
      // Handle sync token invalidation (410 Gone)
      if (error.code === 410 || error.status === 410) {
        logger.info('[GoogleCalendarSyncService] Sync token expired for calendar, performing full re-sync');
        return this.performInitialSyncForCalendar(connection, calendarId, mappingId, categoryId);
      }
      throw error;
    }
  }

  /**
   * Sync all enabled calendars for a connection
   */
  async syncAllEnabledCalendars(connection: UserConnection): Promise<void> {
    logger.info('[GoogleCalendarSyncService] Syncing all enabled calendars for connection:', connection.id);

    const mappings = await this.calendarMappingService.getSyncedMappings(connection.id);

    for (const mapping of mappings) {
      try {
        if (mapping.sync_token) {
          await this.performDeltaSyncForCalendar(
            connection,
            mapping.google_calendar_id,
            mapping.id,
            mapping.sync_token,
            mapping.aspect_id || undefined
          );
        } else {
          await this.performInitialSyncForCalendar(
            connection,
            mapping.google_calendar_id,
            mapping.id,
            mapping.aspect_id || undefined
          );
        }
      } catch (error) {
        console.error(`[GoogleCalendarSyncService] Failed to sync calendar ${mapping.google_calendar_id}:`, error);
        // Continue with other calendars
      }
    }
  }

  /**
   * Process calendar events from Google and sync to database
   */
  private async processCalendarEvents(
    events: calendar_v3.Schema$Event[],
    userId: string,
    connectionId: string,
    categoryId?: string
  ): Promise<Omit<SyncResult, 'nextSyncToken'>> {
    let eventsCreated = 0;
    let eventsUpdated = 0;
    let eventsDeleted = 0;

    const supabase = this.supabaseService.getClient();

    for (const googleEvent of events) {
      try {
        // Skip events without required fields
        if (!googleEvent.id) continue;

        // Handle deleted events
        if (googleEvent.status === 'cancelled') {
          // Try to delete the event from our database
          const { error } = await supabase
            .from('events')
            .delete()
            .eq('user_id', userId)
            .eq('google_event_id', googleEvent.id);

          if (!error) {
            eventsDeleted++;
          }
          continue;
        }

        // Parse event data
        const eventData = this.parseGoogleEvent(googleEvent, userId);
        if (!eventData) continue;

        // Check if event already exists
        const { data: existingEvent } = await supabase
          .from('events')
          .select('id')
          .eq('user_id', userId)
          .eq('google_event_id', googleEvent.id)
          .single();

        if (existingEvent) {
          // Update existing event
          const updateData: Record<string, unknown> = {
            title: eventData.title,
            start_time: eventData.start_time,
            end_time: eventData.end_time,
            description: eventData.description,
            location: eventData.location,
            recurrence_rule: eventData.recurrence_rule,
            is_recurring: eventData.is_recurring,
            updated_at: new Date().toISOString()
          };

          // Update category if specified (allows re-sync to fix categories)
          if (categoryId) {
            updateData.aspect_id = categoryId;
          }

          const { error } = await supabase
            .from('events')
            .update(updateData)
            .eq('id', existingEvent.id);

          if (!error) {
            eventsUpdated++;
          }
        } else {
          // Create new event with optional category assignment
          const insertData: Record<string, unknown> = {
            user_id: userId,
            google_event_id: googleEvent.id,
            title: eventData.title,
            start_time: eventData.start_time,
            end_time: eventData.end_time,
            description: eventData.description,
            location: eventData.location,
            recurrence_rule: eventData.recurrence_rule,
            is_recurring: eventData.is_recurring,
            source: 'google_calendar',
            connection_id: connectionId
          };

          // Assign category if specified
          if (categoryId) {
            insertData.aspect_id = categoryId;
          }

          const { error } = await supabase
            .from('events')
            .insert(insertData);

          if (!error) {
            eventsCreated++;
          }
        }
      } catch (error) {
        logger.error('[GoogleCalendarSyncService] Error processing event', { eventId: googleEvent.id, error: error instanceof Error ? error.message : String(error) });
        // Continue with other events
      }
    }

    return { eventsCreated, eventsUpdated, eventsDeleted };
  }

  /**
   * Parse a Google Calendar event into our format
   */
  private parseGoogleEvent(
    googleEvent: calendar_v3.Schema$Event,
    userId: string
  ): CalendarEvent | null {
    // Get start and end times
    const startTime = googleEvent.start?.dateTime || googleEvent.start?.date;
    const endTime = googleEvent.end?.dateTime || googleEvent.end?.date;

    if (!startTime || !endTime) {
      return null;
    }

    // Extract RRULE from recurrence array
    const rrule = googleEvent.recurrence?.find(r => r.startsWith('RRULE:'))?.replace('RRULE:', '') || null;

    return {
      google_event_id: googleEvent.id!,
      title: googleEvent.summary || 'Untitled Event',
      start_time: new Date(startTime).toISOString(),
      end_time: new Date(endTime).toISOString(),
      description: googleEvent.description || undefined,
      location: googleEvent.location || undefined,
      recurrence_rule: rrule,
      is_recurring: !!rrule,
      status: googleEvent.status as 'confirmed' | 'tentative' | 'cancelled'
    };
  }

  /**
   * Create an OAuth2 client with the given access token
   */
  private createOAuthClient(accessToken: string) {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ access_token: accessToken });
    return oauth2Client;
  }

  /**
   * Create a Google Calendar API client with timeout
   */
  private createCalendarClient(oauth2Client: any) {
    return google.calendar({
      version: 'v3',
      auth: oauth2Client,
      timeout: 30000 // 30s timeout for all Google Calendar API calls
    });
  }
}

// Export singleton instance
const googleCalendarSyncServiceInstance = new GoogleCalendarSyncService();
export function getGoogleCalendarSyncService(): GoogleCalendarSyncService {
  return googleCalendarSyncServiceInstance;
}
