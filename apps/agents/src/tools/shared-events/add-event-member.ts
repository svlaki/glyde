import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SupabaseService } from "../../services/SupabaseService.js";
import { SharedEventService } from "../../services/SharedEventService.js";
import { formatTimeForUser } from "../../utils/timezoneUtils.js";

export const addEventMemberTool = tool(
  async ({ eventId, searchQuery, friendUserId, role = 'viewer' }, config) => {
    const userId = config?.configurable?.userId;
    const timezone = config?.configurable?.timezone || 'America/Los_Angeles';
    if (!userId) {
      throw new Error("User ID is required");
    }

    const supabaseService = new SupabaseService();
    const sharedEventService = new SharedEventService(supabaseService.getClient());

    let targetEventId = eventId;

    // If no eventId, resolve via search
    if (!targetEventId) {
      if (!searchQuery) {
        throw new Error("Either eventId or searchQuery must be provided");
      }

      const allEvents = await supabaseService.getEventsForAgent(userId);
      const now = new Date();
      const cutoffTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const recentEvents = allEvents.filter((event: any) =>
        new Date(event.start_time) >= cutoffTime
      );

      const normalizedQuery = searchQuery.toLowerCase().trim();
      const queryWords = normalizedQuery.split(/\s+/).filter(word =>
        word.length > 1 && !['the', 'a', 'an', 'for', 'to', 'in', 'on', 'at'].includes(word)
      );

      const matchingEvents = recentEvents.filter((event: any) => {
        const searchText = `${event.title} ${event.description || ''}`.toLowerCase();
        return queryWords.some(word => searchText.includes(word)) || searchText.includes(normalizedQuery);
      });

      matchingEvents.sort((a: any, b: any) => {
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
        throw new Error(`No upcoming events found matching "${searchQuery}". Recent events: ${recentEvents.slice(0, 5).map((e: any) => e.title).join(', ')}`);
      }

      if (matchingEvents.length > 1) {
        const eventsList = matchingEvents.slice(0, 5).map((e: any) => {
          const eventDate = formatTimeForUser(e.start_time, timezone, 'EEE, MMM d');
          const eventTime = formatTimeForUser(e.start_time, timezone, 'h:mm a');
          return `- ${e.title} on ${eventDate} at ${eventTime} (ID: ${e.id})`;
        }).join('\n');

        throw new Error(`Found ${matchingEvents.length} events matching "${searchQuery}". Which one?\n${eventsList}`);
      }

      targetEventId = matchingEvents[0].id;
      console.log(`[ADD-EVENT-MEMBER] Found event: "${matchingEvents[0].title}" (${targetEventId})`);
    }

    const result = await sharedEventService.addMember(targetEventId, userId, friendUserId, role);

    if (!result.success) {
      return `Failed to add member: ${result.error}`;
    }

    return `Invite sent! ${role === 'member' ? 'They will have full edit access once they accept.' : 'They will have view-only access once they accept.'}`;
  },
  {
    name: "add_event_member",
    description: "Invite a friend to a shared event. They must accept the invite before they can see the event. Supports event lookup by name or direct ID.",
    schema: z.object({
      eventId: z.string().uuid().optional().describe("Event UUID (optional if searchQuery provided)"),
      searchQuery: z.string().optional().describe("Search for event by name if eventId not available"),
      friendUserId: z.string().uuid().describe("Friend's user UUID"),
      role: z.enum(['member', 'viewer']).default('viewer').describe("Member role: 'member' for full edit access, 'viewer' for read-only"),
    }),
  }
);
