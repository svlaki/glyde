import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SupabaseService } from "../../services/SupabaseService.js";
import { ZepGraphService } from "../../services/ZepGraphService.js";
import { CategoryService } from "../../services/CategoryService.js";
import { convertToUTC } from "../../utils/timezoneUtils.js";

export const updateEventTool = tool(
  async ({ eventId, searchQuery, title, startTime, endTime, location, description, category }, config) => {
    const userId = config?.configurable?.userId;
    const timezone = config?.configurable?.timezone;

    if (!userId) {
      throw new Error("User ID is required for updating events");
    }
    if (!timezone) {
      throw new Error("Timezone is required for updating events");
    }

    let targetEventId = eventId;

    // Initialize services
    const supabaseService = new SupabaseService();
    const zepGraphService = new ZepGraphService();
    const categoryService = new CategoryService();

    // If no eventId provided, search for the event using Zep and direct search
    if (!targetEventId && searchQuery) {
      console.log('[UPDATE-EVENT TOOL] Searching for event to update:', searchQuery);

      try {
        // Get all events and filter to recent ones (today + 14 days)
        const allEvents = await supabaseService.getEvents(userId);
        const now = new Date();
        const todayStart = new Date(now.toISOString().split('T')[0]);

        // Include events from today onwards only
        const recentEvents = allEvents.filter((event: any) => {
          const eventDate = new Date(event.start_time);
          return eventDate >= todayStart;
        });

        console.log(`[UPDATE-EVENT TOOL] Searching in ${recentEvents.length} recent events (today + 14 days)`);

        // Find matching events using fuzzy matching
        const normalizedQuery = searchQuery.toLowerCase().trim();
        const queryWords = normalizedQuery.split(/\s+/).filter(word =>
          word.length > 1 && !['the', 'a', 'an', 'for', 'to', 'in', 'on', 'at'].includes(word)
        );

        const matchingEvents = recentEvents.filter((event: any) => {
          const searchText = `${event.title} ${event.description || ''}`.toLowerCase();
          const hasMatch = queryWords.some(word => searchText.includes(word));
          const hasFullMatch = searchText.includes(normalizedQuery);
          return hasMatch || hasFullMatch;
        });

        // Sort by relevance and date
        matchingEvents.sort((a, b) => {
          const aTitle = a.title.toLowerCase();
          const bTitle = b.title.toLowerCase();
          const aMatches = queryWords.filter(word => aTitle.includes(word)).length;
          const bMatches = queryWords.filter(word => bTitle.includes(word)).length;

          if (bMatches === aMatches) {
            return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
          }
          return bMatches - aMatches;
        });

        if (matchingEvents.length === 0) {
          // Check if there are older matching events
          const olderMatches = allEvents.filter((event: any) => {
            const searchText = `${event.title} ${event.description || ''}`.toLowerCase();
            const hasMatch = queryWords.some(word => searchText.includes(word));
            const hasFullMatch = searchText.includes(normalizedQuery);
            return (hasMatch || hasFullMatch) && new Date(event.start_time) < todayStart;
          });

          if (olderMatches.length > 0) {
            throw new Error(`No upcoming events found matching "${searchQuery}". I found ${olderMatches.length} older event(s) with that name. Did you mean one of those? Please specify the date if you want to update an old event.`);
          }

          throw new Error(`No event found matching: "${searchQuery}"`);
        }

        if (matchingEvents.length > 1) {
          // Multiple matches - ask for clarification
          const eventsList = matchingEvents.slice(0, 5).map(e => {
            const eventDate = new Date(e.start_time).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            return `- ${e.title} on ${eventDate} at ${new Date(e.start_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
          }).join('\n');

          throw new Error(`Found ${matchingEvents.length} events matching "${searchQuery}". Which one should I update?\n${eventsList}`);
        }

        targetEventId = matchingEvents[0].id;
        console.log('[UPDATE-EVENT TOOL] Found event to update:', matchingEvents[0].title);
      } catch (error) {
        console.error('[UPDATE-EVENT TOOL] Search error:', error);
        throw new Error(`Failed to find event: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    if (!targetEventId) {
      throw new Error("No event ID provided and no search query given");
    }

    // Validate and ensure category exists (same as create-event)
    let validatedCategory = category;
    if (category && category.trim().length > 0) {
      try {
        console.log(`[UPDATE-EVENT TOOL] Validating category: "${category}"`);

        // Check if category exists
        let existingCategory = await categoryService.getCategoryByName(userId, category.trim());

        if (!existingCategory) {
          // Category doesn't exist, create it with a default color
          console.log(`[UPDATE-EVENT TOOL] Category "${category}" does not exist, creating it...`);
          const defaultColor = '#3b82f6'; // Blue
          existingCategory = await categoryService.createCategory(userId, {
            name: category.trim(),
            color: defaultColor,
            icon: undefined,
            description: `Auto-created for event: ${title || 'Event'}`
          });

          if (!existingCategory) {
            console.warn(`[UPDATE-EVENT TOOL] Failed to create category "${category}", will use it anyway`);
          } else {
            console.log(`[UPDATE-EVENT TOOL] Successfully created category: "${category}"`);
          }
        } else {
          console.log(`[UPDATE-EVENT TOOL] Category "${category}" already exists`);
        }

        validatedCategory = category.trim();
      } catch (error) {
        console.warn(`[UPDATE-EVENT TOOL] Error validating/creating category "${category}":`, error);
        // Continue with event update even if category validation fails
      }
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
        category: validatedCategory || undefined,
      }
    );

    if (!updatedEvent) {
      throw new Error("Failed to update event");
    }

    // Note: Automatic graph sync disabled to prevent Zep graph bloat
    // Individual event updates create too many nodes
    // Graph should only contain summary patterns, not every action
    // TODO: Implement selective sync only for significant events or via periodic aggregation

    // Add context about category updates in response
    const categoryContext = category
      ? ` (category: ${category})`
      : '';

    return `Event updated: "${title || updatedEvent.title}"${categoryContext}`;
  },
  {
    name: "update_event",
    description: "Update an existing calendar event. If eventId is not provided, use semantic search to find the event by description. Can update event category and details.",
    schema: z.object({
      eventId: z.string().optional().describe("Event ID to update (optional - if not provided, search by description)"),
      searchQuery: z.string().optional().describe("Search query to find the event if eventId is not provided (e.g., 'grocery trip', 'meeting with John', 'workout yesterday')"),
      title: z.string().optional().describe("New event title - leave empty to keep existing"),
      startTime: z.string().optional().describe("New start time in ISO format - leave empty to keep existing"),
      endTime: z.string().optional().describe("New end time in ISO format - leave empty to keep existing"),
      location: z.string().optional().describe("New event location - leave empty to keep existing"),
      description: z.string().optional().describe("New event description - leave empty to keep existing"),
      category: z.string().optional().describe("Update event category (e.g., 'Work', 'School', 'Health & Hygiene', 'Social', 'Personal'). Leave empty to keep existing category."),
    }),
  }
);