import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SupabaseService } from "../../services/SupabaseService.js";
import { ZepGraphService } from "../../services/ZepGraphService.js";
import { AspectService } from "../../services/AspectService.js";

export const bulkUpdateEventsTool = tool(
  async ({ searchQuery, eventIds, aspect, title, location, description }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      throw new Error("User ID is required for bulk updating events");
    }

    // Validate that at least one update field is provided (empty strings and null don't count)
    const hasAspect = aspect !== undefined && aspect !== null && aspect !== '';
    const hasTitle = title !== undefined && title !== null && title !== '';
    const hasLocation = location !== undefined && location !== null && location !== '';
    const hasDescription = description !== undefined && description !== null && description !== '';

    if (!hasAspect && !hasTitle && !hasLocation && !hasDescription) {
      throw new Error("At least one non-empty field to update must be provided (aspect, title, location, or description)");
    }

    // Initialize services
    const supabaseService = new SupabaseService();
    const zepGraphService = new ZepGraphService();
    const aspectService = new AspectService();

    // Validate aspect exists before proceeding (prevents race condition with create_aspect)
    if (hasAspect) {
      console.log(`🔍 [BULK-UPDATE-EVENTS TOOL] Validating aspect: "${aspect}"`);
      const existingAspect = await aspectService.getAspectByName(userId, aspect!);

      if (!existingAspect) {
        const allAspects = await aspectService.getAspects(userId);
        const aspectNames = allAspects.map(a => a.name).join(', ');

        throw new Error(
          `Aspect "${aspect}" does not exist. ` +
          `Available aspects: [${aspectNames}]. ` +
          `Create the aspect first using create_aspect, then call bulk_update_events.`
        );
      }
      console.log(`[BULK-UPDATE-EVENTS TOOL] Aspect "${aspect}" validated`);
    }

    let eventsToUpdate: any[] = [];

    console.log('[BULK-UPDATE-EVENTS TOOL] Processing bulk update:', { searchQuery, eventIds, aspect, title });

    // Find events to update
    if (eventIds && eventIds.length > 0) {
      // Update specific events by ID
      const allEvents = await supabaseService.getEvents(userId);
      eventsToUpdate = allEvents.filter((event: any) => eventIds.includes(event.id));
      console.log(`[BULK-UPDATE-EVENTS TOOL] Found ${eventsToUpdate.length} events by ID`);
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

        // IMPORTANT: Deduplicate by event ID
        // getEvents() returns expanded recurring instances that all share the same parent ID
        // We only want to update each unique parent event once
        const uniqueEventIds = new Set<string>();
        const deduplicatedEvents: any[] = [];
        for (const event of matchingEvents) {
          if (!uniqueEventIds.has(event.id)) {
            uniqueEventIds.add(event.id);
            deduplicatedEvents.push(event);
          }
        }

        eventsToUpdate = deduplicatedEvents;
        console.log(`🔍 [BULK-UPDATE-EVENTS TOOL] Found ${matchingEvents.length} event instances matching: "${searchQuery}" (${deduplicatedEvents.length} unique parent events)`);
      } catch (error) {
        console.error('[BULK-UPDATE-EVENTS TOOL] Search error:', error);
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
    if (hasAspect) updateData.aspect = aspect;
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
                aspect: aspect || event.aspect || 'Personal',
                duration_minutes: durationMinutes,
                energy_level: 'medium',
                location: updatedEvent.location || undefined,
                attendee_count: 0
              });
            } catch (error) {
              console.error(`[BULK-UPDATE-EVENTS TOOL] Failed to update event "${event.title}" in knowledge graph (non-critical):`, error);
            }
          };

          // Fire and forget - don't await
          updateGraph();
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Failed to update "${event.title}": ${errorMsg}`);
        console.error(`[BULK-UPDATE-EVENTS TOOL] Error updating event "${event.title}":`, error);
      }
    }

    // Build detailed response
    const updateFields: string[] = [];
    if (aspect) updateFields.push(`aspect to "${aspect}"`);
    if (title) updateFields.push(`title to "${title}"`);
    if (location) updateFields.push(`location to "${location}"`);
    if (description) updateFields.push(`description`);

    let result = `Successfully updated ${updatedCount} event(s)`;

    if (updateFields.length > 0) {
      result += ` (set ${updateFields.join(', ')})`;
    }

    // Add a clear completion message to prevent agent from looping
    result += `\n\nBULK UPDATE COMPLETE - No further action needed.`;

    // Add unique event titles (deduplicated)
    if (updatedEventTitles.length > 0) {
      const uniqueTitles = [...new Set(updatedEventTitles)];
      const sampleSize = Math.min(5, uniqueTitles.length);
      const sample = uniqueTitles.slice(0, sampleSize);
      result += `\n\nUpdated events: ${sample.join(', ')}`;

      if (uniqueTitles.length > sampleSize) {
        result += ` and ${uniqueTitles.length - sampleSize} more`;
      }
    }

    if (errors.length > 0) {
      result += `\n\n${errors.length} error(s) occurred:\n${errors.slice(0, 3).join('\n')}`;
      if (errors.length > 3) {
        result += `\n... and ${errors.length - 3} more errors`;
      }
    }

    return result;
  },
  {
    name: "bulk_update_events",
    description: "Update multiple events at once by search or IDs.",
    schema: z.object({
      searchQuery: z.string().optional().nullable().describe("Search query to find events"),
      eventIds: z.array(z.string()).optional().nullable().describe("Event UUIDs to update"),
      aspect: z.string().optional().nullable().describe("New aspect name"),
      title: z.string().optional().nullable().describe("New title"),
      location: z.string().optional().nullable().describe("New location"),
      description: z.string().optional().nullable().describe("New description"),
    }),
  }
);
