import { SupabaseService } from './SupabaseService.js';

interface SmartInteraction {
  id: string;
  question: string;
  type: 'yes_no' | 'multiple_choice' | 'text';
  options?: string[];
  eventData?: any;
  priority: number;
  category: string;
}

export class SmartInteractionService {
  private supabaseService: SupabaseService;
  private recentSuggestions: Map<string, Set<string>> = new Map(); // Track what we've suggested per user

  constructor() {
    this.supabaseService = new SupabaseService();
  }

  private hasTimeConflict(events: any[], startTime: string, endTime: string, date?: Date): boolean {
    const targetDate = date || new Date();
    const baseDate = targetDate.toISOString().split('T')[0];
    
    const proposedStart = new Date(`${baseDate}T${startTime}:00`);
    const proposedEnd = new Date(`${baseDate}T${endTime}:00`);
    
    return events.some(event => {
      const eventStart = new Date(event.event_starts_at);
      const eventEnd = new Date(event.event_ends_at);
      
      // Check if events overlap
      return (proposedStart < eventEnd && proposedEnd > eventStart);
    });
  }

  async generateSmartInteractions(userId: string): Promise<SmartInteraction[]> {
    const interactions: SmartInteraction[] = [];
    const now = new Date();
    const today = new Date();
    const currentHour = now.getHours();
    const dayOfWeek = now.getDay();
    const currentMinute = now.getMinutes();
    
    // Get user's events and patterns
    const events = await this.supabaseService.getEventsForAgent(userId);
    const todayEvents = events.filter(event => {
      const eventDate = new Date(event.event_starts_at);
      return eventDate.toDateString() === now.toDateString();
    });
    
    const tomorrowEvents = events.filter(event => {
      const eventDate = new Date(event.event_starts_at);
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return eventDate.toDateString() === tomorrow.toDateString();
    });

    // Get user's recently suggested interactions
    const userSuggestions = this.recentSuggestions.get(userId) || new Set();
    
    // 1. Time-based contextual suggestions
    if (currentHour >= 6 && currentHour < 9 && !userSuggestions.has('morning-routine')) {
      // Check for time conflicts instead of just early meetings
      if (!this.hasTimeConflict(todayEvents, '09:00', '11:00')) {
        interactions.push({
          id: `morning-excellence-${Date.now()}`,
          question: 'Start your day with intention. What\'s your primary focus today?',
          type: 'multiple_choice',
          options: ['Deep Work Project', 'Creative Brainstorming', 'Strategic Planning', 'Learning & Development'],
          eventData: {
            title: 'Morning Focus Block',
            startTime: '09:00',
            endTime: '11:00',
            description: 'Dedicated time for your most important work'
          },
          priority: 9,
          category: 'productivity'
        });
        userSuggestions.add('morning-routine');
      }
    }
    
    // 2. Lunch time wellness check
    if (currentHour === 11 && currentMinute < 30 && !userSuggestions.has('lunch-break')) {
      // Check for time conflicts instead of just hour range
      if (!this.hasTimeConflict(todayEvents, '12:30', '13:30')) {
        interactions.push({
          id: `lunch-wellness-${Date.now()}`,
          question: 'You\'ve been working for hours. Time for a proper lunch break?',
          type: 'yes_no',
          eventData: {
            title: 'Lunch & Recharge',
            startTime: '12:30',
            endTime: '13:30',
            description: 'Step away from work, eat mindfully, and recharge'
          },
          priority: 8,
          category: 'wellness'
        });
        userSuggestions.add('lunch-break');
      }
    }
    
    // 3. End of day review (weekdays)
    if (currentHour >= 16 && currentHour < 18 && dayOfWeek >= 1 && dayOfWeek <= 5 && !userSuggestions.has('day-review')) {
      // Check for time conflicts before suggesting
      if (!this.hasTimeConflict(todayEvents, '17:30', '18:00')) {
        interactions.push({
          id: `day-review-${Date.now()}`,
          question: 'Perfect time for a day review. Celebrate wins and plan tomorrow?',
          type: 'yes_no',
          eventData: {
            title: 'Daily Review & Planning',
            startTime: '17:30',
            endTime: '18:00',
            description: 'Reflect on today\'s accomplishments and set tomorrow\'s priorities'
          },
          priority: 7,
          category: 'planning'
        });
        userSuggestions.add('day-review');
      }
    }
    
    // 4. Weekend planning (Friday afternoon)
    if (dayOfWeek === 5 && currentHour >= 14 && currentHour < 17 && !userSuggestions.has('weekend-planning')) {
      // Check for conflicts on Saturday
      const saturday = new Date(today);
      saturday.setDate(saturday.getDate() + 1);
      const saturdayEvents = await this.supabaseService.getEventsForAgent(
        userId, 
        saturday.toISOString().split('T')[0] + 'T00:00:00Z', 
        saturday.toISOString().split('T')[0] + 'T23:59:59Z'
      );
      
      if (!this.hasTimeConflict(saturdayEvents, '10:00', '12:00', saturday)) {
        interactions.push({
          id: `weekend-planning-${Date.now()}`,
          question: 'Friday afternoon! Plan something enjoyable for the weekend?',
          type: 'multiple_choice',
          options: ['Social Activity', 'Personal Project', 'Rest & Recovery', 'Adventure'],
          eventData: {
            title: 'Weekend Activity',
            startTime: '10:00',
            endTime: '12:00',
            description: 'Time for yourself and what brings you joy'
          },
          priority: 6,
          category: 'personal'
        });
        userSuggestions.add('weekend-planning');
      }
    }
    
    // 5. Meeting preparation reminders
    const upcomingMeeting = todayEvents.find(e => {
      const eventTime = new Date(e.event_starts_at);
      const timeDiff = (eventTime.getTime() - now.getTime()) / (1000 * 60); // minutes
      return timeDiff > 15 && timeDiff < 60 && e.event_title.toLowerCase().includes('meeting');
    });
    
    if (upcomingMeeting && !userSuggestions.has(`prep-${upcomingMeeting.id}`)) {
      const meetingTime = new Date(upcomingMeeting.event_starts_at);
      const prepTime = new Date(meetingTime.getTime() - 15 * 60000); // 15 mins before
      
      interactions.push({
        id: `meeting-prep-${Date.now()}`,
        question: `"${upcomingMeeting.event_title}" starts soon. Block 15 minutes to prepare?`,
        type: 'yes_no',
        eventData: {
          title: `Prep: ${upcomingMeeting.event_title}`,
          startTime: `${prepTime.getHours().toString().padStart(2, '0')}:${prepTime.getMinutes().toString().padStart(2, '0')}`,
          endTime: `${meetingTime.getHours().toString().padStart(2, '0')}:${meetingTime.getMinutes().toString().padStart(2, '0')}`,
          description: 'Review agenda, gather materials, and set intentions'
        },
        priority: 10,
        category: 'preparation'
      });
      userSuggestions.add(`prep-${upcomingMeeting.id}`);
    }
    
    // 6. Exercise reminder based on patterns
    if (currentHour >= 7 && currentHour < 19 && !userSuggestions.has('exercise-today')) {
      const hasExerciseToday = todayEvents.some(e => 
        e.event_title.toLowerCase().match(/gym|workout|exercise|yoga|run|walk|fitness/)
      );
      
      if (!hasExerciseToday) {
        const exerciseTime = currentHour < 12 ? '12:00' : 
                           currentHour < 17 ? '17:30' : '19:00';
        
        interactions.push({
          id: `exercise-reminder-${Date.now()}`,
          question: 'Your body needs movement. Quick exercise session?',
          type: 'multiple_choice',
          options: ['30-min Walk', '20-min HIIT', 'Yoga Flow', 'Gym Session'],
          eventData: {
            title: 'Exercise',
            startTime: exerciseTime,
            endTime: `${parseInt(exerciseTime) + 1}:00`,
            description: 'Movement for physical and mental health'
          },
          priority: 7,
          category: 'health'
        });
        userSuggestions.add('exercise-today');
      }
    }
    
    // 7. Tomorrow preparation (evening)
    if (currentHour >= 20 && currentHour < 22 && tomorrowEvents.length > 0 && !userSuggestions.has('tomorrow-prep')) {
      const firstEvent = tomorrowEvents.sort((a, b) => 
        new Date(a.event_starts_at).getTime() - new Date(b.event_starts_at).getTime()
      )[0];
      
      interactions.push({
        id: `tomorrow-prep-${Date.now()}`,
        question: `Tomorrow starts with "${firstEvent.event_title}". Review your day now?`,
        type: 'yes_no',
        eventData: {
          title: 'Tomorrow Planning',
          startTime: '21:00',
          endTime: '21:15',
          description: 'Quick review of tomorrow\'s schedule and priorities'
        },
        priority: 5,
        category: 'planning'
      });
      userSuggestions.add('tomorrow-prep');
    }
    
    // 8. Smart gap detection with variety
    const gaps = this.findMeaningfulGaps(todayEvents);
    if (gaps.length > 0 && !userSuggestions.has('gap-fill')) {
      const gap = gaps[0]; // Take the best gap
      const gapActivities = this.getGapActivities(gap.duration, currentHour);
      
      if (gapActivities.length > 0) {
        interactions.push({
          id: `smart-gap-${Date.now()}`,
          question: `You have ${gap.duration} minutes free. How would you like to use it?`,
          type: 'multiple_choice',
          options: gapActivities.map(a => a.name),
          eventData: {
            title: 'Productive Break',
            startTime: gap.startTime,
            endTime: gap.endTime,
            description: 'Make the most of your free time'
          },
          priority: 6,
          category: 'optimization'
        });
        userSuggestions.add('gap-fill');
      }
    }
    
    // Update recent suggestions
    this.recentSuggestions.set(userId, userSuggestions);
    
    // Sort by priority and return only the top interaction to avoid duplicates
    return interactions
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 1);
  }
  
  private findMeaningfulGaps(events: any[]): Array<{duration: number, startTime: string, endTime: string}> {
    const gaps = [];
    const sortedEvents = events.sort((a, b) => 
      new Date(a.event_starts_at).getTime() - new Date(b.event_starts_at).getTime()
    );
    
    for (let i = 0; i < sortedEvents.length - 1; i++) {
      const currentEnd = new Date(sortedEvents[i].event_ends_at);
      const nextStart = new Date(sortedEvents[i + 1].event_starts_at);
      const gapMinutes = (nextStart.getTime() - currentEnd.getTime()) / (1000 * 60);
      
      if (gapMinutes >= 30 && gapMinutes <= 180) { // 30 mins to 3 hours
        gaps.push({
          duration: gapMinutes,
          startTime: `${currentEnd.getHours().toString().padStart(2, '0')}:${currentEnd.getMinutes().toString().padStart(2, '0')}`,
          endTime: `${nextStart.getHours().toString().padStart(2, '0')}:${nextStart.getMinutes().toString().padStart(2, '0')}`
        });
      }
    }
    
    return gaps;
  }
  
  private getGapActivities(durationMinutes: number, currentHour: number): Array<{name: string, duration: number}> {
    const activities = [];
    
    if (durationMinutes >= 30 && durationMinutes < 60) {
      activities.push(
        { name: 'Quick Walk', duration: 20 },
        { name: 'Email Triage', duration: 30 },
        { name: 'Meditation', duration: 15 },
        { name: 'Snack & Stretch', duration: 20 }
      );
    } else if (durationMinutes >= 60 && durationMinutes < 120) {
      activities.push(
        { name: 'Deep Work Sprint', duration: 60 },
        { name: 'Learning Session', duration: 45 },
        { name: 'Workout', duration: 45 },
        { name: 'Creative Project', duration: 60 }
      );
    } else if (durationMinutes >= 120) {
      activities.push(
        { name: 'Major Project Work', duration: 120 },
        { name: 'Strategic Planning', duration: 90 },
        { name: 'Long Walk/Exercise', duration: 90 },
        { name: 'Personal Development', duration: 120 }
      );
    }
    
    // Filter based on time of day
    if (currentHour < 12) {
      return activities.filter(a => !a.name.toLowerCase().includes('walk'));
    } else if (currentHour > 17) {
      return activities.filter(a => !a.name.toLowerCase().includes('work'));
    }
    
    return activities.slice(0, 3); // Return top 3 options
  }
  
  // Clear suggestions every 6 hours
  clearOldSuggestions() {
    this.recentSuggestions.clear();
  }
}