import { AgentType } from './AgentServiceClient';

export interface RouteAnalysis {
  primaryAgent: AgentType;
  confidence: number;
  reasoning: string;
  alternativeAgents: AgentType[];
}

export class AgentRouter {
  private static instance: AgentRouter;
  
  private constructor() {}
  
  static getInstance(): AgentRouter {
    if (!AgentRouter.instance) {
      AgentRouter.instance = new AgentRouter();
    }
    return AgentRouter.instance;
  }

  /**
   * Analyze message and determine best agent to handle it
   */
  analyzeMessage(message: string): RouteAnalysis {
    const lowerMessage = message.toLowerCase();
    
    // Calendar/Scheduling keywords
    const schedulingKeywords = [
      'schedule', 'calendar', 'meeting', 'appointment', 'event',
      'book', 'reserve', 'plan', 'time', 'date', 'tomorrow',
      'today', 'week', 'month', 'lunch', 'dinner', 'call'
    ];
    
    // Goal/Coaching keywords
    const coachingKeywords = [
      'goal', 'habit', 'track', 'progress', 'achieve',
      'target', 'objective', 'milestone', 'improvement',
      'routine', 'wellness', 'health', 'fitness', 'learning'
    ];
    
    // Pattern/Analysis keywords
    const patternKeywords = [
      'analyze', 'pattern', 'trend', 'insight', 'behavior',
      'performance', 'productivity', 'report', 'summary',
      'statistics', 'data', 'metrics', 'review'
    ];
    
    // Proactive/Suggestion keywords
    const proactiveKeywords = [
      'suggest', 'recommend', 'remind', 'notify', 'alert',
      'advice', 'tips', 'optimize', 'improve', 'help me',
      'what should', 'when should', 'how can'
    ];

    // Calculate scores
    const scores = {
      scheduling: this.calculateKeywordScore(lowerMessage, schedulingKeywords),
      coaching: this.calculateKeywordScore(lowerMessage, coachingKeywords),
      pattern_mining: this.calculateKeywordScore(lowerMessage, patternKeywords),
      proactive: this.calculateKeywordScore(lowerMessage, proactiveKeywords),
      conversation: 0.5 // Default baseline
    };

    // Find highest scoring agent
    const sortedAgents = Object.entries(scores)
      .sort(([, a], [, b]) => b - a)
      .map(([agent, score]) => ({ agent: agent as AgentType, score }));

    const primaryAgent = sortedAgents[0];
    const alternatives = sortedAgents.slice(1, 3).map(a => a.agent);

    return {
      primaryAgent: primaryAgent.agent,
      confidence: primaryAgent.score,
      reasoning: this.generateReasoning(primaryAgent.agent, lowerMessage),
      alternativeAgents: alternatives
    };
  }

  /**
   * Determine if message needs multi-agent workflow
   */
  needsMultiAgentWorkflow(message: string): boolean {
    const lowerMessage = message.toLowerCase();
    
    // Complex requests that might benefit from multiple agents
    const multiAgentIndicators = [
      'analyze my schedule and suggest improvements',
      'help me plan my goals',
      'optimize my calendar',
      'review my patterns and set goals',
      'analyze and recommend'
    ];

    return multiAgentIndicators.some(indicator => 
      lowerMessage.includes(indicator.toLowerCase())
    );
  }

  /**
   * Get suggested agent workflow for complex requests
   */
  getSuggestedWorkflow(message: string): AgentType[] {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('analyze') && lowerMessage.includes('goal')) {
      return ['pattern_mining', 'coaching'];
    }
    
    if (lowerMessage.includes('optimize') && lowerMessage.includes('schedule')) {
      return ['pattern_mining', 'scheduling'];
    }
    
    if (lowerMessage.includes('plan') && lowerMessage.includes('improve')) {
      return ['pattern_mining', 'coaching', 'proactive'];
    }
    
    // Default to conversation agent for orchestration
    return ['conversation'];
  }

  /**
   * Calculate keyword match score
   */
  private calculateKeywordScore(message: string, keywords: string[]): number {
    let score = 0;
    const words = message.split(/\s+/);
    
    for (const keyword of keywords) {
      if (message.includes(keyword)) {
        // Exact match gets higher score
        score += 1.0;
      } else {
        // Partial match gets lower score
        for (const word of words) {
          if (word.includes(keyword) || keyword.includes(word)) {
            score += 0.3;
            break;
          }
        }
      }
    }
    
    // Normalize by message length to prevent bias toward longer messages
    return Math.min(score / Math.max(words.length * 0.1, 1), 1.0);
  }

  /**
   * Generate human-readable reasoning for agent selection
   */
  private generateReasoning(agent: AgentType, message: string): string {
    switch (agent) {
      case 'scheduling':
        return `Message contains calendar/scheduling keywords and time-related requests.`;
      case 'coaching':
        return `Message focuses on goals, habits, or personal improvement.`;
      case 'pattern_mining':
        return `Message requests analysis, insights, or pattern detection.`;
      case 'proactive':
        return `Message asks for suggestions, recommendations, or proactive assistance.`;
      case 'conversation':
        return `General conversation that may require orchestration of multiple capabilities.`;
      default:
        return `Default routing to conversation agent.`;
    }
  }
}

// Export singleton instance
export const agentRouter = AgentRouter.getInstance();