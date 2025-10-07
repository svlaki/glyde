import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SupabaseService } from "../../services/SupabaseService.js";
import { formatEventTime } from "../../utils/timezoneUtils.js";

export const listEventsTool = tool(
  async ({ startDate, endDate, limit }, config) => {
    const userId = config?.configurable?.userId;
    const timezone = config?.configurable?.timezone;
    const effectiveLimit = limit ?? 20;

    if (!userId) {
      throw new Error("User ID is required for listing events");
    }
    if (!timezone) {
      throw new Error("Timezone is required for listing events");
    }

    // Initialize service
    const supabaseService = new SupabaseService();

    // Get events as UTC
    let events;
    if (startDate && endDate) {
      events = await supabaseService.getEvents(userId, startDate, endDate);
    } else {
      events = await supabaseService.getEvents(userId);
    }

    if (events.length === 0) {
      const dateRange = startDate && endDate ? ` between ${new Date(startDate).toLocaleDateString()} and ${new Date(endDate).toLocaleDateString()}` : '';
      return `No events found${dateRange}`;
    }

    // Sort by start time (UTC)
    events.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

    // Take only the requested limit
    const limitedEvents = events.slice(0, effectiveLimit);

    const eventList = limitedEvents.map(event => {
      // Format UTC times for user's timezone
      const eventTime = formatEventTime(event.start_time, timezone);

      return `📅 ${event.title}\n   ⏰ ${eventTime}${event.location ? `\n   📍 ${event.location}` : ''}`;
    });

    const totalText = events.length > effectiveLimit ? ` (showing first ${effectiveLimit} of ${events.length})` : '';
    return `Your upcoming events${totalText}:\n\n${eventList.join('\n\n')}`;
  },
  {
    name: "list_events",
    description: "List calendar events, optionally filtered by date range. Shows events in chronological order.",
    schema: z.object({
      startDate: z.string().nullable().describe("Start date for filtering events (ISO format)"),
      endDate: z.string().nullable().describe("End date for filtering events (ISO format)"),
      limit: z.number().nullable().optional().describe("Maximum number of events to return (default: 20)"),
    }),
  }
);