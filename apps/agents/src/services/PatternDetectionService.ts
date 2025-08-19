import { supabase } from './SupabaseService.js';

interface EventPattern {
  type: string;
  confidence: number;
  data: any;
}

interface UserPreference {
  key: string;
  value: any;
  category: string;
}

export class PatternDetectionService {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  /**
   * Analyze user's calendar events to detect patterns
   */
  async analyzeUserPatterns(): Promise<EventPattern[]> {
    const patterns: EventPattern[] = [];

    // Get events from the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: events, error } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', this.userId)
      .gte('start_time', thirtyDaysAgo.toISOString())
      .order('start_time', { ascending: true });

    if (error || !events) {
      console.error('Error fetching events for pattern analysis:', error);
      return patterns;
    }

    // Detect meeting patterns
    const meetingPattern = this.detectMeetingPatterns(events);
    if (meetingPattern) patterns.push(meetingPattern);

    // Detect work hour patterns
    const workHourPattern = this.detectWorkHourPatterns(events);
    if (workHourPattern) patterns.push(workHourPattern);

    // Detect break patterns
    const breakPattern = this.detectBreakPatterns(events);
    if (breakPattern) patterns.push(breakPattern);

    // Detect recurring events
    const recurringPattern = this.detectRecurringEvents(events);
    if (recurringPattern) patterns.push(recurringPattern);

    // Store detected patterns in database
    await this.storePatterns(patterns);

    return patterns;
  }

  /**
   * Detect patterns in meeting scheduling
   */
  private detectMeetingPatterns(events: any[]): EventPattern | null {
    const meetingEvents = events.filter(e => 
      e.title.toLowerCase().includes('meeting') ||
      e.title.toLowerCase().includes('call') ||
      e.title.toLowerCase().includes('sync') ||
      e.title.toLowerCase().includes('1:1')
    );

    if (meetingEvents.length < 3) return null;

    // Analyze meeting times
    const meetingTimes: { [key: string]: number } = {};
    const meetingDays: { [key: number]: number } = {};
    const meetingDurations: number[] = [];

    meetingEvents.forEach(event => {
      const startDate = new Date(event.start_time);
      const endDate = new Date(event.end_time);
      const hour = startDate.getHours();
      const day = startDate.getDay();
      const duration = (endDate.getTime() - startDate.getTime()) / (1000 * 60); // in minutes

      // Track hour preferences
      const hourKey = `${hour}:00`;
      meetingTimes[hourKey] = (meetingTimes[hourKey] || 0) + 1;

      // Track day preferences
      meetingDays[day] = (meetingDays[day] || 0) + 1;

      // Track durations
      meetingDurations.push(duration);
    });

    // Find most common meeting times
    const preferredHours = Object.entries(meetingTimes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([hour, count]) => ({ hour, frequency: count }));

    // Find most common meeting days
    const preferredDays = Object.entries(meetingDays)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([day, count]) => ({ 
        day: this.getDayName(parseInt(day)), 
        frequency: count 
      }));

    // Calculate average duration
    const avgDuration = meetingDurations.reduce((a, b) => a + b, 0) / meetingDurations.length;

    const confidence = Math.min(0.9, 0.3 + (meetingEvents.length * 0.05));

    return {
      type: 'meeting_preferences',
      confidence,
      data: {
        preferredHours,
        preferredDays,
        averageDuration: Math.round(avgDuration),
        totalMeetings: meetingEvents.length,
        insight: `You tend to have meetings on ${preferredDays[0]?.day || 'weekdays'} around ${preferredHours[0]?.hour || '10:00'}`
      }
    };
  }

  /**
   * Detect work hour patterns
   */
  private detectWorkHourPatterns(events: any[]): EventPattern | null {
    if (events.length < 10) return null;

    const hourDistribution: { [key: number]: number } = {};
    let earliestHour = 24;
    let latestHour = 0;

    events.forEach(event => {
      const startDate = new Date(event.start_time);
      const hour = startDate.getHours();
      
      hourDistribution[hour] = (hourDistribution[hour] || 0) + 1;
      
      if (hour < earliestHour && hour >= 6) earliestHour = hour;
      if (hour > latestHour && hour <= 22) latestHour = hour;
    });

    // Find peak hours (top 3)
    const peakHours = Object.entries(hourDistribution)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([hour, count]) => ({
        hour: parseInt(hour),
        eventCount: count
      }));

    const confidence = Math.min(0.85, 0.4 + (events.length * 0.02));

    return {
      type: 'work_hours',
      confidence,
      data: {
        typicalStart: earliestHour,
        typicalEnd: latestHour,
        peakHours,
        totalEventsAnalyzed: events.length,
        insight: `Your most productive hours appear to be around ${peakHours[0]?.hour || 10}:00`
      }
    };
  }

  /**
   * Detect break patterns
   */
  private detectBreakPatterns(events: any[]): EventPattern | null {
    const breakEvents = events.filter(e => 
      e.title.toLowerCase().includes('break') ||
      e.title.toLowerCase().includes('lunch') ||
      e.title.toLowerCase().includes('coffee') ||
      e.title.toLowerCase().includes('walk')
    );

    if (breakEvents.length < 2) return null;

    const breakTimes: { [key: string]: number } = {};
    
    breakEvents.forEach(event => {
      const startDate = new Date(event.start_time);
      const hour = startDate.getHours();
      const timeSlot = this.getTimeSlot(hour);
      
      breakTimes[timeSlot] = (breakTimes[timeSlot] || 0) + 1;
    });

    const preferredBreakTimes = Object.entries(breakTimes)
      .sort((a, b) => b[1] - a[1])
      .map(([slot, count]) => ({ timeSlot: slot, frequency: count }));

    const confidence = Math.min(0.7, 0.3 + (breakEvents.length * 0.1));

    return {
      type: 'break_patterns',
      confidence,
      data: {
        preferredBreakTimes,
        totalBreaks: breakEvents.length,
        averageBreaksPerWeek: breakEvents.length / 4,
        insight: `You typically take breaks in the ${preferredBreakTimes[0]?.timeSlot || 'afternoon'}`
      }
    };
  }

  /**
   * Detect recurring events
   */
  private detectRecurringEvents(events: any[]): EventPattern | null {
    const eventTitles: { [key: string]: any[] } = {};
    
    // Group events by similar titles
    events.forEach(event => {
      const normalizedTitle = event.title.toLowerCase().trim();
      if (!eventTitles[normalizedTitle]) {
        eventTitles[normalizedTitle] = [];
      }
      eventTitles[normalizedTitle].push(event);
    });

    // Find events that occur multiple times
    const recurringEvents = Object.entries(eventTitles)
      .filter(([_, events]) => events.length >= 3)
      .map(([title, events]) => {
        // Analyze recurrence pattern
        const dates = events.map(e => new Date(e.start_time));
        const intervals: number[] = [];
        
        for (let i = 1; i < dates.length; i++) {
          const daysDiff = Math.round((dates[i].getTime() - dates[i-1].getTime()) / (1000 * 60 * 60 * 24));
          intervals.push(daysDiff);
        }

        // Determine recurrence type
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        let recurrenceType = 'irregular';
        
        if (Math.abs(avgInterval - 7) < 1) recurrenceType = 'weekly';
        else if (Math.abs(avgInterval - 14) < 2) recurrenceType = 'biweekly';
        else if (Math.abs(avgInterval - 30) < 3) recurrenceType = 'monthly';
        else if (Math.abs(avgInterval - 1) < 0.5) recurrenceType = 'daily';

        return {
          title,
          occurrences: events.length,
          recurrenceType,
          averageInterval: Math.round(avgInterval)
        };
      });

    if (recurringEvents.length === 0) return null;

    const confidence = 0.8;

    return {
      type: 'recurring_events',
      confidence,
      data: {
        recurringEvents,
        totalRecurringEvents: recurringEvents.length,
        insight: `You have ${recurringEvents.length} recurring events, mostly ${recurringEvents[0]?.recurrenceType || 'weekly'}`
      }
    };
  }

  /**
   * Store detected patterns in the database
   */
  private async storePatterns(patterns: EventPattern[]): Promise<void> {
    for (const pattern of patterns) {
      try {
        await supabase
          .from('user_patterns')
          .upsert({
            user_id: this.userId,
            pattern_type: pattern.type,
            pattern_data: pattern.data,
            confidence_score: pattern.confidence,
            last_updated: new Date().toISOString()
          }, {
            onConflict: 'user_id,pattern_type'
          });
      } catch (error) {
        console.error(`Error storing pattern ${pattern.type}:`, error);
      }
    }
  }

  /**
   * Get user preferences
   */
  async getUserPreferences(): Promise<UserPreference[]> {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', this.userId);

    if (error || !data) {
      console.error('Error fetching user preferences:', error);
      return [];
    }

    return data.map(pref => ({
      key: pref.preference_key,
      value: pref.preference_value,
      category: pref.category
    }));
  }

  /**
   * Update user preference
   */
  async updatePreference(key: string, value: any, category: string = 'general'): Promise<boolean> {
    const { error } = await supabase
      .from('user_preferences')
      .upsert({
        user_id: this.userId,
        preference_key: key,
        preference_value: value,
        category,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,preference_key'
      });

    if (error) {
      console.error('Error updating preference:', error);
      return false;
    }

    return true;
  }

  /**
   * Generate insights based on patterns
   */
  async generateInsights(): Promise<string[]> {
    const insights: string[] = [];
    const patterns = await this.getStoredPatterns();

    for (const pattern of patterns) {
      if (pattern.pattern_type === 'meeting_preferences' && pattern.confidence_score > 0.6) {
        const data = pattern.pattern_data as any;
        insights.push(
          `Based on your calendar, you prefer meetings on ${data.preferredDays?.[0]?.day || 'weekdays'} ` +
          `around ${data.preferredHours?.[0]?.hour || '10:00'}. ` +
          `Your meetings typically last ${data.averageDuration || 60} minutes.`
        );
      }

      if (pattern.pattern_type === 'work_hours' && pattern.confidence_score > 0.5) {
        const data = pattern.pattern_data as any;
        insights.push(
          `Your work pattern shows peak productivity around ${data.peakHours?.[0]?.hour || 10}:00. ` +
          `You typically start around ${data.typicalStart || 9}:00 and finish by ${data.typicalEnd || 18}:00.`
        );
      }

      if (pattern.pattern_type === 'break_patterns' && pattern.confidence_score > 0.5) {
        const data = pattern.pattern_data as any;
        insights.push(
          `You take an average of ${data.averageBreaksPerWeek || 5} breaks per week, ` +
          `usually in the ${data.preferredBreakTimes?.[0]?.timeSlot || 'afternoon'}.`
        );
      }
    }

    // Store insights in database
    for (const insight of insights) {
      await this.storeInsight(insight, 'pattern_analysis');
    }

    return insights;
  }

  /**
   * Store an insight in the database
   */
  private async storeInsight(content: string, type: string): Promise<void> {
    try {
      await supabase
        .from('user_insights')
        .insert({
          user_id: this.userId,
          insight_type: type,
          insight_content: content,
          data_source: 'pattern_detection',
          relevance_score: 0.7,
          generated_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Error storing insight:', error);
    }
  }

  /**
   * Get stored patterns from database
   */
  private async getStoredPatterns(): Promise<any[]> {
    const { data, error } = await supabase
      .from('user_patterns')
      .select('*')
      .eq('user_id', this.userId)
      .eq('is_active', true);

    if (error || !data) {
      console.error('Error fetching stored patterns:', error);
      return [];
    }

    return data;
  }

  /**
   * Helper function to get day name
   */
  private getDayName(day: number): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[day] || 'Unknown';
  }

  /**
   * Helper function to get time slot
   */
  private getTimeSlot(hour: number): string {
    if (hour < 6) return 'early morning';
    if (hour < 12) return 'morning';
    if (hour < 14) return 'midday';
    if (hour < 17) return 'afternoon';
    if (hour < 20) return 'evening';
    return 'night';
  }
}