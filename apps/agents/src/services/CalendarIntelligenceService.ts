import { supabase } from './SupabaseService.js';

interface TimeSlot {
  start: Date;
  end: Date;
  available: boolean;
  duration: number; // in minutes
}

interface ConflictCheckResult {
  hasConflict: boolean;
  conflictingEvents: any[];
  suggestion?: string;
}

interface FreeTimeSlot {
  start: string;
  end: string;
  duration: number;
  quality: 'prime' | 'good' | 'okay'; // Based on user patterns
}

export class CalendarIntelligenceService {
  private userId: string;
  private workingHours = {
    start: 9, // 9 AM
    end: 17,  // 5 PM
  };

  constructor(userId: string) {
    this.userId = userId;
  }

  /**
   * Check if a proposed event conflicts with existing events
   */
  async checkConflicts(
    startTime: Date,
    endTime: Date,
    excludeEventId?: string
  ): Promise<ConflictCheckResult> {
    try {
      // Fetch events that might conflict
      const { data: events, error } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', this.userId)
        .lte('start_time', endTime.toISOString())
        .gte('end_time', startTime.toISOString());

      if (error) {
        console.error('Error checking conflicts:', error);
        return { hasConflict: false, conflictingEvents: [] };
      }

      // Filter out the event being updated (if any)
      const conflictingEvents = events?.filter(e => e.id !== excludeEventId) || [];

      if (conflictingEvents.length > 0) {
        // Generate a suggestion for alternative time
        const suggestion = await this.suggestAlternativeTime(startTime, endTime);
        
        return {
          hasConflict: true,
          conflictingEvents,
          suggestion
        };
      }

      return {
        hasConflict: false,
        conflictingEvents: []
      };
    } catch (error) {
      console.error('Error in conflict check:', error);
      return { hasConflict: false, conflictingEvents: [] };
    }
  }

  /**
   * Find free time slots in a given date range
   */
  async findFreeTimeSlots(
    startDate: Date,
    endDate: Date,
    duration: number = 60, // Duration in minutes
    options: {
      respectWorkingHours?: boolean;
      includeWeekends?: boolean;
      bufferTime?: number; // Buffer time between meetings in minutes
    } = {}
  ): Promise<FreeTimeSlot[]> {
    const {
      respectWorkingHours = true,
      includeWeekends = false,
      bufferTime = 15
    } = options;

    // Fetch all events in the date range
    const { data: events, error } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', this.userId)
      .gte('start_time', startDate.toISOString())
      .lte('end_time', endDate.toISOString())
      .order('start_time', { ascending: true });

    if (error) {
      console.error('Error fetching events for free time:', error);
      return [];
    }

    const freeSlots: FreeTimeSlot[] = [];
    const currentDate = new Date(startDate);

    while (currentDate < endDate) {
      // Skip weekends if requested
      if (!includeWeekends && (currentDate.getDay() === 0 || currentDate.getDay() === 6)) {
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }

      // Set working hours for the day
      const dayStart = new Date(currentDate);
      const dayEnd = new Date(currentDate);
      
      if (respectWorkingHours) {
        dayStart.setHours(this.workingHours.start, 0, 0, 0);
        dayEnd.setHours(this.workingHours.end, 0, 0, 0);
      } else {
        dayStart.setHours(0, 0, 0, 0);
        dayEnd.setHours(23, 59, 59, 999);
      }

      // Get events for this day
      const dayEvents = events?.filter(e => {
        const eventStart = new Date(e.start_time);
        const eventEnd = new Date(e.end_time);
        return eventStart >= dayStart && eventStart < dayEnd;
      }) || [];

      // Sort events by start time
      dayEvents.sort((a, b) => 
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      );

      // Find gaps between events
      let lastEndTime = dayStart;

      for (const event of dayEvents) {
        const eventStart = new Date(event.start_time);
        const eventEnd = new Date(event.end_time);

        // Apply buffer time
        const bufferedStart = new Date(eventStart.getTime() - bufferTime * 60000);
        const bufferedEnd = new Date(eventEnd.getTime() + bufferTime * 60000);

        // Check if there's a gap before this event
        const gapDuration = (bufferedStart.getTime() - lastEndTime.getTime()) / 60000;
        
        if (gapDuration >= duration) {
          freeSlots.push({
            start: lastEndTime.toISOString(),
            end: bufferedStart.toISOString(),
            duration: gapDuration,
            quality: this.assessTimeQuality(lastEndTime)
          });
        }

        lastEndTime = bufferedEnd;
      }

      // Check for time after last event
      const remainingTime = (dayEnd.getTime() - lastEndTime.getTime()) / 60000;
      if (remainingTime >= duration) {
        freeSlots.push({
          start: lastEndTime.toISOString(),
          end: dayEnd.toISOString(),
          duration: remainingTime,
          quality: this.assessTimeQuality(lastEndTime)
        });
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return freeSlots;
  }

  /**
   * Suggest an alternative time for a conflicting event
   */
  async suggestAlternativeTime(
    originalStart: Date,
    originalEnd: Date
  ): Promise<string> {
    const duration = (originalEnd.getTime() - originalStart.getTime()) / 60000;
    
    // Look for free time in the next 7 days
    const searchEnd = new Date(originalStart);
    searchEnd.setDate(searchEnd.getDate() + 7);

    const freeSlots = await this.findFreeTimeSlots(
      originalStart,
      searchEnd,
      duration
    );

    if (freeSlots.length > 0) {
      // Prefer prime time slots
      const primeSlots = freeSlots.filter(s => s.quality === 'prime');
      const bestSlot = primeSlots.length > 0 ? primeSlots[0] : freeSlots[0];
      
      const suggestedDate = new Date(bestSlot.start);
      return `I found a free slot on ${suggestedDate.toLocaleDateString()} at ${suggestedDate.toLocaleTimeString()}`;
    }

    return 'No alternative time slots found in the next week';
  }

  /**
   * Get a daily briefing with summary and insights
   */
  async getDailyBriefing(date: Date = new Date()): Promise<string> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const { data: events, error } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', this.userId)
      .gte('start_time', startOfDay.toISOString())
      .lte('start_time', endOfDay.toISOString())
      .order('start_time', { ascending: true });

    if (error || !events) {
      return 'Unable to generate briefing at this time.';
    }

    if (events.length === 0) {
      return `Your calendar is clear for ${date.toLocaleDateString()}. A perfect day for deep work or catching up!`;
    }

    // Calculate statistics
    const totalEvents = events.length;
    const totalTime = events.reduce((acc, event) => {
      const duration = (new Date(event.end_time).getTime() - new Date(event.start_time).getTime()) / 60000;
      return acc + duration;
    }, 0);

    const meetingCount = events.filter(e => 
      e.title.toLowerCase().includes('meeting') || 
      e.title.toLowerCase().includes('call')
    ).length;

    // Find longest free block
    const freeSlots = await this.findFreeTimeSlots(startOfDay, endOfDay, 30);
    const longestFreeBlock = freeSlots.reduce((max, slot) => 
      slot.duration > max.duration ? slot : max, 
      { duration: 0 } as any
    );

    // Build briefing
    let briefing = `📅 **Daily Briefing for ${date.toLocaleDateString()}**\n\n`;
    briefing += `You have ${totalEvents} event${totalEvents > 1 ? 's' : ''} scheduled, `;
    briefing += `totaling ${Math.round(totalTime / 60)} hours.\n\n`;

    if (meetingCount > 0) {
      briefing += `🤝 ${meetingCount} meeting${meetingCount > 1 ? 's' : ''} today\n`;
    }

    if (longestFreeBlock.duration > 0) {
      const blockStart = new Date(longestFreeBlock.start);
      briefing += `⏰ Your longest free block is ${Math.round(longestFreeBlock.duration)} minutes `;
      briefing += `starting at ${blockStart.toLocaleTimeString()}\n`;
    }

    briefing += '\n**Today\'s Schedule:**\n';
    events.forEach(event => {
      const startTime = new Date(event.start_time);
      briefing += `• ${startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${event.title}\n`;
    });

    // Add insights
    if (totalTime > 420) { // More than 7 hours
      briefing += '\n⚠️ Heavy day ahead! Remember to take breaks.';
    } else if (totalTime < 180) { // Less than 3 hours
      briefing += '\n✨ Light schedule today - great opportunity for focused work!';
    }

    return briefing;
  }

  /**
   * Smart scheduling - find optimal time for a new event
   */
  async smartSchedule(
    duration: number,
    preferences: {
      preferredTimeOfDay?: 'morning' | 'afternoon' | 'evening';
      preferredDays?: number[]; // 0-6, where 0 is Sunday
      avoidBackToBack?: boolean;
      category?: string;
    } = {}
  ): Promise<FreeTimeSlot | null> {
    const now = new Date();
    const searchEnd = new Date();
    searchEnd.setDate(searchEnd.getDate() + 14); // Search 2 weeks ahead

    const freeSlots = await this.findFreeTimeSlots(
      now,
      searchEnd,
      duration,
      {
        respectWorkingHours: true,
        includeWeekends: false,
        bufferTime: preferences.avoidBackToBack ? 30 : 15
      }
    );

    if (freeSlots.length === 0) {
      return null;
    }

    // Filter by preferred days if specified
    let filteredSlots = freeSlots;
    if (preferences.preferredDays && preferences.preferredDays.length > 0) {
      filteredSlots = freeSlots.filter(slot => {
        const slotDate = new Date(slot.start);
        return preferences.preferredDays!.includes(slotDate.getDay());
      });
    }

    // Filter by preferred time of day
    if (preferences.preferredTimeOfDay) {
      filteredSlots = filteredSlots.filter(slot => {
        const hour = new Date(slot.start).getHours();
        switch (preferences.preferredTimeOfDay) {
          case 'morning':
            return hour >= 8 && hour < 12;
          case 'afternoon':
            return hour >= 12 && hour < 17;
          case 'evening':
            return hour >= 17 && hour < 20;
          default:
            return true;
        }
      });
    }

    // Sort by quality and return the best slot
    filteredSlots.sort((a, b) => {
      const qualityOrder = { 'prime': 0, 'good': 1, 'okay': 2 };
      return qualityOrder[a.quality] - qualityOrder[b.quality];
    });

    return filteredSlots.length > 0 ? filteredSlots[0] : freeSlots[0];
  }

  /**
   * Assess the quality of a time slot based on patterns
   */
  private assessTimeQuality(time: Date): 'prime' | 'good' | 'okay' {
    const hour = time.getHours();
    
    // Prime time: 9-11 AM and 2-4 PM (typically high productivity)
    if ((hour >= 9 && hour < 11) || (hour >= 14 && hour < 16)) {
      return 'prime';
    }
    
    // Good time: Rest of working hours
    if (hour >= 8 && hour < 17) {
      return 'good';
    }
    
    // Okay time: Early morning or evening
    return 'okay';
  }

  /**
   * Calculate buffer time recommendation based on event type
   */
  getRecommendedBufferTime(eventType: string): number {
    const type = eventType.toLowerCase();
    
    if (type.includes('interview') || type.includes('presentation')) {
      return 30; // 30 minutes for preparation
    }
    
    if (type.includes('meeting') || type.includes('call')) {
      return 15; // 15 minutes between meetings
    }
    
    if (type.includes('lunch') || type.includes('break')) {
      return 0; // No buffer needed for breaks
    }
    
    return 10; // Default buffer
  }

  /**
   * Get weekly summary and insights
   */
  async getWeeklySummary(weekStart: Date = new Date()): Promise<any> {
    // Adjust to start of week (Monday)
    const startDate = new Date(weekStart);
    const day = startDate.getDay();
    const diff = startDate.getDate() - day + (day === 0 ? -6 : 1);
    startDate.setDate(diff);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 7);

    const { data: events, error } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', this.userId)
      .gte('start_time', startDate.toISOString())
      .lt('start_time', endDate.toISOString())
      .order('start_time', { ascending: true });

    if (error || !events) {
      return null;
    }

    // Calculate metrics
    const totalEvents = events.length;
    const totalHours = events.reduce((acc, event) => {
      const duration = (new Date(event.end_time).getTime() - new Date(event.start_time).getTime()) / 3600000;
      return acc + duration;
    }, 0);

    const meetingHours = events
      .filter(e => e.title.toLowerCase().includes('meeting') || e.title.toLowerCase().includes('call'))
      .reduce((acc, event) => {
        const duration = (new Date(event.end_time).getTime() - new Date(event.start_time).getTime()) / 3600000;
        return acc + duration;
      }, 0);

    // Find busiest day
    const eventsByDay: { [key: string]: number } = {};
    events.forEach(event => {
      const day = new Date(event.start_time).toLocaleDateString();
      eventsByDay[day] = (eventsByDay[day] || 0) + 1;
    });

    const busiestDay = Object.entries(eventsByDay).reduce((max, [day, count]) => 
      count > max.count ? { day, count } : max,
      { day: '', count: 0 }
    );

    return {
      weekStart: startDate.toISOString(),
      weekEnd: endDate.toISOString(),
      totalEvents,
      totalHours: Math.round(totalHours * 10) / 10,
      meetingHours: Math.round(meetingHours * 10) / 10,
      focusTimeAvailable: Math.round((40 - totalHours) * 10) / 10, // Assuming 40-hour work week
      busiestDay: busiestDay.day,
      busiestDayEvents: busiestDay.count,
      averageEventsPerDay: Math.round((totalEvents / 5) * 10) / 10, // Weekdays only
      recommendations: this.generateWeeklyRecommendations(totalHours, meetingHours)
    };
  }

  /**
   * Generate recommendations based on weekly metrics
   */
  private generateWeeklyRecommendations(totalHours: number, meetingHours: number): string[] {
    const recommendations: string[] = [];

    if (totalHours > 40) {
      recommendations.push('⚠️ Your calendar is overbooked. Consider delegating or rescheduling non-critical items.');
    }

    if (meetingHours > 20) {
      recommendations.push('📊 You have a lot of meetings. Block time for focused work.');
    }

    if (meetingHours / totalHours > 0.6) {
      recommendations.push('🎯 Meetings dominate your schedule. Protect time for individual contributions.');
    }

    if (totalHours < 20) {
      recommendations.push('✨ You have plenty of open time. Great opportunity for strategic projects!');
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ Your schedule looks balanced!');
    }

    return recommendations;
  }
}