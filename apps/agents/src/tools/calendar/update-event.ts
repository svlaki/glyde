import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SupabaseService } from "../../services/SupabaseService.js";
import { ZepGraphService } from "../../services/ZepGraphService.js";
import { AspectService } from "../../services/AspectService.js";
import { convertToUTC } from "../../utils/timezoneUtils.js";
import reminderService from "../../services/ReminderService.js";

export const updateEventTool = tool(
  async ({ eventId, searchQuery, currentStartTime, title, startTime, endTime, location, description, aspect, reflection, isMissed, reminderMinutes }, config) => {
    const userId = config?.configurable?.userId;
    const timezone = config?.configurable?.timezone;

    if (!userId) {
      return "User ID is required for updating events. Please try again.";
    }
    if (!timezone) {
      return "Timezone is required for updating events. Please try again.";
    }

    let targetEventId = eventId;

    // Initialize services
    const supabaseService = new SupabaseService();
    const zepGraphService = new ZepGraphService();
    const aspectService = new AspectService();

    // If no eventId provided, search for the event using Zep and direct search
    if (!targetEventId && searchQuery) {
      console.log('[UPDATE-EVENT TOOL] Searching for event to update:', searchQuery);

      try {
        // Get all events and filter to upcoming ones
        // We include ALL future events to ensure "tomorrow" events are found regardless of timezone
        const allEvents = await supabaseService.getEvents(userId);
        const now = new Date();

        // Use current UTC time minus 24 hours to ensure we don't miss events
        // that might appear as "today" in the user's timezone but are technically
        // "yesterday" in UTC (e.g., late night events in US timezones)
        const cutoffTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        console.log(`[UPDATE-EVENT TOOL] Filtering events from ${cutoffTime.toISOString()} onwards`);
        console.log(`[UPDATE-EVENT TOOL] Total events before filter: ${allEvents.length}`);

        // Include events from cutoff onwards (gives 24h buffer for timezone differences)
        const recentEvents = allEvents.filter((event: any) => {
          const eventDate = new Date(event.start_time);
          return eventDate >= cutoffTime;
        });

        console.log(`[UPDATE-EVENT TOOL] Events after filter: ${recentEvents.length}`);

        // Find matching events using fuzzy matching
        const normalizedQuery = searchQuery.toLowerCase().trim();
        const queryWords = normalizedQuery.split(/\s+/).filter(word =>
          word.length > 1 && !['the', 'a', 'an', 'for', 'to', 'in', 'on', 'at'].includes(word)
        );

        let matchingEvents = recentEvents.filter((event: any) => {
          const searchText = `${event.title} ${event.description || ''}`.toLowerCase();
          const hasMatch = queryWords.some(word => searchText.includes(word));
          const hasFullMatch = searchText.includes(normalizedQuery);
          return hasMatch || hasFullMatch;
        });

        // If currentStartTime is provided, filter to events starting at that exact time
        if (currentStartTime && matchingEvents.length > 1) {
          const targetTime = new Date(currentStartTime).getTime();
          const timeFilteredEvents = matchingEvents.filter((event: any) => {
            const eventTime = new Date(event.start_time).getTime();
            // Allow 1 minute tolerance for time matching
            return Math.abs(eventTime - targetTime) < 60000;
          });

          if (timeFilteredEvents.length > 0) {
            matchingEvents = timeFilteredEvents;
            console.log(`[UPDATE-EVENT TOOL] Filtered to ${matchingEvents.length} event(s) by currentStartTime: ${currentStartTime}`);
          }
        }

        if (matchingEvents.length === 0) {
          return `No event found matching: "${searchQuery}". Please check the event name and try again.`;
        }

        if (matchingEvents.length > 1) {
          // Multiple matches - ask for clarification with IDs so agent can be precise
          const eventsList = matchingEvents.slice(0, 5).map(e => {
            const eventDate = new Date(e.start_time).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            const eventTime = new Date(e.start_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            return `- ${e.title} on ${eventDate} at ${eventTime} (ID: ${e.id})`;
          }).join('\n');

          throw new Error(`Found ${matchingEvents.length} events matching "${searchQuery}". Which one should I update? Use the eventId parameter or currentStartTime for precision:\n${eventsList}`);
        }

        targetEventId = matchingEvents[0].id;
        console.log('[UPDATE-EVENT TOOL] Found event to update:', matchingEvents[0].title);
      } catch (error) {
        console.error('[UPDATE-EVENT TOOL] Search error:', error);
        return `Failed to find event: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    }

    if (!targetEventId) {
      return "No event ID provided and no search query given. Please specify which event to update.";
    }

    // Get original event to compare changes
    const events = await supabaseService.getEvents(userId);
    const originalEvent = events.find((e: any) => e.id === targetEventId);

    // Check if this is a recurring event instance
    if (originalEvent?.is_instance && originalEvent?.parent_event_id) {
      console.log(`[UPDATE-EVENT TOOL] Detected recurring event instance`);

      // For time changes on a recurring instance, guide user to use update_recurring_event
      if (startTime || endTime) {
        const instanceDate = new Date(originalEvent.start_time).toLocaleDateString('en-US', {
          weekday: 'long', month: 'long', day: 'numeric'
        });
        return `"${originalEvent.title}" on ${instanceDate} is part of a recurring series. To change the time:\n` +
          `- To reschedule just THIS instance: Use update_recurring_event with scope 'this_instance'\n` +
          `- To reschedule ALL instances: Use update_recurring_event with scope 'entire_series'\n\n` +
          `I can update the title, description, location, or aspect for the entire series if you'd like.`;
      }

      // Reflection and is_missed are per-instance -- create an override event for this instance
      if (reflection !== undefined || isMissed !== undefined) {
        console.log(`[UPDATE-EVENT TOOL] Per-instance update (reflection/missed) for recurring instance`);
        const instanceUpdates: any = {};
        if (reflection !== undefined) instanceUpdates.reflection = reflection;
        if (isMissed !== undefined) instanceUpdates.is_missed = isMissed;

        const updatedInstance = await supabaseService.updateRecurringEventInstance(
          userId,
          originalEvent.parent_event_id,
          originalEvent.start_time,
          instanceUpdates
        );
        if (updatedInstance) {
          const parts: string[] = [];
          if (reflection !== undefined) parts.push('reflection updated');
          if (isMissed !== undefined) parts.push(isMissed ? 'marked as missed' : 'marked as attended');
          return `EVENT: "${originalEvent.title}" - ${parts.join(', ')} (this instance only)`;
        }
        return "Failed to update recurring event instance.";
      }

      // For metadata changes (title, description, location, aspect), update the parent (affects all instances)
      console.log(`[UPDATE-EVENT TOOL] Updating parent recurring event: ${originalEvent.parent_event_id}`);
      targetEventId = originalEvent.parent_event_id;
    }

    // Convert local times to UTC for storage (same as create-event)
    const startTimeUTC = startTime ? convertToUTC(startTime, timezone) : undefined;
    const endTimeUTC = endTime ? convertToUTC(endTime, timezone) : undefined;

    if (startTimeUTC || endTimeUTC) {
      console.log(`[UPDATE-EVENT TOOL] Timezone conversion - ${startTime} -> ${startTimeUTC}`);
    }

    const updatedEvent = await supabaseService.updateEvent(
      userId,
      targetEventId,
      {
        title: title || undefined,
        start_time: startTimeUTC,
        end_time: endTimeUTC,
        location: location || undefined,
        description: description || undefined,
        aspect: aspect || undefined,
        reflection: reflection !== undefined && reflection !== null ? reflection : undefined,
        is_missed: isMissed !== undefined && isMissed !== null ? isMissed : undefined,
        reminder_minutes: reminderMinutes !== undefined ? (reminderMinutes ?? null) : undefined,
      },
      { source: 'agent', agentType: 'conversation' }
    );

    if (!updatedEvent) {
      // Return error message instead of throwing to prevent LLM retry loops
      return "Failed to update event. The event may have been deleted or you may not have permission to modify it.";
    }

    // Sync reminder if reminderMinutes was changed
    if (reminderMinutes !== undefined && updatedEvent) {
      await reminderService.syncEventReminder(
        userId, updatedEvent.id, updatedEvent.title, updatedEvent.start_time,
        reminderMinutes, updatedEvent.aspect_id || undefined
      );
    }

    // Note: Automatic graph sync disabled to prevent Zep graph bloat
    // Individual event updates create too many nodes
    // Graph should only contain summary patterns, not every action
    // TODO: Implement selective sync only for significant events or via periodic aggregation

    // Build detailed change description
    const changes: string[] = [];
    const eventTitle = title || updatedEvent.title || originalEvent?.title || 'Event';

    if (title && originalEvent?.title !== title) {
      changes.push(`renamed to "${title}"`);
    }
    if (startTimeUTC || endTimeUTC) {
      const newStartDate = new Date(updatedEvent.start_time);
      const newEndDate = new Date(updatedEvent.end_time);
      const dateStr = newStartDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
      const startTimeStr = newStartDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      const endTimeStr = newEndDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      changes.push(`moved to ${dateStr} from ${startTimeStr} to ${endTimeStr}`);
    }
    if (aspect && originalEvent?.aspect !== aspect) {
      changes.push(`aspect changed to "${aspect}"`);
    }
    if (location && originalEvent?.location !== location) {
      changes.push(`location changed to "${location}"`);
    }
    if (reflection !== undefined && reflection !== null) {
      changes.push('reflection updated');
    }
    if (isMissed !== undefined && isMissed !== null) {
      changes.push(isMissed ? 'marked as missed' : 'marked as attended');
    }
    if (reminderMinutes !== undefined) {
      changes.push(reminderMinutes != null ? `reminder set to ${reminderMinutes} min before` : 'reminder removed');
    }

    const changeDescription = changes.length > 0 ? ` - ${changes.join(', ')}` : '';

    return `EVENT: "${eventTitle}" has been updated${changeDescription}`;
  },
  {
    name: "update_event",
    description: "Update an existing calendar event. Use eventId for precision when available. If eventId is not provided, use searchQuery with optional currentStartTime to disambiguate same-named events. Can update event aspect and details.",
    schema: z.object({
      eventId: z.string().optional().nullable().describe("Event ID to update (preferred - use this when you have the ID from a previous search or list)"),
      searchQuery: z.string().optional().nullable().describe("Search query to find the event if eventId is not provided (e.g., 'grocery trip', 'meeting with John', 'workout yesterday')"),
      currentStartTime: z.string().optional().nullable().describe("Current start time of the event in ISO format - use this to disambiguate when multiple events have the same name (e.g., '2024-01-15T21:56:00')"),
      title: z.string().optional().nullable().describe("New event title - leave empty to keep existing"),
      startTime: z.string().optional().nullable().describe("New start time in ISO format - leave empty to keep existing"),
      endTime: z.string().optional().nullable().describe("New end time in ISO format - leave empty to keep existing"),
      location: z.string().optional().nullable().describe("New event location - leave empty to keep existing"),
      description: z.string().optional().nullable().describe("New event description or notes. For Google-synced events, this is saved as local Glyde notes that persist across syncs. Leave empty to keep existing."),
      aspect: z.string().optional().nullable().describe("Update event aspect (e.g., 'Work', 'School', 'Health & Hygiene', 'Social', 'Personal'). Leave empty to keep existing aspect."),
      reflection: z.string().optional().nullable().describe("Set or update the reflection for a past event - what happened, how it went, takeaways. Only for events that have already ended."),
      isMissed: z.boolean().optional().nullable().describe("Mark whether the user missed this event. Set to true when user says they didn't attend, false to clear."),
      reminderMinutes: z.number().int().min(0).max(10080).optional().nullable().describe("Set or update reminder. Minutes before the event to send a notification. Common values: 5, 10, 15, 30, 60, 1440. Set to null to remove reminder."),
    }),
  }
);