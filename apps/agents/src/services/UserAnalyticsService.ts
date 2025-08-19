import { supabase } from './SupabaseService.js';

interface EventAnalytics {
  date: string;
  totalEvents: number;
  totalMeetingTime: number;
  totalFocusTime: number;
  totalBreakTime: number;
  eventCategories: { [key: string]: number };
  peakHours: { hour: number; count: number }[];
}

interface UserInteraction {
  type: string;
  action: string;
  context?: any;
  result?: string;
  timestamp: string;
}

export class UserAnalyticsService {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  /**
   * Track a user interaction
   */
  async trackInteraction(
    type: string,
    action: string,
    context?: any,
    result?: string
  ): Promise<void> {
    try {
      await supabase.from('user_interactions').insert({
        user_id: this.userId,
        interaction_type: type,
        action,
        context,
        result,
        timestamp: new Date().toISOString(),
        session_id: this.generateSessionId()
      });
    } catch (error) {
      console.error('Error tracking interaction:', error);
    }
  }

  /**
   * Analyze events for a specific date
   */
  async analyzeDailyEvents(date: Date): Promise<EventAnalytics> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const { data: events, error } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', this.userId)
      .gte('start_time', startOfDay.toISOString())
      .lte('start_time', endOfDay.toISOString());

    if (error || !events) {
      console.error('Error fetching events for analytics:', error);
      return this.getEmptyAnalytics(date);
    }

    // Calculate metrics
    let totalMeetingTime = 0;
    let totalFocusTime = 0;
    let totalBreakTime = 0;
    const eventCategories: { [key: string]: number } = {};
    const hourCounts: { [key: number]: number } = {};

    events.forEach(event => {
      const startTime = new Date(event.start_time);
      const endTime = new Date(event.end_time);
      const duration = (endTime.getTime() - startTime.getTime()) / (1000 * 60); // minutes
      const hour = startTime.getHours();
      
      // Count by hour
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;

      // Categorize and sum durations
      const title = event.title.toLowerCase();
      let category = 'other';
      
      if (title.includes('meeting') || title.includes('call') || title.includes('sync')) {
        category = 'meeting';
        totalMeetingTime += duration;
      } else if (title.includes('focus') || title.includes('deep work') || title.includes('coding')) {
        category = 'focus';
        totalFocusTime += duration;
      } else if (title.includes('break') || title.includes('lunch') || title.includes('coffee')) {
        category = 'break';
        totalBreakTime += duration;
      } else if (title.includes('workout') || title.includes('gym') || title.includes('exercise')) {
        category = 'fitness';
      } else if (title.includes('personal') || title.includes('dinner') || title.includes('family')) {
        category = 'personal';
      }

      eventCategories[category] = (eventCategories[category] || 0) + 1;
    });

    // Find peak hours
    const peakHours = Object.entries(hourCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([hour, count]) => ({
        hour: parseInt(hour),
        count
      }));

    const analytics: EventAnalytics = {
      date: date.toISOString().split('T')[0],
      totalEvents: events.length,
      totalMeetingTime,
      totalFocusTime,
      totalBreakTime,
      eventCategories,
      peakHours
    };

    // Store analytics in database
    await this.storeAnalytics(analytics);

    return analytics;
  }

  /**
   * Get analytics for a date range
   */
  async getAnalytics(startDate: Date, endDate: Date): Promise<EventAnalytics[]> {
    const { data, error } = await supabase
      .from('event_analytics')
      .select('*')
      .eq('user_id', this.userId)
      .gte('date', startDate.toISOString().split('T')[0])
      .lte('date', endDate.toISOString().split('T')[0])
      .order('date', { ascending: true });

    if (error || !data) {
      console.error('Error fetching analytics:', error);
      return [];
    }

    return data.map(item => ({
      date: item.date,
      totalEvents: item.total_events,
      totalMeetingTime: this.intervalToMinutes(item.total_meeting_time),
      totalFocusTime: this.intervalToMinutes(item.total_focus_time),
      totalBreakTime: this.intervalToMinutes(item.total_break_time),
      eventCategories: item.event_categories || {},
      peakHours: item.peak_hours || []
    }));
  }

  /**
   * Generate weekly summary
   */
  async generateWeeklySummary(): Promise<{
    totalEvents: number;
    totalMeetingTime: number;
    totalFocusTime: number;
    averageEventsPerDay: number;
    busiestDay: string;
    mostCommonCategory: string;
  }> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    const analytics = await this.getAnalytics(startDate, endDate);

    if (analytics.length === 0) {
      return {
        totalEvents: 0,
        totalMeetingTime: 0,
        totalFocusTime: 0,
        averageEventsPerDay: 0,
        busiestDay: 'No data',
        mostCommonCategory: 'No data'
      };
    }

    const totalEvents = analytics.reduce((sum, day) => sum + day.totalEvents, 0);
    const totalMeetingTime = analytics.reduce((sum, day) => sum + day.totalMeetingTime, 0);
    const totalFocusTime = analytics.reduce((sum, day) => sum + day.totalFocusTime, 0);
    
    // Find busiest day
    const busiestDayData = analytics.reduce((max, day) => 
      day.totalEvents > (max?.totalEvents || 0) ? day : max
    );
    
    // Aggregate categories
    const allCategories: { [key: string]: number } = {};
    analytics.forEach(day => {
      Object.entries(day.eventCategories).forEach(([cat, count]) => {
        allCategories[cat] = (allCategories[cat] || 0) + count;
      });
    });
    
    const mostCommonCategory = Object.entries(allCategories)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'none';

    return {
      totalEvents,
      totalMeetingTime,
      totalFocusTime,
      averageEventsPerDay: totalEvents / 7,
      busiestDay: new Date(busiestDayData.date).toLocaleDateString('en-US', { weekday: 'long' }),
      mostCommonCategory
    };
  }

  /**
   * Get recent user interactions
   */
  async getRecentInteractions(limit: number = 50): Promise<UserInteraction[]> {
    const { data, error } = await supabase
      .from('user_interactions')
      .select('*')
      .eq('user_id', this.userId)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error || !data) {
      console.error('Error fetching interactions:', error);
      return [];
    }

    return data.map(item => ({
      type: item.interaction_type,
      action: item.action,
      context: item.context,
      result: item.result,
      timestamp: item.timestamp
    }));
  }

  /**
   * Update user context
   */
  async updateContext(key: string, value: any, type: string = 'general'): Promise<void> {
    try {
      const { data: existing } = await supabase
        .from('user_context')
        .select('mention_count, importance_score')
        .eq('user_id', this.userId)
        .eq('context_key', key)
        .single();

      const mentionCount = (existing?.mention_count || 0) + 1;
      const importanceScore = Math.min(1, 0.5 + (mentionCount * 0.05));

      await supabase
        .from('user_context')
        .upsert({
          user_id: this.userId,
          context_key: key,
          context_value: value,
          context_type: type,
          last_mentioned: new Date().toISOString(),
          mention_count: mentionCount,
          importance_score: importanceScore,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,context_key'
        });
    } catch (error) {
      console.error('Error updating context:', error);
    }
  }

  /**
   * Get user context
   */
  async getUserContext(): Promise<{ [key: string]: any }> {
    const { data, error } = await supabase
      .from('user_context')
      .select('*')
      .eq('user_id', this.userId)
      .order('importance_score', { ascending: false });

    if (error || !data) {
      console.error('Error fetching user context:', error);
      return {};
    }

    const context: { [key: string]: any } = {};
    data.forEach(item => {
      context[item.context_key] = {
        value: item.context_value,
        type: item.context_type,
        importance: item.importance_score,
        lastMentioned: item.last_mentioned
      };
    });

    return context;
  }

  /**
   * Store analytics in database
   */
  private async storeAnalytics(analytics: EventAnalytics): Promise<void> {
    try {
      await supabase
        .from('event_analytics')
        .upsert({
          user_id: this.userId,
          date: analytics.date,
          total_events: analytics.totalEvents,
          total_meeting_time: `${analytics.totalMeetingTime} minutes`,
          total_focus_time: `${analytics.totalFocusTime} minutes`,
          total_break_time: `${analytics.totalBreakTime} minutes`,
          event_categories: analytics.eventCategories,
          peak_hours: analytics.peakHours,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,date'
        });
    } catch (error) {
      console.error('Error storing analytics:', error);
    }
  }

  /**
   * Helper to convert PostgreSQL interval to minutes
   */
  private intervalToMinutes(interval: string | null): number {
    if (!interval) return 0;
    
    // Parse PostgreSQL interval format (e.g., "01:30:00" or "90 minutes")
    if (interval.includes('minutes')) {
      return parseInt(interval.split(' ')[0]);
    }
    
    const parts = interval.split(':');
    if (parts.length === 3) {
      return parseInt(parts[0]) * 60 + parseInt(parts[1]);
    }
    
    return 0;
  }

  /**
   * Generate a session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get empty analytics object
   */
  private getEmptyAnalytics(date: Date): EventAnalytics {
    return {
      date: date.toISOString().split('T')[0],
      totalEvents: 0,
      totalMeetingTime: 0,
      totalFocusTime: 0,
      totalBreakTime: 0,
      eventCategories: {},
      peakHours: []
    };
  }
}