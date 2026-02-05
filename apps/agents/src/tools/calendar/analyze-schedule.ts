import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getSupabaseService } from "../../services/SupabaseService.js";
import { startOfWeek, endOfWeek, isWithinInterval, differenceInMinutes, format, parseISO } from "date-fns";
import { toZonedTime } from "date-fns-tz";

/**
 * Analyze Schedule Tool
 *
 * Provides insights and analytics about the user's calendar:
 * - Meeting density and time allocation
 * - Free time availability
 * - Category distribution
 * - Busiest/quietest periods
 * - Work-life balance metrics
 *
 * Use cases:
 * - "How busy am I this week?"
 * - "Analyze my schedule"
 * - "Am I overbooked?"
 * - "Show me my time breakdown"
 */
export const analyzeScheduleTool = tool(
  async ({ period, startDate, endDate }, config) => {
    const userId = config?.configurable?.userId;
    const timezone = config?.configurable?.timezone || 'UTC';

    if (!userId) {
      return "❌ User ID required";
    }

    try {
      const supabaseService = getSupabaseService();
      const allEvents = await supabaseService.getEvents(userId);

      // Determine date range
      let rangeStart: Date;
      let rangeEnd: Date;
      const now = toZonedTime(new Date(), timezone);

      if (startDate && endDate) {
        rangeStart = parseISO(startDate);
        rangeEnd = parseISO(endDate);
      } else if (period === 'today') {
        rangeStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        rangeEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      } else if (period === 'week') {
        rangeStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
        rangeEnd = endOfWeek(now, { weekStartsOn: 1 }); // Sunday
      } else if (period === 'next-week') {
        const nextWeekStart = new Date(now);
        nextWeekStart.setDate(now.getDate() + 7);
        rangeStart = startOfWeek(nextWeekStart, { weekStartsOn: 1 });
        rangeEnd = endOfWeek(nextWeekStart, { weekStartsOn: 1 });
      } else {
        // Default: current week
        rangeStart = startOfWeek(now, { weekStartsOn: 1 });
        rangeEnd = endOfWeek(now, { weekStartsOn: 1 });
      }

      // Filter events within range
      const events = allEvents.filter(event => {
        const eventStart = new Date(event.start_time);
        const eventEnd = new Date(event.end_time);
        return isWithinInterval(eventStart, { start: rangeStart, end: rangeEnd }) ||
               isWithinInterval(eventEnd, { start: rangeStart, end: rangeEnd });
      });

      if (events.length === 0) {
        return `No events scheduled for ${period || 'the selected period'}. Your calendar is completely free!`;
      }

      // Calculate metrics
      const totalMinutes = events.reduce((sum, event) => {
        const start = new Date(event.start_time);
        const end = new Date(event.end_time);
        return sum + differenceInMinutes(end, start);
      }, 0);

      const totalHours = Math.round(totalMinutes / 60 * 10) / 10;
      const avgEventDuration = Math.round(totalMinutes / events.length);

      // Category breakdown
      const categoryMap = new Map<string, { count: number; minutes: number }>();
      events.forEach(event => {
        const category = event.category_name || event.category || 'Uncategorized';
        const duration = differenceInMinutes(new Date(event.end_time), new Date(event.start_time));

        const existing = categoryMap.get(category) || { count: 0, minutes: 0 };
        categoryMap.set(category, {
          count: existing.count + 1,
          minutes: existing.minutes + duration
        });
      });

      // Sort categories by time spent
      const categoryBreakdown = Array.from(categoryMap.entries())
        .sort((a, b) => b[1].minutes - a[1].minutes)
        .slice(0, 5) // Top 5 categories
        .map(([name, stats]) => {
          const hours = Math.round(stats.minutes / 60 * 10) / 10;
          const percentage = Math.round((stats.minutes / totalMinutes) * 100);
          return `  • ${name}: ${hours}h (${stats.count} events, ${percentage}%)`;
        })
        .join('\n');

      // Daily breakdown
      const dailyMap = new Map<string, number>();
      events.forEach(event => {
        const day = format(new Date(event.start_time), 'EEEE');
        const duration = differenceInMinutes(new Date(event.end_time), new Date(event.start_time));
        dailyMap.set(day, (dailyMap.get(day) || 0) + duration);
      });

      const busiestDay = Array.from(dailyMap.entries())
        .sort((a, b) => b[1] - a[1])[0];
      const busiestDayHours = busiestDay ? Math.round(busiestDay[1] / 60 * 10) / 10 : 0;

      // Meeting overload detection
      const workingHoursPerDay = 8;
      const daysInPeriod = Math.ceil((rangeEnd.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24));
      const totalWorkingHours = workingHoursPerDay * daysInPeriod;
      const meetingLoad = Math.round((totalHours / totalWorkingHours) * 100);

      let loadAssessment = '';
      if (meetingLoad > 70) {
        loadAssessment = '🔴 **High load**: You\'re heavily booked. Consider declining non-essential meetings or blocking focus time.';
      } else if (meetingLoad > 50) {
        loadAssessment = '🟡 **Moderate load**: Well-balanced, but watch for meeting creep.';
      } else {
        loadAssessment = '🟢 **Light load**: Good availability for deep work and flexibility.';
      }

      // Build report
      const report = `📊 **Schedule Analysis** (${format(rangeStart, 'MMM d')} - ${format(rangeEnd, 'MMM d')})

**Overview:**
• Total events: ${events.length}
• Total time scheduled: ${totalHours} hours
• Average event duration: ${avgEventDuration} minutes
• Calendar load: ${meetingLoad}% of working hours

**Top Categories:**
${categoryBreakdown}

**Daily Pattern:**
• Busiest day: ${busiestDay ? `${busiestDay[0]} (${busiestDayHours}h)` : 'N/A'}

**Assessment:**
${loadAssessment}`;

      return report;

    } catch (error) {
      console.error('❌ [analyze-schedule] Error:', error);
      return `❌ Error analyzing schedule: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "analyze_schedule",
    description: "Analyze the user's schedule and provide insights about time allocation, meeting density, category breakdown, and work-life balance. Use when users ask about their schedule patterns or workload.",
    schema: z.object({
      period: z.enum(["today", "week", "next-week"]).optional().nullable().describe("Time period to analyze (default: 'week' for current week)"),
      startDate: z.string().optional().nullable().describe("Custom start date (ISO format) - overrides period"),
      endDate: z.string().optional().nullable().describe("Custom end date (ISO format) - overrides period"),
    }),
  }
);
