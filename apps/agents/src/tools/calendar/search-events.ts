import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SupabaseService } from "../../services/SupabaseService.js";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { toDate } from "date-fns";

/**
 * Convert a naive local datetime string to UTC ISO string.
 */
function localToUtc(dateStr: string, timezone: string): string {
  if (/[Zz]$/.test(dateStr) || /[+-]\d{2}:\d{2}$/.test(dateStr)) {
    return new Date(dateStr).toISOString();
  }
  return fromZonedTime(dateStr, timezone).toISOString();
}

/**
 * Format events in the same compact format used by the system prompt CALENDAR context.
 * This lets the agent treat search results identically to its built-in event context.
 */
function formatCompactEvent(event: any, timezone: string): string {
  const startDate = toDate(event.start_time);
  const endDate = toDate(event.end_time);
  const dateStr = formatInTimeZone(startDate, timezone, 'EEE M/d');
  const startTime = formatInTimeZone(startDate, timezone, 'h:mma').toLowerCase();
  const endTime = formatInTimeZone(endDate, timezone, 'h:mma').toLowerCase();
  const loc = event.location ? ` @${event.location}` : '';
  const aspect = event.aspect_name || event.aspect;
  const aspectLabel = aspect ? ` [${aspect}]` : '';
  const recurring = event.is_recurring ? ' (recurring)' : '';
  return `- "${event.title}" ${dateStr} ${startTime}-${endTime}${loc}${aspectLabel}${recurring} #${event.id}`;
}

export const searchEventsTool = tool(
  async ({ query, aspect, startDate, endDate, limit, includePast }, config) => {
    const userId = config?.configurable?.userId;
    const timezone = config?.configurable?.timezone || 'America/Los_Angeles';
    const effectiveLimit = limit ?? 20;

    if (!userId) {
      throw new Error("User ID is required for searching events");
    }

    console.log('🔍 [SEARCH-EVENTS TOOL] Searching:', { query, aspect, startDate, endDate, limit: effectiveLimit, includePast });

    try {
      const supabaseService = new SupabaseService();

      // Convert naive local dates to UTC so the DB query covers the correct range
      const utcStart = startDate ? localToUtc(startDate, timezone) : undefined;
      const utcEnd = endDate ? localToUtc(endDate, timezone) : undefined;

      // Use getEvents() which properly expands recurring instances
      let events = await supabaseService.getEvents(
        userId,
        utcStart,
        utcEnd
      );

      // Filter out past events unless includePast is true
      if (!includePast && !startDate) {
        const now = new Date();
        events = events.filter((event: any) => new Date(event.end_time) >= now);
      }

      // Apply aspect filter (case-insensitive, strips emoji icons)
      if (aspect) {
        const normalizedAspect = aspect.replace(/[\p{Emoji}\s]+/gu, '').trim().toLowerCase();
        events = events.filter((event: any) => {
          const eventAspect = (event.aspect_name || event.aspect || '').toLowerCase();
          return eventAspect === normalizedAspect || eventAspect.includes(normalizedAspect);
        });
      }

      if (events.length === 0) {
        const aspectFilter = aspect ? ` in aspect "${aspect}"` : '';
        const dateFilter = startDate ? ` in the specified date range` : '';
        return `No events found${aspectFilter}${dateFilter}.`;
      }

      // Sort by start time
      events.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

      // Apply limit
      const limitedEvents = events.slice(0, effectiveLimit);

      // Format in compact style matching the system prompt CALENDAR context
      const formatted = limitedEvents.map(e => formatCompactEvent(e, timezone));

      const totalText = events.length > effectiveLimit ? ` (showing ${effectiveLimit} of ${events.length})` : '';
      const queryContext = query ? ` for "${query}"` : '';
      return `EVENTS${queryContext}${totalText}:\n${formatted.join('\n')}\n\nUse the #ID to perform actions on these events.`;

    } catch (error) {
      console.error('[SEARCH-EVENTS TOOL] Error:', error);
      throw new Error(`Failed to search events: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
  {
    name: "search_events",
    description: "Search/list calendar events. Returns events with #IDs for use with action tools. Use when user asks about events outside your CALENDAR context.",
    schema: z.object({
      query: z.string().optional().nullable().describe("Search query (agent filters results semantically)"),
      aspect: z.string().optional().nullable().describe("Filter by aspect name"),
      startDate: z.string().optional().nullable().describe("Start date ISO to scope search"),
      endDate: z.string().optional().nullable().describe("End date ISO to scope search"),
      limit: z.number().optional().nullable().describe("Max results (default: 20)"),
      includePast: z.boolean().optional().nullable().describe("Include past events"),
    }),
  }
);
