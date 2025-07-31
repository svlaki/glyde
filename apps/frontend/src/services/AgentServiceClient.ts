import { BaseMessage } from '@langchain/core/messages';

export interface AgentContext {
  userId: string;
  sessionId: string;
  userSchema: string;
  conversationHistory: BaseMessage[];
  userProfile?: UserProfile;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  preferences?: Record<string, any>;
  goals?: Goal[];
  insights?: BehaviorInsight[];
}

export interface Goal {
  id: string;
  title: string;
  description: string;
  category: 'productivity' | 'health' | 'learning' | 'personal' | 'career';
  priority: 'low' | 'medium' | 'high';
  status: 'active' | 'completed' | 'paused' | 'cancelled';
  targetDate?: string;
  progress: number;
  metrics?: GoalMetric[];
  createdAt: string;
  updatedAt: string;
}

export interface GoalMetric {
  id: string;
  goalId: string;
  name: string;
  value: number;
  unit: string;
  timestamp: string;
}

export interface BehaviorInsight {
  id: string;
  type: 'pattern' | 'trend' | 'anomaly' | 'suggestion';
  category: 'scheduling' | 'productivity' | 'communication' | 'wellness';
  title: string;
  description: string;
  confidence: number;
  impact: 'low' | 'medium' | 'high';
  actionable: boolean;
  suggestions?: string[];
  relatedEvents?: string[];
  createdAt: string;
}

export interface AgentResponse {
  content: string;
  type: 'text' | 'action' | 'suggestion' | 'analysis';
  data?: any;
  needsUserInput?: boolean;
  suggestedActions?: AgentAction[];
  agentType?: AgentType;
  processingTime?: number;
}

export interface AgentAction {
  id: string;
  type: 'create_event' | 'update_event' | 'delete_event' | 'set_goal' | 'update_goal';
  description: string;
  parameters: Record<string, any>;
  confidence: number;
}

export type AgentType = 'conversation' | 'scheduling' | 'pattern_mining' | 'coaching' | 'proactive';

export class AgentServiceClient {
  private baseUrl: string;
  private timeout: number;

  constructor(baseUrl: string = process.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000', timeout: number = 10000) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
  }

  /**
   * Route a message to the appropriate agent via the AgentRegistry
   */
  async routeMessage(
    userId: string,
    message: string,
    sessionId: string = 'default',
    targetAgent?: AgentType
  ): Promise<AgentResponse> {
    try {
      const context = await this.buildAgentContext(userId, message, sessionId);
      
      const response = await fetch(`${this.baseUrl}/api/agent/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          context,
          message,
          targetAgent
        }),
        signal: AbortSignal.timeout(this.timeout)
      });

      if (!response.ok) {
        throw new Error(`Agent service error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error routing message to agent:', error);
      throw error;
    }
  }

  /**
   * Get system prompt from conversation agent
   */
  async getSystemPrompt(userId: string): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/api/agent/system-prompt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
        signal: AbortSignal.timeout(this.timeout)
      });

      if (!response.ok) {
        throw new Error(`Failed to get system prompt: ${response.status}`);
      }

      const result = await response.json();
      return result.prompt;
    } catch (error) {
      console.error('Error getting system prompt:', error);
      // Fallback to basic prompt
      return 'You are a helpful personal assistant that helps users manage their calendar and tasks.';
    }
  }

  /**
   * Get capabilities of all registered agents
   */
  async getAgentCapabilities(): Promise<Record<AgentType, string[]>> {
    try {
      const response = await fetch(`${this.baseUrl}/api/agent/capabilities`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(this.timeout)
      });

      if (!response.ok) {
        throw new Error(`Failed to get agent capabilities: ${response.status}`);
      }

      const result = await response.json();
      return result.capabilities;
    } catch (error) {
      console.error('Error getting agent capabilities:', error);
      return {};
    }
  }

  /**
   * Get agent system overview
   */
  async getSystemOverview(): Promise<{
    totalAgents: number;
    registeredTypes: AgentType[];
    capabilities: Record<AgentType, string[]>;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/agent/overview`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(this.timeout)
      });

      if (!response.ok) {
        throw new Error(`Failed to get system overview: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error getting system overview:', error);
      return {
        totalAgents: 0,
        registeredTypes: [],
        capabilities: {}
      };
    }
  }

  /**
   * Health check for agent service
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });

      return response.ok;
    } catch (error) {
      console.error('Agent service health check failed:', error);
      return false;
    }
  }

  /**
   * Build agent context from user info and message
   */
  private async buildAgentContext(
    userId: string,
    message: string,
    sessionId: string
  ): Promise<AgentContext> {
    // Get user profile (if available)
    let userProfile: UserProfile | undefined;
    try {
      const response = await fetch(`${this.baseUrl}/api/user/profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
        signal: AbortSignal.timeout(3000)
      });

      if (response.ok) {
        const result = await response.json();
        userProfile = result.profile;
      }
    } catch (error) {
      console.error('Failed to get user profile:', error);
    }

    // Get recent conversation history
    let conversationHistory: BaseMessage[] = [];
    try {
      const response = await fetch(`${this.baseUrl}/api/chat/history`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: userId, session_id: sessionId }),
        signal: AbortSignal.timeout(3000)
      });

      if (response.ok) {
        const result = await response.json();
        // Convert to BaseMessage format
        conversationHistory = result.messages?.map((msg: any) => ({
          content: msg.content,
          _getType: () => msg.sender === 'user' ? 'human' : 'ai'
        })) || [];
      }
    } catch (error) {
      console.error('Failed to get conversation history:', error);
    }

    return {
      userId,
      sessionId,
      userSchema: `u_${userId.replace(/-/g, '')}`,
      conversationHistory,
      userProfile
    };
  }
}

// Export singleton instance
export const agentServiceClient = new AgentServiceClient();