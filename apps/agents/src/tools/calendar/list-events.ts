import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SupabaseService } from "../../services/SupabaseService.js";

const supabaseService = new SupabaseService();

export const listEventsTool = tool(
  async ({ startDate, endDate, limit = 20 }, config) => {
    const userId = config?.configurable?.userId;
    const userTimezone = config?.configurable?.timezone || 'UTC';
    
    if (!userId) {
      throw new Error("User ID is required for listing events");
    }

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

    // Sort by start time
    events.sort((a, b) => new Date(a.event_starts_at).getTime() - new Date(b.event_starts_at).getTime());

    // Take only the requested limit
    const limitedEvents = events.slice(0, limit);

    const eventList = limitedEvents.map(event => {
      // Convert UTC times from database to user's local timezone
      const startDate = new Date(event.event_starts_at);
      const endDate = new Date(event.event_ends_at);
      
      const startTime = startDate.toLocaleTimeString('en-US', { 
        timeZone: userTimezone,
        hour: 'numeric', 
        minute: '2-digit', 
        hour12: true 
      });
      const endTime = endDate.toLocaleTimeString('en-US', { 
        timeZone: userTimezone,
        hour: 'numeric', 
        minute: '2-digit', 
        hour12: true 
      });
      
      return `📅 ${event.event_title}\n   ⏰ ${startTime} - ${endTime}${event.event_location ? `\n   📍 ${event.event_location}` : ''}`;
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