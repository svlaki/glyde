import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getSupabaseService } from "../../services/SupabaseService.js";

export const updateNotesTool = tool(
  async ({ notesId, title, content, aspectId, horizonStart, horizonEnd, status }, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      return "User ID required";
    }

    try {
      const supabaseService = getSupabaseService();

      if (!notesId) {
        return "notesId is required. Use get_notes first to find the note ID you want to update.";
      }

      const updates: any = {};
      if (title !== undefined && title !== null) updates.title = title;
      if (content !== undefined && content !== null) updates.content = content;
      if (aspectId !== undefined && aspectId !== null) updates.aspectId = aspectId;
      if (horizonStart !== undefined && horizonStart !== null) updates.horizonStart = horizonStart;
      if (horizonEnd !== undefined && horizonEnd !== null) updates.horizonEnd = horizonEnd;
      if (status !== undefined && status !== null) updates.status = status;

      const notes = await supabaseService.updateNotes(userId, notesId, updates);

      if (!notes) {
        return "Failed to update notes";
      }

      return `Notes updated: "${notes.title}"`;
    } catch (error) {
      console.error('[update-notes] Error:', error);
      return `Error updating notes: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "update_notes",
    description: "Update a specific note by ID. Requires notesId - use get_notes first to find the right note. When adding new context, read the notes first, then update with the new content naturally integrated.",
    schema: z.object({
      notesId: z.string().describe("The ID of the note to update. Required - use get_notes to find it."),
      title: z.string().optional().nullable().describe("New note title"),
      content: z.string().optional().nullable().describe("New note content (markdown). Integrate new context naturally into the existing text."),
      aspectId: z.string().optional().nullable().describe("Change the note's aspect by providing a new aspect ID"),
      horizonStart: z.string().optional().nullable().describe("Note start date (ISO format)"),
      horizonEnd: z.string().optional().nullable().describe("Note end date (ISO format)"),
      status: z.enum(["draft", "active", "archived"]).optional().nullable().describe("Note status"),
    }),
  }
);
