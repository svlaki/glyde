import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SupabaseService } from "../../services/SupabaseService.js";
import { ZepGraphService } from "../../services/ZepGraphService.js";
import { CategoryService } from "../../services/CategoryService.js";

export const bulkUpdateEventsTool = tool(
  async ({ searchQuery, eventIds, category, title, location, description }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      throw new Error("User ID is required for bulk updating events");
    }

    // Validate that at least one update field is provided (empty strings and null don't count)
    const hasCategory = category !== undefined && category !== null && category !== '';
    const hasTitle = title !== undefined && title !== null && title !== '';
    const hasLocation = location !== undefined && location !== null && location !== '';
    const hasDescription = description !== undefined && description !== null && description !== '';

    if (!hasCategory && !hasTitle && !hasLocation && !hasDescription) {
      throw new Error("At least one non-empty field to update must be provided (category, title, location, or description)");
    }

    // Initialize services
    const supabaseService = new SupabaseService();
    const zepGraphService = new ZepGraphService();
    const categoryService = new CategoryService();

    // Validate category exists before proceeding (prevents race condition with create_category)
    if (hasCategory) {
      console.log(`🔍 [BULK-UPDATE-EVENTS TOOL] Validating category: "${category}"`);
      const existingCategory = await categoryService.getCategoryByName(userId, category!);

      if (!existingCategory) {
        const allCategories = await categoryService.getCategories(userId);
        const categoryNames = allCategories.map(c => c.name).join(', ');

        throw new Error(
          `Category "${category}" does not exist. ` +
          `Available categories: [${categoryNames}]. ` +
          `Create the category first using create_category, then call bulk_update_events.`
        );
      }
      console.log(`✅ [BULK-UPDATE-EVENTS TOOL] Category "${category}" validated`);
    }

    let eventsToUpdate: any[] = [];

    console.log('🔄 [BULK-UPDATE-EVENTS TOOL] Processing bulk update:', { searchQuery, eventIds, category, title });

    // Find events to update
    if (eventIds && eventIds.length > 0) {
      // Update specific events by ID
      const allEvents = await supabaseService.getEvents(userId);
      eventsToUpdate = allEvents.filter((event: any) => eventIds.includes(event.id));
      console.log(`📋 [BULK-UPDATE-EVENTS TOOL] Found ${eventsToUpdate.length} events by ID`);
    } else if (searchQuery) {
      // Search for events to update
      try {
        // Get ALL events (including past events - important!)
        const allEvents = await supabaseService.getEvents(userId);

        // Filter by search query
        const matchingEvents = allEvents.filter((event: any) => {
          const searchText = `${event.title} ${event.description || ''} ${event.location || ''}`.toLowerCase();
          return searchText.includes(searchQuery.toLowerCase());
        });

        eventsToUpdate = matchingEvents;
        console.log(`🔍 [BULK-UPDATE-EVENTS TOOL] Found ${eventsToUpdate.length} events matching: "${searchQuery}"`);
      } catch (error) {
        console.error('❌ [BULK-UPDATE-EVENTS TOOL] Search error:', error);
        throw new Error(`Failed to search for events: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      throw new Error("Either searchQuery or eventIds must be provided");
    }

    if (eventsToUpdate.length === 0) {
      const criteria = searchQuery ? `matching "${searchQuery}"` : `with specified IDs`;
      return `No events found ${criteria}. Please check your search criteria.`;
    }

    // Prepare update data - only include non-empty values
    // Empty strings and null should NOT be applied as updates
    const updateData: any = {};
    if (hasCategory) updateData.category = category;
    if (hasTitle) updateData.title = title;
    if (hasLocation) updateData.location = location;
    if (hasDescription) updateData.description = description;

    let updatedCount = 0;
    const errors: string[] = [];
    const updatedEventTitles: string[] = [];

    // Update each event
    for (const event of eventsToUpdate) {
      try {
        const updatedEvent = await supabaseService.updateEvent(
          userId,
          event.id,
          updateData,
          { source: 'agent', agentType: 'conversation' }
        );

        if (updatedEvent) {
          updatedCount++;
          updatedEventTitles.push(event.title);

          // Update knowledge graph asynchronously (fire-and-forget)
          const updateGraph = async () => {
            try {
              const startDate = new Date(updatedEvent.start_time);
              const endDate = new Date(updatedEvent.end_time);
              const durationMinutes = Math.round((endDate.getTime() - startDate.getTime()) / 60000);

              await zepGraphService.updateCalendarEvent(userId, event.id, {
                eventId: updatedEvent.id,
                title: updatedEvent.title,
                category: category || event.category || 'Personal',
                duration_minutes: durationMinutes,
                energy_level: 'medium',
                location: updatedEvent.location || undefined,
                attendee_count: 0
              });
            } catch (error) {
              console.error(`⚠️ [BULK-UPDATE-EVENTS TOOL] Failed to update event "${event.title}" in knowledge graph (non-critical):`, error);
            }
          };

          // Fire and forget - don't await
          updateGraph();
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Failed to update "${event.title}": ${errorMsg}`);
        console.error(`❌ [BULK-UPDATE-EVENTS TOOL] Error updating event "${event.title}":`, error);
      }
    }

    // Build detailed response
    const updateFields: string[] = [];
    if (category) updateFields.push(`category to "${category}"`);
    if (title) updateFields.push(`title to "${title}"`);
    if (location) updateFields.push(`location to "${location}"`);
    if (description) updateFields.push(`description`);

    let result = `✅ Successfully updated ${updatedCount} event(s)`;

    if (updateFields.length > 0) {
      result += ` (set ${updateFields.join(', ')})`;
    }

    // Add sample of updated events
    if (updatedEventTitles.length > 0) {
      const sampleSize = Math.min(5, updatedEventTitles.length);
      const sample = updatedEventTitles.slice(0, sampleSize);
      result += `\n\nUpdated events include: ${sample.join(', ')}`;

      if (updatedEventTitles.length > sampleSize) {
        result += ` and ${updatedEventTitles.length - sampleSize} more`;
      }
    }

    if (errors.length > 0) {
      result += `\n\n⚠️ ${errors.length} error(s) occurred:\n${errors.slice(0, 3).join('\n')}`;
      if (errors.length > 3) {
        result += `\n... and ${errors.length - 3} more errors`;
      }
    }

    return result;
  },
  {
    name: "bulk_update_events",
    description: "Update multiple events at once based on search criteria or event IDs. Perfect for bulk category changes, mass edits, or moving groups of events to a category. IMPORTANT: Includes both past and future events in the search.",
    schema: z.object({
      searchQuery: z.string().optional().nullable().describe("Search query to find events to update (e.g., 'mendicants', 'workout', 'meeting'). Searches in title, description, and location. Includes BOTH past and future events."),
      eventIds: z.array(z.string()).optional().nullable().describe("Optional: Array of specific event IDs to update instead of using search"),
      category: z.string().optional().nullable().describe("New category to assign to all matching events. MUST be an existing category - call list_categories first or create_category BEFORE this tool."),
      title: z.string().optional().nullable().describe("Optional: New title for all matching events (use cautiously)"),
      location: z.string().optional().nullable().describe("Optional: New location for all matching events"),
      description: z.string().optional().nullable().describe("Optional: New description for all matching events"),
    }),
  }
);
