import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SupabaseService } from "../../services/SupabaseService.js";
import { AspectService } from "../../services/AspectService.js";

export const bulkUpdateEventsTool = tool(
  async ({ eventIds, aspect, title, location, description }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      throw new Error("User ID is required for bulk updating events");
    }

    // Validate that at least one update field is provided
    const hasAspect = aspect !== undefined && aspect !== null && aspect !== '';
    const hasTitle = title !== undefined && title !== null && title !== '';
    const hasLocation = location !== undefined && location !== null && location !== '';
    const hasDescription = description !== undefined && description !== null && description !== '';

    if (!hasAspect && !hasTitle && !hasLocation && !hasDescription) {
      throw new Error("At least one non-empty field to update must be provided (aspect, title, location, or description)");
    }

    const supabaseService = new SupabaseService();
    const aspectService = new AspectService();

    // Validate aspect exists before proceeding
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
    }

    console.log('[BULK-UPDATE-EVENTS TOOL] Processing bulk update:', { eventIds, aspect, title });

    // Look up the events by ID
    const allEvents = await supabaseService.getEvents(userId);
    const eventsToUpdate = allEvents.filter((event: any) => eventIds.includes(event.id));

    // Deduplicate: recurring instances may share a parent — only update each parent once
    const uniqueEventIds = new Set<string>();
    const deduplicatedEvents: any[] = [];
    for (const event of eventsToUpdate) {
      const actualId = event.is_instance && event.parent_event_id ? event.parent_event_id : event.id;
      if (!uniqueEventIds.has(actualId)) {
        uniqueEventIds.add(actualId);
        deduplicatedEvents.push({ ...event, id: actualId });
      }
    }

    if (deduplicatedEvents.length === 0) {
      return `No events found with the specified IDs. Use search_events to find event IDs first.`;
    }

    // Prepare update data
    const updateData: any = {};
    if (hasAspect) updateData.aspect = aspect;
    if (hasTitle) updateData.title = title;
    if (hasLocation) updateData.location = location;
    if (hasDescription) updateData.description = description;

    let updatedCount = 0;
    const errors: string[] = [];
    const updatedEventTitles: string[] = [];

    for (const event of deduplicatedEvents) {
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
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Failed to update "${event.title}": ${errorMsg}`);
      }
    }

    // Build response
    const updateFields: string[] = [];
    if (aspect) updateFields.push(`aspect to "${aspect}"`);
    if (title) updateFields.push(`title to "${title}"`);
    if (location) updateFields.push(`location to "${location}"`);
    if (description) updateFields.push(`description`);

    let result = `Successfully updated ${updatedCount} event(s)`;

    if (updateFields.length > 0) {
      result += ` (set ${updateFields.join(', ')})`;
    }

    result += `\n\nBULK UPDATE COMPLETE - No further action needed.`;

    if (updatedEventTitles.length > 0) {
      const uniqueTitles = [...new Set(updatedEventTitles)];
      const sample = uniqueTitles.slice(0, 5);
      result += `\n\nUpdated events: ${sample.join(', ')}`;
      if (uniqueTitles.length > 5) {
        result += ` and ${uniqueTitles.length - 5} more`;
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
    description: "Update multiple events at once by IDs. Get #IDs from CALENDAR context or search_events first.",
    schema: z.object({
      eventIds: z.array(z.string()).describe("Event UUIDs to update"),
      aspect: z.string().optional().nullable().describe("New aspect name"),
      title: z.string().optional().nullable().describe("New title"),
      location: z.string().optional().nullable().describe("New location"),
      description: z.string().optional().nullable().describe("New description"),
    }),
  }
);
