import { google, calendar_v3 } from 'googleapis';
import { getSupabaseClient } from './SupabaseService.js';
import { getConnectionService, UserConnection } from './ConnectionService.js';
import aspectService from './AspectService.js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';
import OpenAI from 'openai';

const MAPPING_COLUMNS = 'id, user_id, connection_id, provider_calendar_id, provider_calendar_name, provider_calendar_color, is_primary, aspect_id, is_synced, is_visible, sync_token, last_synced_at, created_at, updated_at';

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
  provider_calendar_id: string;
  provider_calendar_name: string | null;
  provider_calendar_color: string | null;
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
  provider_calendar_id: string;
  provider_calendar_name?: string;
  provider_calendar_color?: string;
  is_primary?: boolean;
  aspect_id?: string;
  is_synced?: boolean;
  is_visible?: boolean;
}

export interface UpdateCalendarMappingInput {
  provider_calendar_name?: string;
  provider_calendar_color?: string;
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
        .order('provider_calendar_name', { ascending: true });

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
        .order('provider_calendar_name', { ascending: true });

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
          provider_calendar_id: input.provider_calendar_id,
          provider_calendar_name: input.provider_calendar_name || null,
          provider_calendar_color: input.provider_calendar_color || null,
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
          provider_calendar_id: input.provider_calendar_id,
          provider_calendar_name: input.provider_calendar_name || null,
          provider_calendar_color: input.provider_calendar_color || null,
          is_primary: input.is_primary || false,
          aspect_id: input.aspect_id || null,
          is_synced: input.is_synced ?? (input.is_primary || false),
          is_visible: input.is_visible ?? true,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'connection_id,provider_calendar_id'
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

      if (updates.provider_calendar_name !== undefined) updateData.provider_calendar_name = updates.provider_calendar_name;
      if (updates.provider_calendar_color !== undefined) updateData.provider_calendar_color = updates.provider_calendar_color;
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
   * Fetch all calendars from a user's Microsoft Outlook account
   */
  async fetchMicrosoftCalendarList(connection: UserConnection): Promise<GoogleCalendarInfo[]> {
    try {
      const accessToken = await this.connectionService.getValidAccessToken(connection);

      const response = await fetch('https://graph.microsoft.com/v1.0/me/calendars', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Graph API error ${response.status}: ${errorBody}`);
      }

      const data = await response.json() as { value?: Array<{ id: string; name: string; hexColor?: string; isDefaultCalendar?: boolean; canEdit?: boolean }> };
      const calendars = data.value || [];

      return calendars.map((cal) => ({
        id: cal.id,
        summary: cal.name || 'Untitled Calendar',
        description: null,
        backgroundColor: cal.hexColor || null,
        foregroundColor: null,
        primary: cal.isDefaultCalendar === true,
        accessRole: cal.canEdit ? 'writer' : 'reader',
        timeZone: null
      }));
    } catch (error) {
      logger.error('[CalendarMappingService] Error fetching Microsoft calendar list:', error);
      throw new Error('Failed to fetch Microsoft calendars');
    }
  }

  /**
   * Sync calendar list from provider and create/update mappings
   * Called when a connection is first established or when refreshing calendars
   */
  async syncCalendarList(connection: UserConnection): Promise<CalendarMapping[]> {
    try {
      // Fetch calendars from the appropriate provider
      const calendars = connection.provider === 'microsoft'
        ? await this.fetchMicrosoftCalendarList(connection)
        : await this.fetchGoogleCalendarList(connection);

      // Get existing mappings
      const existingMappings = await this.getMappingsForConnection(connection.id);
      const existingByCalendarId = new Map(
        existingMappings.map(m => [m.provider_calendar_id, m])
      );

      const results: CalendarMapping[] = [];

      // Create or update mappings for each calendar
      for (const gcal of calendars) {
        const existing = existingByCalendarId.get(gcal.id);

        // Determine sync behavior based on calendar type
        const calendarType = this.classifyCalendar(gcal.id, connection.provider);
        // Skip contacts, weather, other system calendars entirely
        const shouldSync = calendarType === 'user' ? gcal.primary : calendarType === 'holiday';
        const shouldSkip = calendarType === 'skip';

        if (existing) {
          // Update existing mapping with latest calendar info
          const updateData: UpdateCalendarMappingInput = {
            provider_calendar_name: gcal.summary,
            provider_calendar_color: gcal.backgroundColor || undefined
          };
          // Force skip calendars to not sync
          if (shouldSkip) {
            updateData.is_synced = false;
          }
          const updated = await this.updateMapping(existing.id, updateData);
          results.push(updated);
        } else {
          // Create new mapping (upsert to handle concurrent syncs)
          const created = await this.upsertMapping(connection.user_id, {
            connection_id: connection.id,
            provider_calendar_id: gcal.id,
            provider_calendar_name: gcal.summary,
            provider_calendar_color: gcal.backgroundColor || undefined,
            is_primary: gcal.primary,
            is_synced: shouldSkip ? false : shouldSync,
            is_visible: !shouldSkip
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
   * Auto-map calendars to aspects using LLM-based categorization.
   * Falls back to simple synonym matching if LLM call fails.
   * Only maps synced user calendars, skips holiday/system calendars.
   */
  async autoMapCalendarsToAspects(connection: UserConnection): Promise<void> {
    logger.info('[CalendarMappingService] Auto-mapping calendars to aspects for:', connection.id);

    try {
      const mappings = await this.getSyncedMappings(connection.id);
      let existingAspects = await aspectService.getAspects(connection.user_id);
      const usedColors = new Set<string>(
        existingAspects
          .map((a: { color?: string }) => a.color?.toLowerCase())
          .filter((c): c is string => c !== undefined)
      );

      // Collect calendars that need mapping
      const unmappedCalendars: Array<{ mapping: CalendarMapping; calendarName: string }> = [];
      for (const mapping of mappings) {
        if (mapping.aspect_id) continue;
        if (this.isNonUserCalendar(mapping.provider_calendar_id, connection.provider)) {
          logger.info(`[CalendarMappingService] Skipping non-user calendar: ${mapping.provider_calendar_name}`);
          continue;
        }
        unmappedCalendars.push({
          mapping,
          calendarName: mapping.provider_calendar_name || 'Calendar'
        });
      }

      if (unmappedCalendars.length === 0) return;

      // Try LLM-based mapping first, fall back to synonym matching
      let llmMappings: Record<string, string | null> | null = null;
      try {
        llmMappings = await this.getLLMCalendarMappings(
          unmappedCalendars.map(c => ({
            name: c.calendarName,
            isPrimary: c.mapping.is_primary
          })),
          existingAspects.map(a => ({ id: a.id, name: a.name }))
        );
      } catch (error) {
        logger.warn('[CalendarMappingService] LLM mapping failed, falling back to synonym matching:', error);
      }

      const providerLabel = connection.provider === 'microsoft' ? 'Outlook' : 'Google Calendar';

      for (const { mapping, calendarName } of unmappedCalendars) {
        // Check LLM result first
        const llmAspectId = llmMappings?.[calendarName];

        if (llmAspectId === null) {
          // LLM says don't map (e.g. primary calendar -> use Personal or leave null)
          // Find a "Personal" aspect to use as fallback for primary calendar
          if (mapping.is_primary) {
            const personalAspect = existingAspects.find(
              a => a.name.toLowerCase() === 'personal'
            );
            if (personalAspect) {
              await this.updateMapping(mapping.id, { aspect_id: personalAspect.id });
              logger.info(`[CalendarMappingService] Mapped primary calendar to "Personal" aspect`);
            }
          }
          continue;
        }

        if (llmAspectId && llmAspectId.startsWith('existing:')) {
          // LLM matched to an existing aspect
          const aspectId = llmAspectId.replace('existing:', '');
          const matchedAspect = existingAspects.find(a => a.id === aspectId);
          if (matchedAspect) {
            await this.updateMapping(mapping.id, { aspect_id: matchedAspect.id });
            logger.info(`[CalendarMappingService] LLM mapped "${calendarName}" to existing aspect "${matchedAspect.name}"`);
            continue;
          }
        }

        if (llmAspectId && llmAspectId.startsWith('new:')) {
          // LLM suggests creating a new aspect with a clean name
          const cleanName = llmAspectId.replace('new:', '');
          const newColor = this.getUnusedColor(usedColors);
          usedColors.add(newColor.toLowerCase());

          const newAspect = await aspectService.createAspect(connection.user_id, {
            name: cleanName,
            color: newColor,
            description: `Auto-created from ${providerLabel}: ${calendarName}`
          });

          if (newAspect) {
            await this.updateMapping(mapping.id, { aspect_id: newAspect.id });
            existingAspects = [...existingAspects, newAspect];
            logger.info(`[CalendarMappingService] LLM created aspect "${cleanName}" for calendar "${calendarName}"`);
          }
          continue;
        }

        // Fallback: use simple synonym matching
        const matchedAspect = this.findMatchingAspect(calendarName, existingAspects);
        if (matchedAspect) {
          await this.updateMapping(mapping.id, { aspect_id: matchedAspect.id });
          logger.info(`[CalendarMappingService] Synonym-matched "${calendarName}" to "${matchedAspect.name}"`);
        } else {
          const newColor = this.getUnusedColor(usedColors);
          usedColors.add(newColor.toLowerCase());
          const newAspect = await aspectService.createAspect(connection.user_id, {
            name: this.cleanCalendarName(calendarName),
            color: newColor,
            description: `Auto-created from ${providerLabel}: ${calendarName}`
          });
          if (newAspect) {
            await this.updateMapping(mapping.id, { aspect_id: newAspect.id });
            existingAspects = [...existingAspects, newAspect];
            logger.info(`[CalendarMappingService] Created aspect "${newAspect.name}" for "${calendarName}"`);
          }
        }
      }
    } catch (error) {
      logger.error('[CalendarMappingService] Error auto-mapping calendars:', error);
    }
  }

  /**
   * Use LLM to intelligently map calendar names to existing aspects
   * or suggest creating new ones with clean names.
   */
  private async getLLMCalendarMappings(
    calendars: Array<{ name: string; isPrimary: boolean }>,
    existingAspects: Array<{ id: string; name: string }>
  ): Promise<Record<string, string | null>> {
    const openai = new OpenAI();

    const aspectList = existingAspects.length > 0
      ? existingAspects.map(a => `- "${a.name}" (id: ${a.id})`).join('\n')
      : '(No existing aspects yet)';

    const calendarList = calendars
      .map(c => `- "${c.name}"${c.isPrimary ? ' [PRIMARY]' : ''}`)
      .join('\n');

    const response = await openai.chat.completions.create({
      model: 'gpt-5.4-nano',
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: `You map Google/Outlook calendar names to life aspects (categories like Work, Health, Personal, Social, etc).

Rules:
1. Map each calendar to the best-fitting existing aspect if one matches semantically.
2. If no existing aspect fits, suggest a clean, short aspect name (2-3 words max).
3. For PRIMARY calendars (the user's main calendar): map to "Personal" if it exists, otherwise return null. Do NOT create an aspect from the user's email address.
4. Clean up messy calendar names: "ebf social calendar!!" -> "Social", "Du Bois Lab (Chem)" -> "Chemistry Lab", "PHYSICS 44" -> "Physics".
5. If a calendar name is just an email address, map to "Personal" or null.

Return JSON only, no markdown. Format:
{
  "calendar name": "existing:aspect-uuid" | "new:Clean Aspect Name" | null
}`
        },
        {
          role: 'user',
          content: `Existing aspects:\n${aspectList}\n\nCalendars to map:\n${calendarList}`
        }
      ]
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return {};

    try {
      return JSON.parse(content.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
    } catch {
      logger.warn('[CalendarMappingService] Failed to parse LLM response:', content);
      return {};
    }
  }

  /**
   * Auto-map a single calendar mapping to an aspect.
   * Used when a calendar is toggled ON outside of onboarding.
   * Uses LLM for intelligent mapping, falls back to synonym matching.
   */
  async autoMapSingleCalendar(userId: string, mapping: CalendarMapping): Promise<CalendarMapping> {
    try {
      if (mapping.aspect_id) return mapping;

      if (this.isNonUserCalendar(mapping.provider_calendar_id)) {
        return mapping;
      }

      const existingAspects = await aspectService.getAspects(userId);
      const usedColors = new Set<string>(
        existingAspects
          .map((a: { color?: string }) => a.color?.toLowerCase())
          .filter((c): c is string => c !== undefined)
      );

      const calendarName = mapping.provider_calendar_name || 'Calendar';

      // Try LLM mapping first
      try {
        const llmResult = await this.getLLMCalendarMappings(
          [{ name: calendarName, isPrimary: mapping.is_primary }],
          existingAspects.map(a => ({ id: a.id, name: a.name }))
        );
        const llmAspectId = llmResult[calendarName];

        if (llmAspectId === null && mapping.is_primary) {
          const personalAspect = existingAspects.find(a => a.name.toLowerCase() === 'personal');
          if (personalAspect) {
            await this.updateMapping(mapping.id, { aspect_id: personalAspect.id });
            return { ...mapping, aspect_id: personalAspect.id };
          }
          return mapping;
        }

        if (llmAspectId?.startsWith('existing:')) {
          const aspectId = llmAspectId.replace('existing:', '');
          await this.updateMapping(mapping.id, { aspect_id: aspectId });
          return { ...mapping, aspect_id: aspectId };
        }

        if (llmAspectId?.startsWith('new:')) {
          const cleanName = llmAspectId.replace('new:', '');
          const newColor = this.getUnusedColor(usedColors);
          const newAspect = await aspectService.createAspect(userId, {
            name: cleanName,
            color: newColor,
            description: `Auto-created from calendar: ${calendarName}`
          });
          if (newAspect) {
            await this.updateMapping(mapping.id, { aspect_id: newAspect.id });
            return { ...mapping, aspect_id: newAspect.id };
          }
        }
      } catch {
        logger.warn('[CalendarMappingService] LLM mapping failed for single calendar, using fallback');
      }

      // Fallback: synonym matching
      const matchedAspect = this.findMatchingAspect(calendarName, existingAspects);
      if (matchedAspect) {
        await this.updateMapping(mapping.id, { aspect_id: matchedAspect.id });
        return { ...mapping, aspect_id: matchedAspect.id };
      }

      const newColor = this.getUnusedColor(usedColors);
      const newAspect = await aspectService.createAspect(userId, {
        name: this.cleanCalendarName(calendarName),
        color: newColor,
        description: `Auto-created from calendar: ${calendarName}`
      });

      if (newAspect) {
        await this.updateMapping(mapping.id, { aspect_id: newAspect.id });
        return { ...mapping, aspect_id: newAspect.id };
      }

      return mapping;
    } catch (error) {
      logger.error('[CalendarMappingService] Error auto-mapping single calendar:', error);
      return mapping;
    }
  }

  /**
   * Classify a calendar by its ID into: 'user', 'holiday', or 'skip'
   * - 'user': regular user calendars (should be aspect-mapped)
   * - 'holiday': holiday calendars (sync as all-day, no aspect mapping)
   * - 'skip': contacts, weather, other system calendars (don't sync)
   */
  private classifyCalendar(calendarId: string, provider?: string): 'user' | 'holiday' | 'skip' {
    if (provider === 'microsoft') return 'user';

    const id = calendarId.toLowerCase();

    if (id.includes('#holiday@')) return 'holiday';
    if (id.includes('#contacts@') || id.includes('#weather@') || id.includes('#other@')) return 'skip';
    if (id.endsWith('@group.v.calendar.google.com') && id.includes('#')) return 'skip';

    return 'user';
  }

  /**
   * Check if a calendar ID belongs to a non-user calendar (holidays, birthdays, contacts)
   */
  private isNonUserCalendar(calendarId: string, provider?: string): boolean {
    return this.classifyCalendar(calendarId, provider) !== 'user';
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
