import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { AgentRegistry } from '../../agents/AgentRegistry.js';

export const scribeResearchTool = tool(
  async ({ topic }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      return 'User ID required';
    }

    try {
      const registry = AgentRegistry.getInstance();
      if (!registry.hasAgent('scribe')) {
        return 'Scribe agent is not available. Please try again later.';
      }

      const scribe = registry.requireAgent('scribe');
      const response = await scribe.processMessage(
        {
          userId,
          sessionId: `scribe-research-${userId}-${Date.now()}`,
          conversationHistory: [],
          isInternal: true,
        },
        `RESEARCH: ${topic}`
      );

      return `Research note created. ${response.content}`;
    } catch (error: any) {
      console.error('[scribe-research] Error:', error.message);
      return `Error during research: ${error.message}`;
    }
  },
  {
    name: 'scribe_research',
    description: 'Delegate research to the Scribe agent. The Scribe will search the web for information about the given topic and create a reference note in the knowledge graph. Use this when the user asks to research something, look up information about their school, work, or interests, or when you want to save reference material.',
    schema: z.object({
      topic: z.string().describe('The topic to research. Be specific -- e.g., "Stanford CS229 Fall 2026 course details" or "YC application deadlines 2026"'),
    }),
  }
);
