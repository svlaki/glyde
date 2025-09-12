import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SupabaseService } from "../../services/SupabaseService.js";

const supabaseService = new SupabaseService();

export const createEventTool = tool(
  async ({ title, startTime, endTime, location, description, archetype, archetype_data }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      throw new Error("User ID is required for creating events");
    }

    console.log('🔧 [CREATE-EVENT TOOL] Starting event creation:', { title, startTime, endTime, archetype });

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
      console.error('🚨 [CREATE-EVENT TOOL] Error checking for conflicts:', error);
      // Continue with event creation if conflict check fails
    }

    // Create the event with archetype data if detected
    console.log('🔄 [CREATE-EVENT TOOL] Calling supabaseService.createEvent...');
    const event = await supabaseService.createEvent(userId, {
      event_title: title,
      event_starts_at: startTime,
      event_ends_at: endTime,
      event_location: location || "",
      event_description: description || "",
      archetype: archetype || 'generic',
      archetype_data: archetype_data || {}
    });

    console.log('📋 [CREATE-EVENT TOOL] SupabaseService returned:', event ? 'SUCCESS' : 'NULL');
    
    if (!event) {
      console.error('❌ [CREATE-EVENT TOOL] Event creation failed - supabaseService.createEvent returned null');
      throw new Error("Failed to create event - database operation returned null. Check server logs for details.");
    }

    console.log('✅ [CREATE-EVENT TOOL] Event created successfully:', event.id);

    // Persist to Zep memory asynchronously (fire-and-forget for speed)
    const persistToZep = async () => {
      try {
        console.log('🧠 [CREATE-EVENT TOOL] Persisting to Zep (async)...');
        const { ZepMemoryService } = await import('../../services/ZepMemoryService.js');
        const zepService = new ZepMemoryService();
        
        await zepService.addCalendarEvent(userId, {
          title,
          description: description || undefined,
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          location: location || undefined,
          archetype: archetype || 'generic',
          archetypeData: archetype_data || {}
        });
        
        console.log(`✅ [CREATE-EVENT TOOL] Event persisted to Zep with archetype: ${archetype}`);
      } catch (error) {
        console.error('⚠️ [CREATE-EVENT TOOL] Failed to persist event to Zep (non-critical):', error);
      }
    };

    // Fire and forget - don't await this
    persistToZep();

    // Add context about detected archetype in response
    const archetypeContext = archetype && archetype !== 'generic' 
      ? ` with smart ${archetype} details` 
      : '';

    return `✅ Event created successfully: "${title}" at ${new Date(startTime).toLocaleString()}${archetypeContext}`;
  },
  {
    name: "create_event",
    description: "Create a new calendar event with intelligent archetype detection. Parse natural language into structured event data and detect event types automatically. Extract relevant structured data based on context.",
    schema: z.object({
      title: z.string().describe("Event title extracted from user input or inferred from context. Make it descriptive and clear."),
      startTime: z.string().describe("Start time in ISO format. Parse relative dates like 'tomorrow', '1pm', 'Friday' into proper timestamps. Use intelligent time defaults: breakfast=morning, lunch=midday, dinner=evening, meetings=business hours"),
      endTime: z.string().describe("End time in ISO format. If not specified, add 1 hour to start time"),
      location: z.string().nullable().describe("Event location. Leave empty if not specified"),
      description: z.string().nullable().describe("Event description. Leave empty if not specified"),
      archetype: z.enum(['grocery', 'meeting', 'workout', 'appointment', 'travel', 'work_focus', 'personal', 'generic']).nullable()
        .describe("Intelligently detect the event type based on context clues in the user's message. Use 'generic' if no specific type is detected."),
      archetype_data: z.record(z.any()).nullable()
        .describe("Extract and structure relevant data based on the detected archetype. For grocery: shopping_list with items. For meeting: attendees and agenda. For workout: exercises and intensity. For appointment: provider details. For travel: destination and transportation. Leave empty if generic.")
    }),
  }
);;;;;;