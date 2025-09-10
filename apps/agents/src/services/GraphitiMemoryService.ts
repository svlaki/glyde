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

// New simplified node types for the graph
export interface GraphNode {
  id: string;
  type: 'user' | 'event' | 'goal' | 'person' | 'topic';
  created_at: Date;
  updated_at: Date;
}

export interface UserNode extends GraphNode {
  type: 'user';
  user_id: string;
  name?: string;
}

export interface EventNode extends GraphNode {
  type: 'event';
  title: string;
  description?: string;
  start_time?: Date;
  end_time?: Date;
  location?: string;
  energy_level?: 'low' | 'medium' | 'high';
  completion_status?: 'planned' | 'completed' | 'cancelled';
}

export interface GoalNode extends GraphNode {
  type: 'goal';
  title: string;
  description?: string;
  target_date?: Date;
  status: 'active' | 'completed' | 'paused' | 'cancelled';
  priority?: 'low' | 'medium' | 'high';
}

export interface PersonNode extends GraphNode {
  type: 'person';
  name: string;
  relationship?: string;
  contact_info?: string;
}

export interface TopicNode extends GraphNode {
  type: 'topic';
  name: string;
  category?: string;
  description?: string;
}

// Relationship types for the graph
export interface GraphRelationship {
  id: string;
  from_node_id: string;
  to_node_id: string;
  type: 'PARTICIPATED' | 'INVOLVES' | 'ABOUT' | 'CONTRIBUTES_TO' | 'RELATED';
  created_at: Date;
  strength?: number; // 0-1, for relationship importance
  metadata?: Record<string, any>;
}

export interface CreateEventRequest {
  title: string;
  description?: string;
  start_time?: Date;
  end_time?: Date;
  location?: string;
  participants?: string[]; // Person names
  topics?: string[]; // Topic names
  goal_id?: string; // Goal this event contributes to
  energy_level?: 'low' | 'medium' | 'high';
}

export interface CreateGoalRequest {
  title: string;
  description?: string;
  target_date?: Date;
  priority?: 'low' | 'medium' | 'high';
}

export interface ExtractedEntities {
  people: string[];
  topics: string[];
  locations: string[];
  goals?: string[];
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

  // === New Simplified Graph Node Methods ===
  
  async createEvent(
    userId: string,
    eventRequest: CreateEventRequest
  ): Promise<{ eventId: string; relationships: string[] }> {
    try {
      // First ensure user node exists
      await this.ensureUserNode(userId);
      
      // DO NOT extract entities from description - this was causing the problem
      // Only use explicitly provided entities
      const entities = {
        people: eventRequest.participants || [],
        topics: eventRequest.topics || [],
        locations: eventRequest.location ? [eventRequest.location] : []
      };
      
      // Create the event episode with structured data (no automatic entity extraction)
      const eventEpisode = {
        user_id: userId,
        name: `Event: ${eventRequest.title}`,
        episode_body: JSON.stringify({
          type: 'event',
          title: eventRequest.title,
          description: eventRequest.description,
          start_time: eventRequest.start_time?.toISOString(),
          end_time: eventRequest.end_time?.toISOString(),
          location: eventRequest.location,
          energy_level: eventRequest.energy_level,
          completion_status: 'planned',
          // Only include explicitly provided entities
          participants: entities.people,
          topics: entities.topics,
          locations: entities.locations
        }),
        source: 'event' as const,
        reference_time: eventRequest.start_time || new Date(),
        source_description: `Calendar event: ${eventRequest.title}`
      };
      
      await this.addEpisode(eventEpisode);
      
      // Create relationships by adding follow-up episodes
      const relationships: string[] = [];
      
      // Link to goal if specified
      if (eventRequest.goal_id) {
        await this.linkEventToGoal(userId, eventRequest.title, eventRequest.goal_id);
        relationships.push(`CONTRIBUTES_TO:${eventRequest.goal_id}`);
      }
      
      return {
        eventId: eventRequest.title, // Using title as ID for simplicity
        relationships
      };
      
    } catch (error) {
      console.error('Error creating event:', error);
      throw error;
    }
  }
  
  async createGoal(
    userId: string,
    goalRequest: CreateGoalRequest
  ): Promise<{ goalId: string }> {
    try {
      await this.ensureUserNode(userId);
      
      const goalEpisode = {
        user_id: userId,
        name: `Goal: ${goalRequest.title}`,
        episode_body: JSON.stringify({
          type: 'goal',
          title: goalRequest.title,
          description: goalRequest.description,
          target_date: goalRequest.target_date?.toISOString(),
          status: 'active',
          priority: goalRequest.priority || 'medium'
        }),
        source: 'goal' as const,
        reference_time: new Date(),
        source_description: `Personal goal: ${goalRequest.title}`
      };
      
      await this.addEpisode(goalEpisode);
      
      return { goalId: goalRequest.title };
      
    } catch (error) {
      console.error('Error creating goal:', error);
      throw error;
    }
  }
  
  async createPerson(
    userId: string,
    name: string,
    relationship?: string
  ): Promise<{ personId: string }> {
    try {
      await this.ensureUserNode(userId);
      
      const personEpisode = {
        user_id: userId,
        name: `Person: ${name}`,
        episode_body: JSON.stringify({
          type: 'person',
          name: name,
          relationship: relationship,
          first_mentioned: new Date().toISOString()
        }),
        source: 'text' as const,
        reference_time: new Date(),
        source_description: `Person reference: ${name}`
      };
      
      await this.addEpisode(personEpisode);
      
      return { personId: name };
      
    } catch (error) {
      console.error('Error creating person:', error);
      throw error;
    }
  }
  
  async createTopic(
    userId: string,
    name: string,
    category?: string
  ): Promise<{ topicId: string }> {
    try {
      await this.ensureUserNode(userId);
      
      const topicEpisode = {
        user_id: userId,
        name: `Topic: ${name}`,
        episode_body: JSON.stringify({
          type: 'topic',
          name: name,
          category: category,
          first_mentioned: new Date().toISOString()
        }),
        source: 'text' as const,
        reference_time: new Date(),
        source_description: `Topic reference: ${name}`
      };
      
      await this.addEpisode(topicEpisode);
      
      return { topicId: name };
      
    } catch (error) {
      console.error('Error creating topic:', error);
      throw error;
    }
  }
  
  async linkEventToGoal(
    userId: string,
    eventTitle: string,
    goalTitle: string,
    contribution?: string
  ): Promise<void> {
    try {
      const relationshipEpisode = {
        user_id: userId,
        name: `Link: ${eventTitle} → ${goalTitle}`,
        episode_body: JSON.stringify({
          type: 'relationship',
          relationship_type: 'CONTRIBUTES_TO',
          from_entity: { type: 'event', title: eventTitle },
          to_entity: { type: 'goal', title: goalTitle },
          contribution: contribution,
          created_at: new Date().toISOString()
        }),
        source: 'text' as const,
        reference_time: new Date(),
        source_description: `Event-Goal relationship: ${eventTitle} contributes to ${goalTitle}`
      };
      
      await this.addEpisode(relationshipEpisode);
      
    } catch (error) {
      console.error('Error linking event to goal:', error);
      throw error;
    }
  }
  
  async searchByTimeRange(
    userId: string,
    startDate: Date,
    endDate: Date,
    nodeTypes?: ('event' | 'goal' | 'person' | 'topic')[]
  ): Promise<SearchResult[]> {
    try {
      const query = `Events and activities for ${userId} between ${startDate.toISOString()} and ${endDate.toISOString()}`;
      const searchResponse = await this.search(userId, query, undefined, 20);
      
      // Filter by node types if specified and by time range
      return searchResponse.results.filter((result: any) => {
        try {
          const content = JSON.parse(result.content);
          if (nodeTypes && !nodeTypes.includes(content.type)) {
            return false;
          }
          
          // Check if event falls within time range
          if (content.start_time) {
            const eventTime = new Date(content.start_time);
            return eventTime >= startDate && eventTime <= endDate;
          }
          
          return true;
        } catch {
          return false;
        }
      });
      
    } catch (error) {
      console.error('Error searching by time range:', error);
      throw error;
    }
  }
  
  async searchByPerson(
    userId: string,
    personName: string,
    limit: number = 10
  ): Promise<SearchResult[]> {
    try {
      const query = `Events and interactions involving ${personName}`;
      const searchResponse = await this.search(userId, query, undefined, limit);
      
      // Filter to only include events that mention this person
      return searchResponse.results.filter((result: any) => {
        return result.content.toLowerCase().includes(personName.toLowerCase());
      });
      
    } catch (error) {
      console.error('Error searching by person:', error);
      throw error;
    }
  }
  
  async searchByTopic(
    userId: string,
    topicName: string,
    limit: number = 10
  ): Promise<SearchResult[]> {
    try {
      const query = `Events and content related to ${topicName}`;
      const searchResponse = await this.search(userId, query, undefined, limit);
      
      // Filter to only include events related to this topic
      return searchResponse.results.filter((result: any) => {
        return result.content.toLowerCase().includes(topicName.toLowerCase());
      });
      
    } catch (error) {
      console.error('Error searching by topic:', error);
      throw error;
    }
  }
  
  public async extractEntitiesFromText(
    text: string,
    knownPeople: string[] = [],
    knownTopics: string[] = []
  ): Promise<ExtractedEntities> {
    // VERY conservative entity extraction - only use explicitly provided entities
    // This prevents automatic creation of spurious person/topic nodes
    const entities: ExtractedEntities = {
      people: knownPeople, // Only use explicitly provided people
      topics: knownTopics, // Only use explicitly provided topics
      locations: []
    };
    
    // Only extract locations when there are clear location indicators
    // This is much more conservative than before
    const locationKeywords = ['location:', 'venue:', 'office:', 'address:'];
    for (const keyword of locationKeywords) {
      const index = text.toLowerCase().indexOf(keyword);
      if (index !== -1) {
        const afterKeyword = text.substring(index + keyword.length).trim();
        const location = afterKeyword.split(/[,.;\n]/)[0].trim();
        // Only extract if it looks like a real location (multiple words, reasonable length)
        if (location && location.includes(' ') && location.length > 3 && location.length < 100) {
          entities.locations.push(location);
        }
      }
    }
    
    return entities;
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

  async cleanupInvalidNodes(): Promise<{ success: boolean; details: any }> {
    try {
      const response = await fetch(`${this.baseUrl}/graph/cleanup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`HTTP ${response.status}: ${error}`);
      }

      const result = await response.json();
      console.log('Graph cleanup completed:', result);
      return { success: true, details: result };

    } catch (error) {
      console.error('Failed to cleanup invalid nodes:', error);
      return { success: false, details: { error: error instanceof Error ? error.message : 'Unknown error' } };
    }
  }
}