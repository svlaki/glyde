import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SupabaseService } from "../../services/SupabaseService.js";

const supabaseService = new SupabaseService();

export const createEventTool = tool(
  async ({ title, startTime, endTime, location, description }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      throw new Error("User ID is required for creating events");
    }

    // Check for conflicts BEFORE creating the event
    const { CalendarIntelligenceService } = await import('../../services/CalendarIntelligenceService.js');
    const intelligenceService = new CalendarIntelligenceService(userId);
    
    try {
      const conflictCheck = await intelligenceService.checkConflicts(
        new Date(startTime),
        new Date(endTime)
      );
      
      if (conflictCheck.hasConflict && conflictCheck.conflictingEvents.length > 0) {
        const conflictingEvent = conflictCheck.conflictingEvents[0];
        const conflictStartTime = new Date(conflictingEvent.start_time).toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit', 
          hour12: true 
        });
        const conflictEndTime = new Date(conflictingEvent.end_time).toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit', 
          hour12: true 
        });
        
        return `⚠️ Time conflict detected! You already have "${conflictingEvent.title}" scheduled from ${conflictStartTime} to ${conflictEndTime}. ${conflictCheck.suggestion || 'Please choose a different time or let me know if you\'d like to reschedule the existing event.'}`;
      }
    } catch (error) {
      console.error('Error checking for conflicts:', error);
      // Continue with event creation if conflict check fails
    }

    // Create the event if no conflicts
    const event = await supabaseService.createEvent(userId, {
      event_title: title,
      event_starts_at: startTime,
      event_ends_at: endTime,
      event_location: location || "",
      event_description: description || "",
    });

    if (!event) {
      throw new Error("Failed to create event");
    }

    return `Event created: "${title}" at ${new Date(startTime).toLocaleString()}`;
  },
  {
    name: "create_event",
    description: "Create a new calendar event. Parse natural language into structured event data. Use smart defaults for missing information. Be intelligent about time defaults based on event type.",
    schema: z.object({
      title: z.string().describe("Event title extracted from user input or inferred from context"),
      startTime: z.string().describe("Start time in ISO format. Parse relative dates like 'tomorrow', '1pm', 'Friday' into proper timestamps. Use intelligent time defaults: breakfast=morning, lunch=midday, dinner=evening, meetings=business hours"),
      endTime: z.string().describe("End time in ISO format. If not specified, add 1 hour to start time"),
      location: z.string().nullable().describe("Event location. Leave empty if not specified"),
      description: z.string().nullable().describe("Event description. Leave empty if not specified"),
    }),
  }
);;