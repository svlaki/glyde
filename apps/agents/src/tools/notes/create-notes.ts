import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getSupabaseService } from "../../services/SupabaseService.js";

export const createNotesTool = tool(
  async ({ title, content, aspectId, source, status }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      return "User ID required";
    }

    try {
      const supabaseService = getSupabaseService();

      const notes = await supabaseService.createNotes(userId, {
        title: title || 'Notes',
        content: content || '',
        aspectId,
        status: status || 'active',
        source: source || 'user',
      });

      if (!notes) {
        return "Failed to create note";
      }

      // Sync wiki-links if content contains [[links]]
      const wikiLinkMatches = (content || '').match(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g);
      if (wikiLinkMatches && wikiLinkMatches.length > 0) {
        const linkedTitles = wikiLinkMatches.map((m: string) => {
          const match = m.match(/\[\[([^\]|]+)/);
          return match ? match[1].trim() : '';
        }).filter(Boolean);
        await supabaseService.syncNoteLinks(userId, notes.id, linkedTitles);
      }

      return `Note created: "${notes.title}" (ID: ${notes.id})`;
    } catch (error) {
      console.error('[create-notes] Error:', error);
      return `Error creating note: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "create_notes",
    description: "Create a new note for the user. Aspect is optional -- notes without an aspect connect to things purely through wiki-links in the graph.",
    schema: z.object({
      title: z.string().describe("Title for the new note"),
      content: z.string().optional().describe("Initial content for the note (markdown)"),
      aspectId: z.string().optional().describe("Optional aspect ID. Omit to create an aspect-free note that connects through links only."),
      source: z.enum(['user', 'scribe', 'agent']).optional().describe("Who created the note. Default: 'user'. Use 'scribe' for Scribe agent notes."),
      status: z.enum(['draft', 'active', 'archived', 'scribe']).optional().describe("Note status. Default: 'active'. Use 'scribe' for scribe-created observation notes."),
    }),
  }
);
