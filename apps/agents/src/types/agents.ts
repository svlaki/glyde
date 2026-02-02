import { BaseMessage } from '@langchain/core/messages';

// Multimodal content types for vision support
export interface ImageContent {
  type: 'image_url';
  image_url: { url: string; detail?: 'low' | 'high' | 'auto' };
}

export interface TextContent {
  type: 'text';
  text: string;
}

export type MessageContent = string | (TextContent | ImageContent)[];

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: MessageContent;
}

export interface AgentContext {
  userId: string;
  sessionId: string;
  timezone?: string;
  conversationHistory: ConversationMessage[];
  userProfile?: UserProfile;
  isInternal?: boolean; // Flag for internal messages that shouldn't be persisted
}

export interface UserProfile {
  id: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  timezone?: string;
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
  progress: number; // 0-100
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
  confidence: number; // 0-1
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
}

export interface AgentAction {
  id: string;
  type: 'create_event' | 'update_event' | 'delete_event' | 'set_goal' | 'update_goal';
  description: string;
  parameters: Record<string, any>;
  confidence: number;
}

export interface MemoryContext {
  shortTerm: ConversationMemory;
  longTerm: UserProfileMemory;
  entity: EntityMemory;
  vector: VectorMemory;
  graphiti?: GraphitiMemory; // Optional for backward compatibility
}

export interface GraphitiMemory {
  userNodeUuid: string;
  contextType: 'conversation' | 'task_planning' | 'goal_coaching';
  totalFacts: number;
  relevantFacts: Array<{
    fact: string;
    relevance: string;
    timestamp?: string;
  }>;
}

export interface ConversationMemory {
  sessionId: string;
  messages: BaseMessage[];
  context: string;
  summary?: string;
  lastUpdated: string;
}

export interface UserProfileMemory {
  userId: string;
  profile: UserProfile;
  preferences: Record<string, any>;
  goals: Goal[];
  insights: BehaviorInsight[];
  lastUpdated: string;
}

export interface EntityMemory {
  entities: Record<string, EntityInfo>;
  relationships: Record<string, string[]>;
}

export interface EntityInfo {
  id: string;
  type: 'person' | 'place' | 'event' | 'task' | 'goal';
  name: string;
  attributes: Record<string, any>;
  lastMentioned: string;
  importance: number; // 0-1
}

export interface VectorMemory {
  recentEvents: Array<{ content: string; embedding?: number[]; timestamp: string }>;
  recentChats: Array<{ content: string; embedding?: number[]; timestamp: string }>;
  semanticContext: string;
}

export type AgentType = 'conversation' | 'interaction' | 'maintenance' | 'scheduling' | 'pattern_mining' | 'coaching' | 'proactive';
