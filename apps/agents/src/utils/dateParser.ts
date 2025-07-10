export class DateParser {
  static parseNaturalLanguage(input: string): { startTime: string; endTime: string } {
    const now = new Date();
    let startTime: Date;
    let endTime: Date;

    // Handle specific days of the week
    const dayMatch = input.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
    if (dayMatch) {
      const targetDay = dayMatch[1].toLowerCase();
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const targetDayIndex = dayNames.indexOf(targetDay);
      const currentDayIndex = now.getDay();
      
      let daysToAdd = targetDayIndex - currentDayIndex;
      if (daysToAdd <= 0) {
        daysToAdd += 7; // Next week if day has passed or is today
      }
      
      startTime = new Date(now);
      startTime.setDate(now.getDate() + daysToAdd);
      
      // Extract time from input
      const timeMatch = input.match(/(\d{1,2})\s*(am|pm)/i);
      if (timeMatch) {
        let hour = parseInt(timeMatch[1]);
        const period = timeMatch[2].toLowerCase();
        
        if (period === 'pm' && hour !== 12) {
          hour += 12;
        } else if (period === 'am' && hour === 12) {
          hour = 0;
        }
        
        startTime.setHours(hour, 0, 0, 0);
      } else {
        startTime.setHours(9, 0, 0, 0); // Default to 9am
      }
    }
    // Handle "tomorrow" keyword
    else if (input.toLowerCase().includes('tomorrow')) {
      startTime = new Date(now);
      startTime.setDate(now.getDate() + 1);
      
      // Extract time from input
      const timeMatch = input.match(/(\d{1,2})\s*(am|pm)/i);
      if (timeMatch) {
        let hour = parseInt(timeMatch[1]);
        const period = timeMatch[2].toLowerCase();
        
        if (period === 'pm' && hour !== 12) {
          hour += 12;
        } else if (period === 'am' && hour === 12) {
          hour = 0;
        }
        
        startTime.setHours(hour, 0, 0, 0);
      } else {
        startTime.setHours(9, 0, 0, 0); // Default to 9am
      }
    } else {
      // Handle times for today
      const timeMatch = input.match(/(\d{1,2})\s*(am|pm)/i);
      if (timeMatch) {
        let hour = parseInt(timeMatch[1]);
        const period = timeMatch[2].toLowerCase();
        
        if (period === 'pm' && hour !== 12) {
          hour += 12;
        } else if (period === 'am' && hour === 12) {
          hour = 0;
        }
        
        startTime = new Date(now);
        startTime.setHours(hour, 0, 0, 0);
        
        // If time has passed today, schedule for tomorrow
        if (startTime <= now) {
          startTime.setDate(now.getDate() + 1);
        }
      } else {
        startTime = new Date(now);
        startTime.setHours(9, 0, 0, 0);
      }
    }

    // Handle end time
    const rangeMatch = input.match(/(\d{1,2})\s*(am|pm)\s*(?:to|-)?\s*(\d{1,2})\s*(am|pm)/i);
    if (rangeMatch) {
      let endHour = parseInt(rangeMatch[3]);
      const endPeriod = rangeMatch[4].toLowerCase();
      
      if (endPeriod === 'pm' && endHour !== 12) {
        endHour += 12;
      } else if (endPeriod === 'am' && endHour === 12) {
        endHour = 0;
      }
      
      endTime = new Date(startTime);
      endTime.setHours(endHour, 0, 0, 0);
    } else {
      // Default to 1 hour duration
      endTime = new Date(startTime);
      endTime.setHours(startTime.getHours() + 1);
    }

    return {
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString()
    };
  }

  static extractTitle(input: string): string {
    // Remove time-related words and extract meaningful title
    const cleanInput = input
      .replace(/schedule|create|set up|book|add/gi, '')
      .replace(/tomorrow|today|friday|monday|tuesday|wednesday|thursday|saturday|sunday/gi, '')
      .replace(/\d{1,2}\s*(am|pm)/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (cleanInput.length > 0) {
      return cleanInput.charAt(0).toUpperCase() + cleanInput.slice(1);
    }

    return "Event";
  }
}