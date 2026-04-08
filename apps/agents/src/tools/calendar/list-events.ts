import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SupabaseService } from "../../services/SupabaseService.js";
import { formatInTimeZone } from "date-fns-tz";
import { toDate } from "date-fns";

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

    // Get events (with recurring events expanded)
    let events;
    if (startDate && endDate) {
      events = await supabaseService.getEvents(userId, startDate, endDate);
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