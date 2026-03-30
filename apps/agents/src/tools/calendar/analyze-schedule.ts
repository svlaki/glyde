import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getSupabaseService } from "../../services/SupabaseService.js";
import { startOfWeek, endOfWeek, differenceInMinutes, format, parseISO } from "date-fns";
import { toZonedTime } from "date-fns-tz";

/**
 * Analyze Schedule Tool
 *
 * Provides insights and analytics about the user's calendar:
 * - Meeting density and time allocation
 * - Free time availability
 * - Aspect distribution
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
      return "User ID required";
    }

    try {
      const supabaseService = getSupabaseService();

      // Determine date range FIRST so we can pass it to getEvents
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

      // Pass date range to getEvents so it only expands recurring events within range
      const events = await supabaseService.getEvents(
        userId,
        rangeStart.toISOString(),
        rangeEnd.toISOString()
      );

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

      // Aspect breakdown
      const aspectMap = new Map<string, { count: number; minutes: number }>();
      events.forEach(event => {
        const aspect = event.aspect_name || event.aspect || 'Uncategorized';
        const duration = differenceInMinutes(new Date(event.end_time), new Date(event.start_time));

        const existing = aspectMap.get(aspect) || { count: 0, minutes: 0 };
        aspectMap.set(aspect, {
          count: existing.count + 1,
          minutes: existing.minutes + duration
        });
      });

      // Sort aspects by time spent
      const aspectBreakdown = Array.from(aspectMap.entries())
        .sort((a, b) => b[1].minutes - a[1].minutes)
        .slice(0, 5) // Top 5 aspects
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
      const report = `**Schedule Analysis** (${format(rangeStart, 'MMM d')} - ${format(rangeEnd, 'MMM d')})

**Overview:**
• Total events: ${events.length}
• Total time scheduled: ${totalHours} hours
• Average event duration: ${avgEventDuration} minutes
• Calendar load: ${meetingLoad}% of working hours

**Top Aspects:**
${aspectBreakdown}

**Daily Pattern:**
• Busiest day: ${busiestDay ? `${busiestDay[0]} (${busiestDayHours}h)` : 'N/A'}

**Assessment:**
${loadAssessment}`;

      return report;

    } catch (error) {
      console.error('[analyze-schedule] Error:', error);
      return `Error analyzing schedule: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "analyze_schedule",
    description: "Analyze schedule patterns and time allocation.",
    schema: z.object({
      period: z.enum(["today", "week", "next-week"]).optional().nullable().describe("Period (default: week)"),
      startDate: z.string().optional().nullable().describe("Custom start date ISO"),
      endDate: z.string().optional().nullable().describe("Custom end date ISO"),
    }),
  }
);
