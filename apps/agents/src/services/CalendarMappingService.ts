import { google, calendar_v3 } from 'googleapis';
import { getSupabaseClient } from './SupabaseService.js';
import { getConnectionService, UserConnection } from './ConnectionService.js';
import aspectService from './AspectService.js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';

const MAPPING_COLUMNS = 'id, user_id, connection_id, google_calendar_id, google_calendar_name, google_calendar_color, is_primary, aspect_id, is_synced, is_visible, sync_token, last_synced_at, created_at, updated_at';

// Color palette for auto-created aspects (avoiding common colors that might be used)
const ASPECT_COLOR_PALETTE = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#f97316', // orange
  '#6366f1', // indigo
  '#14b8a6', // teal
  '#a855f7', // purple
  '#22c55e', // green
  '#eab308', // yellow
  '#64748b', // slate
];

export interface CalendarMapping {
  id: string;
  user_id: string;
  connection_id: string;
  google_calendar_id: string;
  google_calendar_name: string | null;
  google_calendar_color: string | null;
  is_primary: boolean;
  aspect_id: string | null;
  is_synced: boolean;
  is_visible: boolean;
  sync_token: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GoogleCalendarInfo {
  id: string;
  summary: string;
  description: string | null;
  backgroundColor: string | null;
  foregroundColor: string | null;
  primary: boolean;
  accessRole: string;
  timeZone: string | null;
}

export interface CreateCalendarMappingInput {
  connection_id: string;
  google_calendar_id: string;
  google_calendar_name?: string;
  google_calendar_color?: string;
  is_primary?: boolean;
  aspect_id?: string;
  is_synced?: boolean;
  is_visible?: boolean;
}

export interface UpdateCalendarMappingInput {
  google_calendar_name?: string;
  google_calendar_color?: string;
  aspect_id?: string | null;
  is_synced?: boolean;
  is_visible?: boolean;
  sync_token?: string | null;
  last_synced_at?: string | null;
}

export class CalendarMappingService {
  private supabase: SupabaseClient;
  private connectionService = getConnectionService();

  constructor() {
    this.supabase = getSupabaseClient();
  }

  /**
   * Fetch all calendars from a user's Google account
   */
  async fetchGoogleCalendarList(connection: UserConnection): Promise<GoogleCalendarInfo[]> {
    try {
      const accessToken = await this.connectionService.getValidAccessToken(connection);

      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
      );
      oauth2Client.setCredentials({ access_token: accessToken });

      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      const response = await calendar.calendarList.list({
        minAccessRole: 'reader',
        showDeleted: false,
        showHidden: false
      });

      const items = response.data.items || [];

      return items.map((item: calendar_v3.Schema$CalendarListEntry) => ({
        id: item.id || '',
        summary: item.summary || 'Untitled Calendar',
        description: item.description || null,
        backgroundColor: item.backgroundColor || null,
        foregroundColor: item.foregroundColor || null,
        primary: item.primary === true,
        accessRole: item.accessRole || 'reader',
        timeZone: item.timeZone || null
      }));
    } catch (error) {
      logger.error('[CalendarMappingService] Error fetching calendar list:', error);
      throw new Error('Failed to fetch Google calendars');
    }
  }

  /**
   * Get all calendar mappings for a user
   */
  async getMappingsForUser(userId: string): Promise<CalendarMapping[]> {
    try {
      const { data, error } = await this.supabase
        .from('user_calendar_mappings')
        .select(MAPPING_COLUMNS)
        .eq('user_id', userId)
        .order('is_primary', { ascending: false })
        .order('google_calendar_name', { ascending: true });

      if (error) {
        logger.error('[CalendarMappingService] Error fetching mappings:', error);
        return [];
      }

      return (data || []) as CalendarMapping[];
    } catch (error) {
      logger.error('[CalendarMappingService] Exception fetching mappings:', error);
      return [];
    }
  }

  /**
   * Get all calendar mappings for a connection
   */
  async getMappingsForConnection(connectionId: string): Promise<CalendarMapping[]> {
    try {
      const { data, error } = await this.supabase
        .from('user_calendar_mappings')
        .select(MAPPING_COLUMNS)
        .eq('connection_id', connectionId)
        .order('is_primary', { ascending: false })
        .order('google_calendar_name', { ascending: true });

      if (error) {
        logger.error('[CalendarMappingService] Error fetching connection mappings:', error);
        return [];
      }

      return (data || []) as CalendarMapping[];
    } catch (error) {
      logger.error('[CalendarMappingService] Exception fetching connection mappings:', error);
      return [];
    }
  }

  /**
   * Get only synced calendar mappings for a connection
   */
  async getSyncedMappings(connectionId: string): Promise<CalendarMapping[]> {
    try {
      const { data, error } = await this.supabase
        .from('user_calendar_mappings')
        .select(MAPPING_COLUMNS)
        .eq('connection_id', connectionId)
        .eq('is_synced', true)
        .order('is_primary', { ascending: false });

      if (error) {
        logger.error('[CalendarMappingService] Error fetching synced mappings:', error);
        return [];
      }

      return (data || []) as CalendarMapping[];
    } catch (error) {
      logger.error('[CalendarMappingService] Exception fetching synced mappings:', error);
      return [];
    }
  }

  /**
   * Get a specific mapping by ID
   */
  async getMappingById(mappingId: string): Promise<CalendarMapping | null> {
    try {
      const { data, error } = await this.supabase
        .from('user_calendar_mappings')
        .select(MAPPING_COLUMNS)
        .eq('id', mappingId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        logger.error('[CalendarMappingService] Error fetching mapping:', error);
        return null;
      }

      return data as CalendarMapping;
    } catch (error) {
      logger.error('[CalendarMappingService] Exception fetching mapping:', error);
      return null;
    }
  }

  /**
   * Create a new calendar mapping
   */
  async createMapping(userId: string, input: CreateCalendarMappingInput): Promise<CalendarMapping> {
    try {
      const { data, error } = await this.supabase
        .from('user_calendar_mappings')
        .insert({
          user_id: userId,
          connection_id: input.connection_id,
          google_calendar_id: input.google_calendar_id,
          google_calendar_name: input.google_calendar_name || null,
          google_calendar_color: input.google_calendar_color || null,
          is_primary: input.is_primary || false,
          aspect_id: input.aspect_id || null,
          is_synced: input.is_synced ?? (input.is_primary || false), // Primary synced by default
          is_visible: input.is_visible ?? true
        })
        .select()
        .single();

      if (error) {
        logger.error('[CalendarMappingService] Error creating mapping:', error);
        throw new Error(`Failed to create calendar mapping: ${error.message}`);
      }

      logger.info('[CalendarMappingService] Mapping created:', data.id);
      return data as CalendarMapping;
    } catch (error) {
      logger.error('[CalendarMappingService] Exception creating mapping:', error);
      throw error;
    }
  }

  /**
   * Create or update a calendar mapping (upsert)
   */
  async upsertMapping(userId: string, input: CreateCalendarMappingInput): Promise<CalendarMapping> {
    try {
      const { data, error } = await this.supabase
        .from('user_calendar_mappings')
        .upsert({
          user_id: userId,
          connection_id: input.connection_id,
          google_calendar_id: input.google_calendar_id,
          google_calendar_name: input.google_calendar_name || null,
          google_calendar_color: input.google_calendar_color || null,
          is_primary: input.is_primary || false,
          aspect_id: input.aspect_id || null,
          is_synced: input.is_synced ?? (input.is_primary || false),
          is_visible: input.is_visible ?? true,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'connection_id,google_calendar_id'
        })
        .select()
        .single();

      if (error) {
        logger.error('[CalendarMappingService] Error upserting mapping:', error);
        throw new Error(`Failed to upsert calendar mapping: ${error.message}`);
      }

      logger.info('[CalendarMappingService] Mapping upserted:', data.id);
      return data as CalendarMapping;
    } catch (error) {
      logger.error('[CalendarMappingService] Exception upserting mapping:', error);
      throw error;
    }
  }

  /**
   * Update a calendar mapping
   */
  async updateMapping(mappingId: string, updates: UpdateCalendarMappingInput): Promise<CalendarMapping> {
    try {
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString()
      };

      if (updates.google_calendar_name !== undefined) updateData.google_calendar_name = updates.google_calendar_name;
      if (updates.google_calendar_color !== undefined) updateData.google_calendar_color = updates.google_calendar_color;
      if (updates.aspect_id !== undefined) updateData.aspect_id = updates.aspect_id;
      if (updates.is_synced !== undefined) updateData.is_synced = updates.is_synced;
      if (updates.is_visible !== undefined) updateData.is_visible = updates.is_visible;
      if (updates.sync_token !== undefined) updateData.sync_token = updates.sync_token;
      if (updates.last_synced_at !== undefined) updateData.last_synced_at = updates.last_synced_at;

      const { data, error } = await this.supabase
        .from('user_calendar_mappings')
        .update(updateData)
        .eq('id', mappingId)
        .select()
        .single();

      if (error) {
        logger.error('[CalendarMappingService] Error updating mapping:', error);
        throw new Error(`Failed to update calendar mapping: ${error.message}`);
      }

      logger.info('[CalendarMappingService] Mapping updated:', mappingId);
      return data as CalendarMapping;
    } catch (error) {
      logger.error('[CalendarMappingService] Exception updating mapping:', error);
      throw error;
    }
  }

  /**
   * Delete a calendar mapping
   */
  async deleteMapping(mappingId: string, userId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('user_calendar_mappings')
        .delete()
        .eq('id', mappingId)
        .eq('user_id', userId);

      if (error) {
        logger.error('[CalendarMappingService] Error deleting mapping:', error);
        throw new Error(`Failed to delete calendar mapping: ${error.message}`);
      }

      logger.info('[CalendarMappingService] Mapping deleted:', mappingId);
    } catch (error) {
      logger.error('[CalendarMappingService] Exception deleting mapping:', error);
      throw error;
    }
  }

  /**
   * Delete all mappings for a connection
   */
  async deleteMappingsForConnection(connectionId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('user_calendar_mappings')
        .delete()
        .eq('connection_id', connectionId);

      if (error) {
        logger.error('[CalendarMappingService] Error deleting connection mappings:', error);
        throw new Error(`Failed to delete connection mappings: ${error.message}`);
      }

      logger.info('[CalendarMappingService] All mappings deleted for connection:', connectionId);
    } catch (error) {
      logger.error('[CalendarMappingService] Exception deleting connection mappings:', error);
      throw error;
    }
  }

  /**
   * Toggle sync status for a calendar
   */
  async toggleSync(mappingId: string, isSynced: boolean): Promise<CalendarMapping> {
    return this.updateMapping(mappingId, { is_synced: isSynced });
  }

  /**
   * Toggle visibility for a calendar
   */
  async toggleVisibility(mappingId: string, isVisible: boolean): Promise<CalendarMapping> {
    return this.updateMapping(mappingId, { is_visible: isVisible });
  }

  /**
   * Set aspect/category for a calendar
   */
  async setAspect(mappingId: string, aspectId: string | null): Promise<CalendarMapping> {
    return this.updateMapping(mappingId, { aspect_id: aspectId });
  }

  /**
   * Update sync token for a calendar mapping
   */
  async updateSyncToken(mappingId: string, syncToken: string | null): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('user_calendar_mappings')
        .update({
          sync_token: syncToken,
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', mappingId);

      if (error) {
        logger.error('[CalendarMappingService] Error updating sync token:', error);
      }
    } catch (error) {
      logger.error('[CalendarMappingService] Exception updating sync token:', error);
    }
  }

  /**
   * Sync calendar list from Google and create/update mappings
   * Called when a connection is first established or when refreshing calendars
   */
  async syncCalendarList(connection: UserConnection): Promise<CalendarMapping[]> {
    try {
      // Fetch calendars from Google
      const googleCalendars = await this.fetchGoogleCalendarList(connection);

      // Get existing mappings
      const existingMappings = await this.getMappingsForConnection(connection.id);
      const existingByCalendarId = new Map(
        existingMappings.map(m => [m.google_calendar_id, m])
      );

      const results: CalendarMapping[] = [];

      // Create or update mappings for each Google calendar
      for (const gcal of googleCalendars) {
        const existing = existingByCalendarId.get(gcal.id);

        if (existing) {
          // Update existing mapping with latest calendar info
          const updated = await this.updateMapping(existing.id, {
            google_calendar_name: gcal.summary,
            google_calendar_color: gcal.backgroundColor || undefined
          });
          results.push(updated);
        } else {
          // Create new mapping
          const created = await this.createMapping(connection.user_id, {
            connection_id: connection.id,
            google_calendar_id: gcal.id,
            google_calendar_name: gcal.summary,
            google_calendar_color: gcal.backgroundColor || undefined,
            is_primary: gcal.primary,
            is_synced: gcal.primary, // Only sync primary by default
            is_visible: true
          });
          results.push(created);
        }
      }

      console.log(`[CalendarMappingService] Synced ${results.length} calendars for connection:`, connection.id);
      return results;
    } catch (error) {
      logger.error('[CalendarMappingService] Error syncing calendar list:', error);
      throw error;
    }
  }

  /**
   * Auto-map calendars to aspects based on name matching
   * Creates new aspects if no match found
   */
  async autoMapCalendarsToAspects(connection: UserConnection): Promise<void> {
    logger.info('[CalendarMappingService] Auto-mapping calendars to aspects for:', connection.id);

    try {
      // Get all calendars and existing aspects
      const mappings = await this.getMappingsForConnection(connection.id);
      let existingAspects = await aspectService.getAspects(connection.user_id);
      const usedColors = new Set<string>(
        existingAspects
          .map((a: { color?: string }) => a.color?.toLowerCase())
          .filter((c): c is string => c !== undefined)
      );

      for (const mapping of mappings) {
        // Skip if already has an aspect assigned
        if (mapping.aspect_id) continue;

        const calendarName = mapping.google_calendar_name || 'Calendar';

        // Try to find a matching aspect
        const matchedAspect = this.findMatchingAspect(calendarName, existingAspects);

        if (matchedAspect) {
          // Use existing aspect
          await this.updateMapping(mapping.id, { aspect_id: matchedAspect.id });
          console.log(`[CalendarMappingService] Mapped "${calendarName}" to existing aspect "${matchedAspect.name}"`);
        } else {
          // Create new aspect with unused color
          const newColor = this.getUnusedColor(usedColors);
          usedColors.add(newColor.toLowerCase());

          const newAspect = await aspectService.createAspect(connection.user_id, {
            name: this.cleanCalendarName(calendarName),
            color: newColor,
            description: `Auto-created from Google Calendar: ${calendarName}`
          });

          if (newAspect) {
            await this.updateMapping(mapping.id, { aspect_id: newAspect.id });
            existingAspects = [...existingAspects, newAspect]; // Add to list for future matching
            console.log(`[CalendarMappingService] Created new aspect "${newAspect.name}" for calendar "${calendarName}"`);
          }
        }
      }
    } catch (error) {
      logger.error('[CalendarMappingService] Error auto-mapping calendars:', error);
      // Don't throw - mapping is optional, sync can still work
    }
  }

  /**
   * Find an existing aspect that matches the calendar name
   */
  private findMatchingAspect(
    calendarName: string,
    aspects: Array<{ id: string; name: string; color?: string }>
  ): { id: string; name: string } | null {
    const normalized = this.normalizeForMatching(calendarName);

    for (const aspect of aspects) {
      const aspectNormalized = this.normalizeForMatching(aspect.name);

      // Exact match
      if (normalized === aspectNormalized) {
        return aspect;
      }

      // One contains the other
      if (normalized.includes(aspectNormalized) || aspectNormalized.includes(normalized)) {
        return aspect;
      }

      // Common variations
      const variations: Record<string, string[]> = {
        'work': ['office', 'job', 'professional', 'business'],
        'personal': ['private', 'me', 'self'],
        'health': ['fitness', 'gym', 'exercise', 'medical', 'wellness'],
        'family': ['home', 'kids', 'household'],
        'social': ['friends', 'events', 'party'],
        'learning': ['study', 'education', 'school', 'training'],
        'finance': ['money', 'budget', 'bills']
      };

      for (const [key, synonyms] of Object.entries(variations)) {
        const allTerms = [key, ...synonyms];
        const calendarMatches = allTerms.some(t => normalized.includes(t));
        const aspectMatches = allTerms.some(t => aspectNormalized.includes(t));

        if (calendarMatches && aspectMatches) {
          return aspect;
        }
      }
    }

    return null;
  }

  /**
   * Normalize a string for matching (lowercase, remove special chars)
   */
  private normalizeForMatching(str: string): string {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .trim();
  }

  /**
   * Clean calendar name for use as aspect name
   */
  private cleanCalendarName(name: string): string {
    // Remove common suffixes like "Calendar", "Cal", etc.
    return name
      .replace(/\s*(calendar|cal|schedule|events?)$/i, '')
      .replace(/^\s*(my|the)\s+/i, '')
      .trim() || name;
  }

  /**
   * Get an unused color from the palette
   */
  private getUnusedColor(usedColors: Set<string>): string {
    for (const color of ASPECT_COLOR_PALETTE) {
      if (!usedColors.has(color.toLowerCase())) {
        return color;
      }
    }
    // If all colors used, return a random one from palette
    return ASPECT_COLOR_PALETTE[Math.floor(Math.random() * ASPECT_COLOR_PALETTE.length)];
  }
}

// Export singleton instance
const calendarMappingServiceInstance = new CalendarMappingService();
export function getCalendarMappingService(): CalendarMappingService {
  return calendarMappingServiceInstance;
}
