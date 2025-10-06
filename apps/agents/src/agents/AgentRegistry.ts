import { BaseAgent } from './base/BaseAgent.js';
import { AgentType, AgentContext, AgentResponse } from '../types/agents.js';

export class AgentRegistry {
  private static instance: AgentRegistry;
  private agents: Map<AgentType, BaseAgent> = new Map();

  private constructor() {}

  static getInstance(): AgentRegistry {
    if (!AgentRegistry.instance) {
      AgentRegistry.instance = new AgentRegistry();
    }
    return AgentRegistry.instance;
  }

  // Register an agent
  async registerAgent(agent: BaseAgent): Promise<void> {
    const { type } = agent.getInfo();

    if (this.agents.has(type)) {
      console.warn(`Agent ${type} is already registered. Skipping duplicate registration.`);
      return;
    }

    await agent.initialize();
    this.agents.set(type, agent);
  }

  // Get a specific agent
  getAgent(type: AgentType): BaseAgent | undefined {
    return this.agents.get(type);
  }

  // Get all registered agents
  getAllAgents(): BaseAgent[] {
    return Array.from(this.agents.values());
  }

  // Get agent capabilities
  getAgentCapabilities(type: AgentType): string[] {
    const agent = this.agents.get(type);
    return agent ? agent.getCapabilities() : [];
  }

  // Get all agent types
  getRegisteredTypes(): AgentType[] {
    return Array.from(this.agents.keys());
  }

  // Check if an agent is registered
  hasAgent(type: AgentType): boolean {
    return this.agents.has(type);
  }

  // Retrieve an agent and throw a helpful error if it's missing
  requireAgent(type: AgentType): BaseAgent {
    const agent = this.agents.get(type);
    if (!agent) {
      throw new Error(`Agent ${type} is not registered`);
    }
    return agent;
  }

  // Remove an agent
  unregisterAgent(type: AgentType): boolean {
    return this.agents.delete(type);
  }

  // Route a message to the appropriate agent
  async routeMessage(context: AgentContext, message: string, targetAgent?: AgentType): Promise<AgentResponse> {
    // If specific agent is requested, use that
    if (targetAgent) {
      const agent = this.requireAgent(targetAgent);
      return await agent.processMessage(context, message);
    }

    // Otherwise, use the conversation agent as the orchestrator
    const conversationAgent = this.getAgent('conversation');
    if (!conversationAgent) {
      throw new Error('Conversation agent is not registered');
    }

    return await conversationAgent.processMessage(context, message);
  }

  // Allow agents to delegate to other agents
  async delegateToAgent(
    fromAgent: AgentType,
    toAgent: AgentType,
    context: AgentContext,
    message: string
  ): Promise<AgentResponse> {
    if (!this.hasAgent(fromAgent)) {
      throw new Error(`Source agent ${fromAgent} not registered`);
    }

    if (!this.hasAgent(toAgent)) {
      throw new Error(`Target agent ${toAgent} not registered`);
    }

    const agent = this.getAgent(toAgent)!;
    return await agent.delegate(context, message);
  }

  // Get system overview
  getSystemOverview(): {
    totalAgents: number;
    registeredTypes: AgentType[];
    capabilities: Record<AgentType, string[]>;
  } {
    const capabilities: Record<AgentType, string[]> = {} as any;
    
    for (const [type, agent] of this.agents) {
      capabilities[type] = agent.getCapabilities();
    }

    return {
      totalAgents: this.agents.size,
      registeredTypes: this.getRegisteredTypes(),
      capabilities
    };
  }

  // Clear all agents
  clear(): void {
    this.agents.clear();
  }
}