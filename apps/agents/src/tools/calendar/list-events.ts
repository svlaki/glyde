import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SupabaseService } from "../../services/SupabaseService.js";
import { formatEventTime } from "../../utils/timezoneUtils.js";

export const listEventsTool = tool(
  async ({ startDate, endDate, limit, includePast }, config) => {
    const userId = config?.configurable?.userId;
    const timezone = config?.configurable?.timezone;
    const effectiveLimit = limit ?? 20;

    if (!userId) {
      throw new Error("User ID is required for listing events");
    }
    if (!timezone) {
      throw new Error("Timezone is required for listing events");
    }

    console.log('📋 [LIST-EVENTS TOOL] Listing events:', { startDate, endDate, limit: effectiveLimit, includePast });

    // Initialize service
    const supabaseService = new SupabaseService();

    // Get events as UTC
    let events;
    if (startDate && endDate) {
      events = await supabaseService.getEvents(userId, startDate, endDate);
    } else {
      events = await supabaseService.getEvents(userId);

      // Filter out past events unless includePast is true (includes ongoing multi-day events)
      if (!includePast) {
        const now = new Date();
        events = events.filter((event: any) => new Date(event.end_time) >= now);
        console.log(`📋 [LIST-EVENTS TOOL] Filtered to ${events.length} future/ongoing events`);
      }
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
      const categoryLabel = event.category ? `\n   🏷️ ${event.category}` : '';

      return `📅 ${event.title}\n   ⏰ ${eventTime}${event.location ? `\n   📍 ${event.location}` : ''}${categoryLabel}\n   ID: ${event.id}`;
    });

    const totalText = events.length > effectiveLimit ? ` (showing first ${effectiveLimit} of ${events.length})` : '';
    return `Your upcoming events${totalText}:\n\n${eventList.join('\n\n')}`;
  },
  {
    name: "list_events",
    description: "List calendar events, optionally filtered by date range. By default shows only future/ongoing events when no date range specified. Use includePast=true to show historical events. Shows events in chronological order.",
    schema: z.object({
      startDate: z.string().optional().nullable().describe("Start date for filtering events (ISO format)"),
      endDate: z.string().optional().nullable().describe("End date for filtering events (ISO format)"),
      limit: z.number().optional().nullable().describe("Maximum number of events to return (default: 20)"),
      includePast: z.boolean().optional().nullable().describe("Optional: Set to true to include past events when no date range specified. Default is false (only future/ongoing events). Use true when user asks about history."),
    }),
  }
);