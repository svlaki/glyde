/**
 * GraphitiMemoryService - Node.js client for Graphiti knowledge graph
 * Provides temporally-aware memory capabilities for AI agents
 */

export interface Episode {
  user_id: string;
  name: string;
  episode_body: string;
  source: 'message' | 'event' | 'task' | 'goal' | 'text' | 'json';
  reference_time?: Date;
  source_description?: string;
}

export interface SearchResult {
  fact: string;
  uuid?: string;
  created_at?: string;
  source?: string;
}

export interface SearchResponse {
  results: SearchResult[];
  center_node_uuid?: string;
}

export interface MemoryContext {
  user_id: string;
  context_type: string;
  user_node_uuid: string;
  facts: Array<{
    fact: string;
    relevance: string;
    timestamp?: string;
  }>;
  total_facts: number;
}

export interface UserNode {
  user_node_uuid: string;
  created: boolean;
}

export class GraphitiMemoryService {
  private baseUrl: string;

  constructor(baseUrl = process.env.GRAPHITI_SERVICE_URL || 'http://localhost:8001') {
    this.baseUrl = baseUrl.replace(/\/+$/, ''); // Remove trailing slashes
  }

  /**
   * Add an episode to the knowledge graph
   */
  async addEpisode(episode: Episode): Promise<{ status: string; message: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/episodes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...episode,
          reference_time: episode.reference_time?.toISOString(),
        }),
      });

      if (!response.ok) {
        const error = await response.json() as any;
        throw new Error(error.detail || `HTTP ${response.status}`);
      }

      return await response.json() as any;
    } catch (error) {
      console.error('Failed to add episode to Graphiti:', error);
      throw new Error(`Graphiti addEpisode failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search the knowledge graph for relevant information
   */
  async search(
    userId: string,
    query: string,
    centerNodeUuid?: string,
    numResults = 10
  ): Promise<SearchResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          query,
          center_node_uuid: centerNodeUuid,
          num_results: numResults,
        }),
      });

      if (!response.ok) {
        const error = await response.json() as any;
        throw new Error(error.detail || `HTTP ${response.status}`);
      }

      return await response.json() as any;
    } catch (error) {
      console.error('Failed to search Graphiti:', error);
      throw new Error(`Graphiti search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Ensure a user node exists and get its UUID
   */
  async ensureUserNode(userId: string): Promise<UserNode> {
    try {
      const response = await fetch(`${this.baseUrl}/users/${userId}/node`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json() as any;
        throw new Error(error.detail || `HTTP ${response.status}`);
      }

      return await response.json() as any;
    } catch (error) {
      console.error('Failed to ensure user node in Graphiti:', error);
      throw new Error(`Graphiti ensureUserNode failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get memory context for a user based on situation
   */
  async getMemoryContext(
    userId: string,
    contextType: 'conversation' | 'task_planning' | 'goal_coaching',
    query?: string,
    limit = 10
  ): Promise<MemoryContext> {
    try {
      const response = await fetch(`${this.baseUrl}/users/${userId}/context`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          context_type: contextType,
          query,
          limit,
        }),
      });

      if (!response.ok) {
        const error = await response.json() as any;
        throw new Error(error.detail || `HTTP ${response.status}`);
      }

      return await response.json() as any;
    } catch (error) {
      console.error('Failed to get memory context from Graphiti:', error);
      throw new Error(`Graphiti getMemoryContext failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Add conversation episode
   */
  async addConversationEpisode(
    userId: string,
    userMessage: string,
    assistantResponse: string,
    sessionId?: string
  ): Promise<void> {
    // Only store meaningful conversations, skip very short or generic exchanges
    if (userMessage.trim().length < 10 || assistantResponse.trim().length < 20) {
      return; // Skip trivial exchanges
    }

    // Extract key topics and intents from the conversation
    const conversationSummary = this.extractConversationSummary(userMessage, assistantResponse);
    
    const episode: Episode = {
      user_id: userId,
      name: `Conversation: ${conversationSummary.topic}`,
      episode_body: this.formatConversationEpisode(userMessage, assistantResponse, conversationSummary),
      source: 'message',
      reference_time: new Date(),
      source_description: `Chat Session${sessionId ? ` (${sessionId})` : ''}`,
    };

    await this.addEpisode(episode);
  }

  private extractConversationSummary(userMessage: string, assistantResponse: string): {
    topic: string;
    intent: string;
    keyEntities: string[];
  } {
    // Simple extraction logic - could be enhanced with NLP
    const userLower = userMessage.toLowerCase();
    const responseLower = assistantResponse.toLowerCase();
    
    let topic = 'General';
    let intent = 'question';
    const keyEntities: string[] = [];
    
    // Detect topic
    if (userLower.includes('calendar') || userLower.includes('schedule') || userLower.includes('meeting')) {
      topic = 'Calendar Management';
    } else if (userLower.includes('task') || userLower.includes('todo') || userLower.includes('work')) {
      topic = 'Task Planning';
    } else if (userLower.includes('goal') || userLower.includes('plan') || userLower.includes('habit')) {
      topic = 'Goal Setting';
    } else if (userLower.includes('help') || userLower.includes('how')) {
      topic = 'Help Request';
    }
    
    // Detect intent
    if (userLower.includes('create') || userLower.includes('add') || userLower.includes('new')) {
      intent = 'create';
    } else if (userLower.includes('delete') || userLower.includes('remove') || userLower.includes('cancel')) {
      intent = 'delete';
    } else if (userLower.includes('update') || userLower.includes('change') || userLower.includes('edit')) {
      intent = 'update';
    } else if (userLower.includes('find') || userLower.includes('search') || userLower.includes('show')) {
      intent = 'search';
    }
    
    // Extract entities (simple regex patterns)
    const timePattern = /\b(?:today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}:\d{2}|\d{1,2}pm|\d{1,2}am)\b/gi;
    const namePattern = /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g;
    
    const timeMatches = userMessage.match(timePattern);
    const nameMatches = userMessage.match(namePattern);
    
    if (timeMatches) keyEntities.push(...timeMatches);
    if (nameMatches) keyEntities.push(...nameMatches);
    
    return { topic, intent, keyEntities };
  }

  private formatConversationEpisode(userMessage: string, assistantResponse: string, summary: any): string {
    let episode = `User Intent: ${summary.intent} (${summary.topic})\n`;
    episode += `User Request: ${userMessage}\n`;
    
    if (summary.keyEntities.length > 0) {
      episode += `Key Details: ${summary.keyEntities.join(', ')}\n`;
    }
    
    // Summarize assistant response rather than storing full text
    const responseLines = assistantResponse.split('\n').filter(line => line.trim().length > 0);
    const responseSummary = responseLines.slice(0, 2).join(' ').substring(0, 200) + '...';
    episode += `Assistant Response: ${responseSummary}`;
    
    return episode;
  }

  /**
   * Add task completion episode
   */
  async addTaskCompletionEpisode(
    userId: string,
    taskTitle: string,
    taskDescription: string | null,
    completionTime: Date,
    energyUsed?: 'low' | 'medium' | 'high',
    actualDuration?: number,
    completionNotes?: string
  ): Promise<void> {
    let episodeBody = `User completed task: "${taskTitle}"`;
    
    if (taskDescription) {
      episodeBody += `\nDescription: ${taskDescription}`;
    }
    
    if (energyUsed) {
      episodeBody += `\nEnergy level required: ${energyUsed}`;
    }
    
    if (actualDuration) {
      episodeBody += `\nTime taken: ${actualDuration} minutes`;
    }
    
    if (completionNotes) {
      episodeBody += `\nReflection: ${completionNotes}`;
    }

    const episode: Episode = {
      user_id: userId,
      name: `Task Completion: ${taskTitle}`,
      episode_body: episodeBody,
      source: 'task',
      reference_time: completionTime,
      source_description: 'Task Management System',
    };

    await this.addEpisode(episode);
  }

  /**
   * Add goal progress episode
   */
  async addGoalProgressEpisode(
    userId: string,
    goalTitle: string,
    progressUpdate: string,
    currentProgress: number,
    moodRating?: number,
    confidenceLevel?: number
  ): Promise<void> {
    let episodeBody = `Goal progress update for "${goalTitle}": ${progressUpdate}`;
    episodeBody += `\nCurrent progress: ${currentProgress}%`;
    
    if (moodRating) {
      episodeBody += `\nMood: ${moodRating}/5`;
    }
    
    if (confidenceLevel) {
      episodeBody += `\nConfidence: ${confidenceLevel}/5`;
    }

    const episode: Episode = {
      user_id: userId,
      name: `Goal Progress: ${goalTitle}`,
      episode_body: episodeBody,
      source: 'goal',
      reference_time: new Date(),
      source_description: 'Goal Tracking System',
    };

    await this.addEpisode(episode);
  }

  /**
   * Add calendar event episode
   */
  async addCalendarEventEpisode(
    userId: string,
    eventTitle: string,
    eventDescription: string | null,
    startTime: Date,
    endTime: Date,
    location?: string | null,
    archetype?: string
  ): Promise<void> {
    let episodeBody = `User scheduled event: "${eventTitle}"`;
    
    if (eventDescription) {
      episodeBody += `\nDescription: ${eventDescription}`;
    }
    
    episodeBody += `\nTime: ${startTime.toLocaleString()} - ${endTime.toLocaleString()}`;
    
    if (location) {
      episodeBody += `\nLocation: ${location}`;
    }
    
    if (archetype && archetype !== 'generic') {
      episodeBody += `\nType: ${archetype}`;
    }

    const episode: Episode = {
      user_id: userId,
      name: `Calendar Event: ${eventTitle}`,
      episode_body: episodeBody,
      source: 'event',
      reference_time: startTime,
      source_description: 'Calendar System',
    };

    await this.addEpisode(episode);
  }

  /**
   * Health check for Graphiti service
   */
  async healthCheck(): Promise<{ status: string; service: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      
      if (!response.ok) {
        throw new Error(`Health check failed: HTTP ${response.status}`);
      }
      
      return await response.json() as any;
    } catch (error) {
      console.error('Graphiti health check failed:', error);
      throw error;
    }
  }

  /**
   * Clear graph (development only)
   */
  async clearGraph(): Promise<{ status: string; message: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/graph/clear`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json() as any;
        throw new Error(error.detail || `HTTP ${response.status}`);
      }

      return await response.json() as any;
    } catch (error) {
      console.error('Failed to clear Graphiti graph:', error);
      throw error;
    }
  }
}