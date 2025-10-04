import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SupabaseService } from "../../services/SupabaseService.js";

export const listEventsTool = tool(
  async ({ startDate, endDate, limit = 20 }, config) => {
    const userId = config?.configurable?.userId;
    
    if (!userId) {
      throw new Error("User ID is required for listing events");
    }

    // Initialize service
    const supabaseService = new SupabaseService();

    let events;

    if (startDate && endDate) {
      events = await supabaseService.getEventsForAgent(userId, startDate, endDate);
    } else {
      events = await supabaseService.getEventsForAgent(userId);
    }

    if (events.length === 0) {
      const dateRange = startDate && endDate ? ` between ${new Date(startDate).toLocaleDateString()} and ${new Date(endDate).toLocaleDateString()}` : '';
      return `No events found${dateRange}`;
    }

    // Sort by start time
    events.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

    // Take only the requested limit
    const limitedEvents = events.slice(0, limit);

    const eventList = limitedEvents.map(event => {
      // Events are already converted to local timezone by SupabaseService.getEventsForAgent
      const startDate = new Date(event.start_time);
      const endDate = new Date(event.end_time);

      const startTime = startDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      const endTime = endDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });

      return `📅 ${event.title}\n   ⏰ ${startTime} - ${endTime}${event.location ? `\n   📍 ${event.location}` : ''}`;
    });

    const totalText = events.length > limit ? ` (showing first ${limit} of ${events.length})` : '';
    return `Your upcoming events${totalText}:\n\n${eventList.join('\n\n')}`;
  },
  {
    name: "list_events",
    description: "List calendar events, optionally filtered by date range. Shows events in chronological order.",
    schema: z.object({
      startDate: z.string().nullable().describe("Start date for filtering events (ISO format)"),
      endDate: z.string().nullable().describe("End date for filtering events (ISO format)"),
      limit: z.number().optional().describe("Maximum number of events to return (default: 20)"),
    }),
  }
);