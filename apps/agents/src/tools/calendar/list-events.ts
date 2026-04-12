import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SupabaseService } from "../../services/SupabaseService.js";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { toDate } from "date-fns";

/**
 * Convert a naive local datetime string to UTC ISO string.
 * The model sends dates like "2026-04-07T00:00:00" meaning midnight in the user's timezone,
 * but the DB stores everything in UTC. Without conversion, a Pacific user's "today" query
 * would cut off at 5 PM local time (midnight UTC).
 */
function localToUtc(dateStr: string, timezone: string): string {
  // If already has timezone info (Z or +/-offset), use as-is
  if (/[Zz]$/.test(dateStr) || /[+-]\d{2}:\d{2}$/.test(dateStr)) {
    return new Date(dateStr).toISOString();
  }
  // Treat as local time in the user's timezone and convert to UTC
  return fromZonedTime(dateStr, timezone).toISOString();
}

export const listEventsTool = tool(
  async ({ startDate, endDate, limit, includePast }, config) => {
    const userId = config?.configurable?.userId;
    const timezone = config?.configurable?.timezone || 'America/Los_Angeles';
    const effectiveLimit = limit ?? 20;

    if (!userId) {
      throw new Error("User ID is required for listing events");
    }

    console.log('[LIST-EVENTS TOOL] Listing events:', { startDate, endDate, limit: effectiveLimit, includePast });

    const supabaseService = new SupabaseService();

    // Convert naive local dates to UTC so the DB query covers the correct range
    const utcStart = startDate ? localToUtc(startDate, timezone) : undefined;
    const utcEnd = endDate ? localToUtc(endDate, timezone) : undefined;

    if (startDate && utcStart !== startDate) {
      console.log(`[LIST-EVENTS TOOL] Converted date range: ${startDate} -> ${utcStart}, ${endDate} -> ${utcEnd} (tz: ${timezone})`);
    }

    // Get events (with recurring events expanded)
    let events;
    if (utcStart && utcEnd) {
      events = await supabaseService.getEvents(userId, utcStart, utcEnd);
    } else {
      events = await supabaseService.getEvents(userId);

      if (!includePast) {
        const now = new Date();
        events = events.filter((event: any) => new Date(event.end_time) >= now);
      }
    }

    if (events.length === 0) {
      const dateRange = startDate && endDate ? ` between ${new Date(startDate).toLocaleDateString()} and ${new Date(endDate).toLocaleDateString()}` : '';
      return `No events found${dateRange}`;
    }

    events.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    const limitedEvents = events.slice(0, effectiveLimit);

    // Use compact format matching CALENDAR context so agent can use #IDs consistently
    const eventList = limitedEvents.map(event => {
      const start = toDate(event.start_time);
      const end = toDate(event.end_time);
      const dateStr = formatInTimeZone(start, timezone, 'EEE M/d');
      const startTime = formatInTimeZone(start, timezone, 'h:mma').toLowerCase();
      const endTime = formatInTimeZone(end, timezone, 'h:mma').toLowerCase();
      const loc = event.location ? ` @${event.location}` : '';
      const aspect = (event as any).aspect_name || (event as any).aspect;
      const aspectLabel = aspect ? ` [${aspect}]` : '';
      const recurring = (event as any).is_recurring ? ' (recurring)' : '';
      return `- "${event.title}" ${dateStr} ${startTime}-${endTime}${loc}${aspectLabel}${recurring} #${event.id}`;
    });

    const totalText = events.length > effectiveLimit ? ` (showing ${effectiveLimit} of ${events.length})` : '';
    return `EVENTS${totalText}:\n${eventList.join('\n')}\n\nUse the #ID to perform actions on these events.`;
  },
  {
    name: "list_events",
    description: "List calendar events by date range. Returns events with #IDs for use with action tools.",
    schema: z.object({
      startDate: z.string().optional().nullable().describe("Start date ISO"),
      endDate: z.string().optional().nullable().describe("End date ISO"),
      limit: z.number().optional().nullable().describe("Max results (default: 20)"),
      includePast: z.boolean().optional().nullable().describe("Include past events"),
    }),
  }
);