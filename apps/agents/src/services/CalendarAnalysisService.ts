import { getSupabaseService } from './SupabaseService.js';
import Queue from 'bull';
import { v4 as uuidv4 } from 'uuid';

interface Event {
  event_starts_at: string;
  event_ends_at: string;
  event_title: string;
  event_description?: string;
}

interface WorkPatterns {
  peak_hours: number[];
  energy_levels: {
    morning: 'high' | 'medium' | 'low';
    afternoon: 'high' | 'medium' | 'low';
    evening: 'high' | 'medium' | 'low';
  };
  meeting_patterns: {
    avg_per_day: number;
    avg_duration: number;
    preferred_days: string[];
    busy_times: Array<{ day: string; hour: number; frequency: number }>;
  };
  calendar_analysis: {
    analyzed_at: string;
    events_analyzed: number;
    date_range: { start: string; end: string };
  };
}

interface AnalysisJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  result?: WorkPatterns;
  error?: string;
}

// In-memory store for analysis jobs (use Redis in production)
const analysisJobs = new Map<string, AnalysisJob>();

export class CalendarAnalysisService {
  /**
   * Analyze calendar patterns from user events
   */
  static async analyzeCalendarPatterns(userId: string): Promise<WorkPatterns> {
    const supabase = getSupabaseService().getClient();

    // Fetch last 3 months of events
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const { data: events, error } = await supabase
      .from(`u_${userId.replace(/-/g, '')}.events`)
      .select('event_starts_at, event_ends_at, event_title, event_description')
      .gte('event_starts_at', threeMonthsAgo.toISOString())
      .order('event_starts_at', { ascending: true });

    if (error) {
      console.error('Error fetching events:', error);
      throw new Error(`Failed to fetch events: ${error.message}`);
    }

    if (!events || events.length < 10) {
      // Not enough data for analysis, return defaults
      return this.getDefaultPatterns();
    }

    // Extract patterns
    const peak_hours = this.extractPeakHours(events);
    const energy_levels = this.inferEnergyLevels(events);
    const meeting_patterns = this.extractMeetingPatterns(events);

    // Get date range
    const dateRange = {
      start: events[0].event_starts_at,
      end: events[events.length - 1].event_starts_at
    };

    const workPatterns: WorkPatterns = {
      peak_hours,
      energy_levels,
      meeting_patterns,
      calendar_analysis: {
        analyzed_at: new Date().toISOString(),
        events_analyzed: events.length,
        date_range: dateRange
      }
    };

    // Save patterns to profile
    await this.saveWorkPatterns(userId, workPatterns);

    return workPatterns;
  }

  /**
   * Extract peak hours (hours with most events)
   */
  private static extractPeakHours(events: Event[]): number[] {
    const hourCounts = new Map<number, number>();

    events.forEach(event => {
      const startTime = new Date(event.event_starts_at);
      const hour = startTime.getHours();
      hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
    });

    // Sort by count and return top 6 hours
    const sortedHours = Array.from(hourCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([hour]) => hour)
      .sort((a, b) => a - b);

    return sortedHours;
  }

  /**
   * Extract meeting patterns
   */
  private static extractMeetingPatterns(events: Event[]): {
    avg_per_day: number;
    avg_duration: number;
    preferred_days: string[];
    busy_times: Array<{ day: string; hour: number; frequency: number }>;
  } {
    // Identify meetings by keywords
    const meetingKeywords = ['meeting', 'call', 'sync', 'standup', 'review', 'discussion'];
    const meetings = events.filter(event => {
      const title = event.event_title?.toLowerCase() || '';
      const description = event.event_description?.toLowerCase() || '';
      return meetingKeywords.some(keyword =>
        title.includes(keyword) || description.includes(keyword)
      );
    });

    if (meetings.length === 0) {
      return {
        avg_per_day: 0,
        avg_duration: 0,
        preferred_days: [],
        busy_times: []
      };
    }

    // Calculate average meetings per day
    const dateSet = new Set(meetings.map(m =>
      new Date(m.event_starts_at).toDateString()
    ));
    const avg_per_day = meetings.length / dateSet.size;

    // Calculate average duration
    const durations = meetings.map(m => {
      const start = new Date(m.event_starts_at);
      const end = new Date(m.event_ends_at);
      return (end.getTime() - start.getTime()) / (1000 * 60); // minutes
    });
    const avg_duration = durations.reduce((a, b) => a + b, 0) / durations.length;

    // Find preferred days
    const dayCounts = new Map<string, number>();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    meetings.forEach(m => {
      const dayIndex = new Date(m.event_starts_at).getDay();
      const dayName = dayNames[dayIndex];
      dayCounts.set(dayName, (dayCounts.get(dayName) || 0) + 1);
    });

    const preferred_days = Array.from(dayCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([day]) => day);

    // Find busy times (day + hour combinations)
    const busyTimeCounts = new Map<string, number>();
    meetings.forEach(m => {
      const date = new Date(m.event_starts_at);
      const dayIndex = date.getDay();
      const dayName = dayNames[dayIndex];
      const hour = date.getHours();
      const key = `${dayName}-${hour}`;
      busyTimeCounts.set(key, (busyTimeCounts.get(key) || 0) + 1);
    });

    const totalDays = dateSet.size;
    const busy_times = Array.from(busyTimeCounts.entries())
      .map(([key, count]) => {
        const [day, hourStr] = key.split('-');
        return {
          day,
          hour: parseInt(hourStr),
          frequency: count / totalDays
        };
      })
      .filter(bt => bt.frequency > 0.3) // Only include times with >30% frequency
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10);

    return {
      avg_per_day: Math.round(avg_per_day * 10) / 10,
      avg_duration: Math.round(avg_duration),
      preferred_days,
      busy_times
    };
  }

  /**
   * Infer energy levels based on event density
   */
  private static inferEnergyLevels(events: Event[]): {
    morning: 'high' | 'medium' | 'low';
    afternoon: 'high' | 'medium' | 'low';
    evening: 'high' | 'medium' | 'low';
  } {
    const morningEvents = events.filter(e => {
      const hour = new Date(e.event_starts_at).getHours();
      return hour >= 6 && hour < 12;
    });

    const afternoonEvents = events.filter(e => {
      const hour = new Date(e.event_starts_at).getHours();
      return hour >= 12 && hour < 18;
    });

    const eveningEvents = events.filter(e => {
      const hour = new Date(e.event_starts_at).getHours();
      return hour >= 18 && hour < 22;
    });

    const inferLevel = (count: number): 'high' | 'medium' | 'low' => {
      const avgPerDay = count / 90; // Approximate days in 3 months
      if (avgPerDay > 3) return 'high';
      if (avgPerDay > 1) return 'medium';
      return 'low';
    };

    return {
      morning: inferLevel(morningEvents.length),
      afternoon: inferLevel(afternoonEvents.length),
      evening: inferLevel(eveningEvents.length)
    };
  }

  /**
   * Save work patterns to profile
   */
  private static async saveWorkPatterns(userId: string, patterns: WorkPatterns): Promise<void> {
    const supabase = getSupabaseService().getClient();

    const { error } = await supabase
      .from('profile')
      .update({
        work_patterns: patterns
      })
      .eq('id', userId);

    if (error) {
      console.error('Error saving work patterns:', error);
      throw new Error(`Failed to save work patterns: ${error.message}`);
    }
  }

  /**
   * Queue analysis job (async processing)
   */
  static async queueAnalysisJob(userId: string): Promise<string> {
    const jobId = uuidv4();

    // Create job entry
    analysisJobs.set(jobId, {
      id: jobId,
      status: 'pending',
      progress: 0
    });

    // Start processing asynchronously
    this.processAnalysisJob(jobId, userId);

    return jobId;
  }

  /**
   * Process analysis job
   */
  private static async processAnalysisJob(jobId: string, userId: string): Promise<void> {
    const job = analysisJobs.get(jobId);
    if (!job) return;

    try {
      // Update status
      job.status = 'processing';
      job.progress = 10;

      // Analyze patterns
      const patterns = await this.analyzeCalendarPatterns(userId);

      // Update job with result
      job.status = 'completed';
      job.progress = 100;
      job.result = patterns;

      // Clean up after 5 minutes
      setTimeout(() => {
        analysisJobs.delete(jobId);
      }, 5 * 60 * 1000);
    } catch (error: any) {
      console.error('Analysis job failed:', error);
      job.status = 'failed';
      job.error = error.message;
    }
  }

  /**
   * Get analysis job status
   */
  static getAnalysisStatus(jobId: string): AnalysisJob | null {
    return analysisJobs.get(jobId) || null;
  }

  /**
   * Get default patterns when not enough data
   */
  private static getDefaultPatterns(): WorkPatterns {
    return {
      peak_hours: [9, 10, 11, 14, 15, 16],
      energy_levels: {
        morning: 'medium',
        afternoon: 'medium',
        evening: 'low'
      },
      meeting_patterns: {
        avg_per_day: 0,
        avg_duration: 0,
        preferred_days: [],
        busy_times: []
      },
      calendar_analysis: {
        analyzed_at: new Date().toISOString(),
        events_analyzed: 0,
        date_range: { start: '', end: '' }
      }
    };
  }
}
