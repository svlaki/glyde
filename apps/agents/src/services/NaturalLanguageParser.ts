import { parse } from 'chrono-node';

export interface ParsedDateTime {
  startTime: Date;
  endTime?: Date;
  isAllDay?: boolean;
  hasTime?: boolean;
  confidence: number;
}

export interface ParsedEventRequest {
  title?: string;
  startTime?: Date;
  endTime?: Date;
  location?: string;
  description?: string;
  isRecurring?: boolean;
  recurringPattern?: string;
  attendees?: string[];
  confidence: number;
  suggestedDuration?: number; // in minutes
}

/**
 * Enhanced natural language parser for calendar commands
 * Inspired by Fantastical, Motion, and Trevor AI approaches
 */
export class NaturalLanguageParser {
  private commonPatterns = {
    // Meeting patterns
    meeting: /\b(meeting|sync|call|chat|1:1|one-on-one|standup|stand-up|check-in)\b/i,
    
    // Activity patterns
    breakfast: /\b(breakfast|morning coffee)\b/i,
    lunch: /\b(lunch|lunch break)\b/i,
    dinner: /\b(dinner|supper)\b/i,
    
    // Work patterns
    work: /\b(work on|working on|focus time|deep work|coding|writing|planning)\b/i,
    
    // Personal patterns  
    personal: /\b(gym|workout|exercise|doctor|dentist|appointment|haircut)\b/i,
    
    // Location extraction
    location: /\b(?:at|in|@)\s+([^,\.]+)/i,
    
    // Duration extraction
    duration: /\b(?:for\s+)?(\d+)\s*(hours?|hrs?|minutes?|mins?)\b/i,
    
    // Attendee extraction
    attendees: /\b(?:with|and)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g,
  };

  private defaultDurations: Record<string, number> = {
    meeting: 30,
    '1:1': 30,
    standup: 15,
    breakfast: 30,
    lunch: 60,
    dinner: 90,
    workout: 60,
    'focus time': 120,
    'deep work': 120,
    appointment: 60,
  };

  private smartTimeDefaults: Record<string, { hour: number; minute: number }> = {
    breakfast: { hour: 8, minute: 0 },
    'morning coffee': { hour: 9, minute: 0 },
    standup: { hour: 9, minute: 30 },
    lunch: { hour: 12, minute: 0 },
    dinner: { hour: 18, minute: 30 },
    workout: { hour: 7, minute: 0 },
  };

  /**
   * Parse natural language text into event parameters
   * Examples:
   * - "Meeting with John tomorrow at 2pm"
   * - "Lunch with Sarah next Tuesday"
   * - "Doctor appointment Friday at 3:30pm for 45 minutes"
   */
  parseEventRequest(text: string): ParsedEventRequest {
    const result: ParsedEventRequest = {
      confidence: 0,
    };

    // Extract title/activity type
    const { title, eventType } = this.extractTitle(text);
    result.title = title;

    // Parse date/time using chrono-node (handles "tomorrow", "next Tuesday", etc.)
    const parsedDate = this.parseDateTime(text, eventType);
    if (parsedDate) {
      result.startTime = parsedDate.startTime;
      result.endTime = parsedDate.endTime;
      result.confidence = parsedDate.confidence;
    }

    // Extract location
    const location = this.extractLocation(text);
    if (location) {
      result.location = location;
    }

    // Extract duration if specified
    const duration = this.extractDuration(text);
    if (duration && result.startTime && !result.endTime) {
      result.endTime = new Date(result.startTime.getTime() + duration * 60000);
      result.suggestedDuration = duration;
    }

    // Extract attendees
    const attendees = this.extractAttendees(text);
    if (attendees.length > 0) {
      result.attendees = attendees;
    }

    // Check for recurring patterns
    const recurringInfo = this.extractRecurringPattern(text);
    if (recurringInfo) {
      result.isRecurring = true;
      result.recurringPattern = recurringInfo;
    }

    // Apply smart defaults if we don't have an end time
    if (result.startTime && !result.endTime) {
      const defaultDuration = this.getDefaultDuration(eventType || title || '');
      result.endTime = new Date(result.startTime.getTime() + defaultDuration * 60000);
      result.suggestedDuration = defaultDuration;
    }

    return result;
  }

  private extractTitle(text: string): { title: string; eventType?: string } {
    // Remove common command prefixes
    let cleanText = text.replace(/^(schedule|add|create|new|book|set up|plan)\s+/i, '');
    
    // Check for known event types
    for (const [type, pattern] of Object.entries(this.commonPatterns)) {
      if (pattern.test(cleanText)) {
        const eventType = cleanText.match(pattern)?.[0]?.toLowerCase();
        
        // Build a descriptive title
        const attendees = this.extractAttendees(cleanText);
        if (attendees.length > 0 && eventType?.includes('meeting')) {
          return { 
            title: `Meeting with ${attendees.join(', ')}`,
            eventType: 'meeting'
          };
        }
        
        return { title: cleanText.split(/\b(at|on|tomorrow|today|next)\b/i)[0].trim(), eventType };
      }
    }

    // Default: use the first part before time/date indicators
    const title = cleanText.split(/\b(at|on|tomorrow|today|next|for\s+\d+)\b/i)[0].trim();
    return { title: title || 'New Event' };
  }

  private parseDateTime(text: string, eventType?: string): ParsedDateTime | null {
    // Use chrono-node for robust parsing
    const chronoResults = parse(text, new Date(), { forwardDate: true });
    
    if (chronoResults.length > 0) {
      const result = chronoResults[0];
      const startTime = result.start.date();
      
      // Check if time was explicitly specified
      const hasTime = result.start.isCertain('hour');
      
      // If no time specified, apply smart defaults based on event type
      if (!hasTime && eventType) {
        const defaults = this.smartTimeDefaults[eventType];
        if (defaults) {
          startTime.setHours(defaults.hour, defaults.minute, 0, 0);
        }
      }

      let endTime: Date | undefined;
      if (result.end) {
        endTime = result.end.date();
      }

      return {
        startTime,
        endTime,
        hasTime,
        isAllDay: !hasTime,
        confidence: hasTime ? 0.9 : 0.7,
      };
    }

    return null;
  }

  private extractLocation(text: string): string | null {
    const match = text.match(this.commonPatterns.location);
    if (match) {
      return match[1].trim();
    }

    // Check for common location indicators
    const locationKeywords = ['zoom', 'teams', 'meet', 'office', 'home', 'coffee shop', 'restaurant'];
    for (const keyword of locationKeywords) {
      if (text.toLowerCase().includes(keyword)) {
        return keyword.charAt(0).toUpperCase() + keyword.slice(1);
      }
    }

    return null;
  }

  private extractDuration(text: string): number | null {
    const match = text.match(this.commonPatterns.duration);
    if (match) {
      const value = parseInt(match[1]);
      const unit = match[2].toLowerCase();
      
      if (unit.startsWith('hour') || unit.startsWith('hr')) {
        return value * 60;
      } else {
        return value;
      }
    }
    return null;
  }

  private extractAttendees(text: string): string[] {
    const attendees: string[] = [];
    const matches = text.matchAll(this.commonPatterns.attendees);
    
    for (const match of matches) {
      if (match[1]) {
        attendees.push(match[1]);
      }
    }
    
    return attendees;
  }

  private extractRecurringPattern(text: string): string | null {
    const recurringPatterns = [
      /\bevery\s+(day|weekday|weekend|monday|tuesday|wednesday|thursday|friday|saturday|sunday|week|month|year)\b/i,
      /\b(daily|weekly|monthly|yearly|biweekly)\b/i,
      /\bevery\s+other\s+(day|week|month)\b/i,
    ];

    for (const pattern of recurringPatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[0];
      }
    }

    return null;
  }

  private getDefaultDuration(eventType: string): number {
    const normalizedType = eventType.toLowerCase();
    
    for (const [type, duration] of Object.entries(this.defaultDurations)) {
      if (normalizedType.includes(type)) {
        return duration;
      }
    }
    
    // Default to 60 minutes if no match
    return 60;
  }

  /**
   * Parse task-specific commands
   * Examples:
   * - "Remind me to call John tomorrow"
   * - "Task: finish report by Friday"
   */
  parseTaskRequest(text: string): {
    title: string;
    dueDate?: Date;
    priority?: 'low' | 'medium' | 'high';
    reminder?: Date;
  } {
    // Remove task-specific prefixes
    let cleanText = text.replace(/^(remind me to|task:|todo:|add task|create task)\s+/i, '');
    
    // Extract due date
    const chronoResults = parse(cleanText, new Date(), { forwardDate: true });
    let dueDate: Date | undefined;
    
    if (chronoResults.length > 0) {
      dueDate = chronoResults[0].start.date();
      // Remove the date part from the title
      cleanText = cleanText.replace(chronoResults[0].text, '').trim();
    }

    // Extract priority
    let priority: 'low' | 'medium' | 'high' | undefined;
    if (/\b(urgent|asap|high priority|important)\b/i.test(text)) {
      priority = 'high';
    } else if (/\b(low priority|whenever|someday)\b/i.test(text)) {
      priority = 'low';
    } else {
      priority = 'medium';
    }

    // Clean up the title
    const title = cleanText.replace(/\b(by|before|until)\b/gi, '').trim();

    return {
      title: title || 'New Task',
      dueDate,
      priority,
      reminder: dueDate ? new Date(dueDate.getTime() - 24 * 60 * 60 * 1000) : undefined, // Remind 1 day before
    };
  }
}

// Export singleton instance
export const nlpParser = new NaturalLanguageParser();