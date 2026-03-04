import { getConnectionService, UserConnection } from './ConnectionService.js';
import { getSupabaseService } from './SupabaseService.js';
import { getCalendarMappingService } from './CalendarMappingService.js';
import { microsoftRecurrenceToRRule, stripHtmlTags } from '../utils/microsoftRecurrence.js';
import type { MicrosoftRecurrence } from '../utils/microsoftRecurrence.js';
import { windowsToIana } from '../utils/windowsTimezones.js';
import { logger } from '../utils/logger.js';

interface SyncResult {
  eventsCreated: number;
  eventsUpdated: number;
  eventsDeleted: number;
  nextDeltaLink: string | null;
}

interface MicrosoftEventTime {
  dateTime: string;
  timeZone: string;
}

interface MicrosoftEvent {
  id: string;
  subject?: string;
  start?: MicrosoftEventTime;
  end?: MicrosoftEventTime;
  body?: { contentType?: string; content?: string };
  location?: { displayName?: string };
  recurrence?: MicrosoftRecurrence;
  isAllDay?: boolean;
  isCancelled?: boolean;
  '@removed'?: { reason: string };
}

interface GraphResponse {
  value: MicrosoftEvent[];
  '@odata.nextLink'?: string;
  '@odata.deltaLink'?: string;
}

/**
 * Microsoft Calendar Sync Service - mirrors GoogleCalendarSyncService
 * for Outlook/Office 365 calendar sync via Microsoft Graph API.
 */
export class MicrosoftCalendarSyncService {
  private connectionService = getConnectionService();
  private supabaseService = getSupabaseService();
  private calendarMappingService = getCalendarMappingService();

  /**
   * Perform initial full sync for a specific calendar
   */
  async performInitialSyncForCalendar(
    connection: UserConnection,
    calendarId: string,
    mappingId: string,
    aspectId?: string
  ): Promise<SyncResult> {
    logger.info('[MicrosoftCalendarSyncService] Starting initial sync for calendar:', calendarId);

    try {
      const accessToken = await this.connectionService.getValidAccessToken(connection);

      // Get events from last 3 months
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      const startFilter = threeMonthsAgo.toISOString();

      // Use delta query for initial sync to get a deltaLink for future syncs
      let url = `https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(calendarId)}/events/delta?$filter=start/dateTime ge '${startFilter}'&$select=id,subject,start,end,body,location,recurrence,isAllDay,isCancelled&$top=100`;

      const allEvents: MicrosoftEvent[] = [];
      let deltaLink: string | null = null;

      // Paginate through all events
      while (url) {
        const response = await this.graphFetch(accessToken, url);

        allEvents.push(...response.value);

        if (response['@odata.nextLink']) {
          url = response['@odata.nextLink'];
        } else {
          deltaLink = response['@odata.deltaLink'] || null;
          url = '';
        }
      }

      logger.info(`[MicrosoftCalendarSyncService] Fetched ${allEvents.length} events from calendar ${calendarId}`);

      // Process events
      const result = await this.processCalendarEvents(
        allEvents,
        connection.user_id,
        connection.id,
        aspectId
      );

      // Store the delta link as the sync token for future delta syncs
      await this.calendarMappingService.updateSyncToken(mappingId, deltaLink);

      logger.info('[MicrosoftCalendarSyncService] Calendar sync completed:', result);
      return { ...result, nextDeltaLink: deltaLink };
    } catch (error) {
      logger.error('[MicrosoftCalendarSyncService] Calendar sync failed:', error);
      throw error;
    }
  }

  /**
   * Perform delta sync using a stored delta link
   */
  async performDeltaSyncForCalendar(
    connection: UserConnection,
    calendarId: string,
    mappingId: string,
    deltaLink: string,
    aspectId?: string
  ): Promise<SyncResult> {
    logger.info('[MicrosoftCalendarSyncService] Starting delta sync for calendar:', calendarId);

    try {
      const accessToken = await this.connectionService.getValidAccessToken(connection);

      const allEvents: MicrosoftEvent[] = [];
      let url: string = deltaLink;
      let newDeltaLink: string | null = null;

      // Paginate through changed events
      while (url) {
        const response = await this.graphFetch(accessToken, url);

        allEvents.push(...response.value);

        if (response['@odata.nextLink']) {
          url = response['@odata.nextLink'];
        } else {
          newDeltaLink = response['@odata.deltaLink'] || null;
          url = '';
        }
      }

      logger.info(`[MicrosoftCalendarSyncService] Delta sync: ${allEvents.length} changed events from ${calendarId}`);

      // Process events
      const result = await this.processCalendarEvents(
        allEvents,
        connection.user_id,
        connection.id,
        aspectId
      );

      // Update delta link for next sync
      await this.calendarMappingService.updateSyncToken(mappingId, newDeltaLink || deltaLink);

      logger.info('[MicrosoftCalendarSyncService] Calendar delta sync completed:', result);
      return { ...result, nextDeltaLink: newDeltaLink };
    } catch (error: any) {
      // Handle expired delta link (410 Gone or similar)
      if (error.status === 410 || error.message?.includes('410') || error.message?.includes('syncStateNotFound')) {
        logger.info('[MicrosoftCalendarSyncService] Delta link expired, performing full re-sync');
        return this.performInitialSyncForCalendar(connection, calendarId, mappingId, aspectId);
      }
      throw error;
    }
  }

  /**
   * Sync all enabled calendars for a connection
   */
  async syncAllEnabledCalendars(connection: UserConnection): Promise<void> {
    logger.info('[MicrosoftCalendarSyncService] Syncing all enabled calendars for connection:', connection.id);

    await this.connectionService.updateSyncStatus(connection.id, 'syncing');

    try {
      const mappings = await this.calendarMappingService.getSyncedMappings(connection.id);

      for (const mapping of mappings) {
        try {
          if (mapping.sync_token) {
            await this.performDeltaSyncForCalendar(
              connection,
              mapping.provider_calendar_id,
              mapping.id,
              mapping.sync_token,
              mapping.aspect_id || undefined
            );
          } else {
            await this.performInitialSyncForCalendar(
              connection,
              mapping.provider_calendar_id,
              mapping.id,
              mapping.aspect_id || undefined
            );
          }
        } catch (error) {
          logger.error(`[MicrosoftCalendarSyncService] Failed to sync calendar ${mapping.provider_calendar_id}:`, error);
          // Continue with other calendars
        }
      }

      await this.connectionService.updateSyncStatus(connection.id, 'synced');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[MicrosoftCalendarSyncService] Sync failed:', error);
      await this.connectionService.updateSyncStatus(connection.id, 'error', errorMessage);
    }
  }

  /**
   * Process calendar events from Microsoft Graph and sync to database
   */
  private async processCalendarEvents(
    events: MicrosoftEvent[],
    userId: string,
    connectionId: string,
    aspectId?: string
  ): Promise<Omit<SyncResult, 'nextDeltaLink'>> {
    let eventsCreated = 0;
    let eventsUpdated = 0;
    let eventsDeleted = 0;

    const supabase = this.supabaseService.getClient();

    for (const msEvent of events) {
      try {
        if (!msEvent.id) continue;

        // Handle deleted events (Microsoft uses @removed property)
        if (msEvent['@removed'] || msEvent.isCancelled) {
          const { error } = await supabase
            .from('events')
            .delete()
            .eq('user_id', userId)
            .eq('outlook_event_id', msEvent.id);

          if (!error) {
            eventsDeleted++;
          }
          continue;
        }

        // Parse event data
        const eventData = this.parseMicrosoftEvent(msEvent, userId);
        if (!eventData) continue;

        // Check if event already exists
        const { data: existingEvent } = await supabase
          .from('events')
          .select('id')
          .eq('user_id', userId)
          .eq('outlook_event_id', msEvent.id)
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
            is_all_day: eventData.is_all_day || false,
            updated_at: new Date().toISOString()
          };

          if (aspectId) {
            updateData.aspect_id = aspectId;
          }

          const { error } = await supabase
            .from('events')
            .update(updateData)
            .eq('id', existingEvent.id);

          if (!error) {
            eventsUpdated++;
          }
        } else {
          // Create new event
          const insertData: Record<string, unknown> = {
            user_id: userId,
            outlook_event_id: msEvent.id,
            title: eventData.title,
            start_time: eventData.start_time,
            end_time: eventData.end_time,
            description: eventData.description,
            location: eventData.location,
            recurrence_rule: eventData.recurrence_rule,
            is_recurring: eventData.is_recurring,
            is_all_day: eventData.is_all_day || false,
            source: 'outlook_calendar',
            connection_id: connectionId
          };

          if (aspectId) {
            insertData.aspect_id = aspectId;
          }

          const { error } = await supabase
            .from('events')
            .insert(insertData);

          if (!error) {
            eventsCreated++;
          }
        }
      } catch (error) {
        logger.error('[MicrosoftCalendarSyncService] Error processing event', {
          eventId: msEvent.id,
          error: error instanceof Error ? error.message : String(error)
        });
        // Continue with other events
      }
    }

    return { eventsCreated, eventsUpdated, eventsDeleted };
  }

  /**
   * Parse a Microsoft Graph event into our internal format
   */
  private parseMicrosoftEvent(
    msEvent: MicrosoftEvent,
    userId: string
  ): { title: string; start_time: string; end_time: string; description?: string; location?: string; recurrence_rule?: string | null; is_recurring: boolean; is_all_day: boolean } | null {
    if (!msEvent.start?.dateTime || !msEvent.end?.dateTime) {
      return null;
    }

    // Convert Microsoft time (dateTime + timeZone) to UTC ISO
    const startIso = this.convertMicrosoftTimeToUtc(msEvent.start);
    const endIso = this.convertMicrosoftTimeToUtc(msEvent.end);

    // Extract description - strip HTML if needed
    let description: string | undefined;
    if (msEvent.body?.content) {
      description = msEvent.body.contentType === 'html'
        ? stripHtmlTags(msEvent.body.content)
        : msEvent.body.content;

      // Truncate very long descriptions
      if (description && description.length > 5000) {
        description = description.substring(0, 5000) + '...';
      }
    }

    // Convert recurrence
    const recurrenceRule = msEvent.recurrence
      ? microsoftRecurrenceToRRule(msEvent.recurrence)
      : null;

    return {
      title: msEvent.subject || 'Untitled Event',
      start_time: startIso,
      end_time: endIso,
      description: description || undefined,
      location: msEvent.location?.displayName || undefined,
      recurrence_rule: recurrenceRule,
      is_recurring: !!recurrenceRule,
      is_all_day: msEvent.isAllDay === true
    };
  }

  /**
   * Convert Microsoft Graph dateTime + timeZone to UTC ISO string.
   * Microsoft returns dateTime without timezone offset and a separate timeZone field
   * (often a Windows timezone name).
   */
  private convertMicrosoftTimeToUtc(time: MicrosoftEventTime): string {
    const { dateTime, timeZone } = time;

    // If the dateTime already has a Z or offset, just parse it directly
    if (dateTime.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(dateTime)) {
      return new Date(dateTime).toISOString();
    }

    // Convert Windows timezone to IANA
    const ianaTz = windowsToIana(timeZone);

    // For UTC, we can directly append Z
    if (ianaTz === 'UTC') {
      return new Date(dateTime + 'Z').toISOString();
    }

    // For other timezones, use the Intl API to calculate the offset
    try {
      // Parse the dateTime as a local time in the given timezone
      // Create a date assuming UTC first, then adjust
      const utcDate = new Date(dateTime + 'Z');

      // Get the timezone offset at this point in time
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: ianaTz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });

      // Format the UTC date in the target timezone to find what time it would be there
      const parts = formatter.formatToParts(utcDate);
      const getValue = (type: string) => parts.find(p => p.type === type)?.value || '0';

      const tzYear = parseInt(getValue('year'));
      const tzMonth = parseInt(getValue('month'));
      const tzDay = parseInt(getValue('day'));
      const tzHour = parseInt(getValue('hour')) % 24;
      const tzMinute = parseInt(getValue('minute'));

      // Calculate the offset in milliseconds between UTC and the timezone
      const tzDate = new Date(Date.UTC(tzYear, tzMonth - 1, tzDay, tzHour, tzMinute));
      const offsetMs = tzDate.getTime() - utcDate.getTime();

      // Apply the offset in reverse to get the actual UTC time
      const localDate = new Date(dateTime + 'Z');
      const actualUtc = new Date(localDate.getTime() - offsetMs);

      return actualUtc.toISOString();
    } catch {
      // Fallback: treat as UTC if timezone conversion fails
      logger.warn(`[MicrosoftCalendarSyncService] Failed to convert timezone ${timeZone}, treating as UTC`);
      return new Date(dateTime + 'Z').toISOString();
    }
  }

  /**
   * Make an authenticated request to the Microsoft Graph API
   */
  private async graphFetch(accessToken: string, url: string): Promise<GraphResponse> {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'odata.maxpagesize=100'
      }
    });

    if (!response.ok) {
      const errorBody = await response.text();
      const error: any = new Error(`Graph API error: ${response.status} ${response.statusText}`);
      error.status = response.status;
      error.body = errorBody;
      throw error;
    }

    return response.json() as Promise<GraphResponse>;
  }
}

// Export singleton instance
const microsoftCalendarSyncServiceInstance = new MicrosoftCalendarSyncService();
export function getMicrosoftCalendarSyncService(): MicrosoftCalendarSyncService {
  return microsoftCalendarSyncServiceInstance;
}
