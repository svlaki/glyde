import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getSupabaseService } from "../../services/SupabaseService.js";
import { findFreeSlot } from "../../agents/proactive/utils/timeSlotFinder.js";
import { formatInTimeZone } from "date-fns-tz";
import { addDays } from "date-fns";

/**
 * Find Free Time Tool
 *
 * Helps users find available time slots in their calendar.
 * Scans upcoming days for gaps that fit the requested duration.
 *
 * Use cases:
 * - "When can I schedule a 1-hour meeting?"
 * - "Find me time for a 30-minute workout"
 * - "When am I free this week for a 2-hour deep work session?"
 */
export const findFreeTimeTool = tool(
  async ({ durationMinutes, daysToSearch, earliestHour, latestHour, startDate }, config) => {
    const userId = config?.configurable?.userId;
    const timezone = config?.configurable?.timezone || 'UTC';

    if (!userId) {
      return "❌ User ID required";
    }

    if (durationMinutes <= 0) {
      return "❌ Duration must be greater than 0 minutes";
    }

    try {
      const supabaseService = getSupabaseService();
      const events = await supabaseService.getEvents(userId);

      const earliestMinutes = (earliestHour ?? 9) * 60; // Default: 9 AM
      const latestMinutes = (latestHour ?? 19) * 60;    // Default: 7 PM
      const searchDays = daysToSearch ?? 7; // Default: next 7 days

      // Determine starting point
      const searchStartDate = startDate ? new Date(startDate) : new Date();

      const availableSlots: Array<{ day: string; start: string; end: string }> = [];

      // Search for free slots across multiple days
      for (let dayOffset = 0; dayOffset < searchDays; dayOffset++) {
        const slot = findFreeSlot(events, timezone, {
          dayOffset,
          durationMinutes,
          earliestMinutes,
          latestMinutes
        });

        if (slot) {
          const dayLabel = formatInTimeZone(slot.startLocal, timezone, 'EEEE, MMM d');
          const startTime = formatInTimeZone(slot.startLocal, timezone, 'h:mm a');
          const endTime = formatInTimeZone(slot.endLocal, timezone, 'h:mm a');

          availableSlots.push({
            day: dayLabel,
            start: startTime,
            end: endTime
          });

          // Limit to first 5 suggestions
          if (availableSlots.length >= 5) break;
        }
      }

      if (availableSlots.length === 0) {
        return `❌ No free time slots found for ${durationMinutes} minutes in the next ${searchDays} days (searching ${earliestHour ?? 9} AM - ${latestHour ?? 7} PM). Consider:\n- Extending your search range\n- Reducing the duration\n- Adjusting your time preferences`;
      }

      const slotList = availableSlots
        .map((slot, idx) => `${idx + 1}. ${slot.day}: ${slot.start} - ${slot.end}`)
        .join('\n');

      return `🗓️ Found ${availableSlots.length} available time slot(s) for ${durationMinutes} minutes:\n\n${slotList}\n\nWould you like me to schedule something during any of these times?`;

    } catch (error) {
      console.error('❌ [find-free-time] Error:', error);
      return `❌ Error finding free time: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "find_free_time",
    description: "Find available time slots in the user's calendar for a specified duration. Scans upcoming days and returns suggestions. Use this when users ask 'when am I free?' or 'find time for X'.",
    schema: z.object({
      durationMinutes: z.number().min(15).describe("Duration needed in minutes (e.g., 30 for 30 minutes, 60 for 1 hour, 120 for 2 hours)"),
      daysToSearch: z.number().min(1).max(30).optional().describe("Number of days to search ahead (default: 7 days)"),
      earliestHour: z.number().min(0).max(23).optional().describe("Earliest hour to consider (0-23, default: 9 for 9 AM)"),
      latestHour: z.number().min(0).max(23).optional().describe("Latest hour to consider (0-23, default: 19 for 7 PM)"),
      startDate: z.string().optional().describe("Start searching from this date (ISO format, default: today)"),
    }),
  }
);
