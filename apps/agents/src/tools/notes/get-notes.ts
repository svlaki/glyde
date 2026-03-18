import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getSupabaseService } from "../../services/SupabaseService.js";

export const getNotesTool = tool(
  async (_input, config) => {
    const userId = config?.configurable?.userId;
    if (!userId) {
      return "User ID required";
    }

    try {
      const supabaseService = getSupabaseService();
      const notes = await supabaseService.getAllNotes(userId);

      if (!notes || notes.length === 0) {
        return "No notes found. The user hasn't created any notes yet.";
      }

      const formatted = notes.map((note: any) => ({
        id: note.id,
        title: note.title,
        content: note.content || "(No content yet)",
        aspect_id: note.aspect_id,
        aspect_name: note.aspect_name,
        aspect_color: note.aspect_color,
        status: note.status,
        created_at: note.created_at,
        updated_at: note.updated_at,
      }));

      return JSON.stringify(formatted);
    } catch (error) {
      console.error('[get-notes] Error:', error);
      return `Error fetching notes: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
  {
    name: "get_notes",
    description: "Get all of the user's notes. Returns an array of notes, each with its aspect name and color. Use this to see all notes before updating a specific one.",
    schema: z.object({}),
  }
);
