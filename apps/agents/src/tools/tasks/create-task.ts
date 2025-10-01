import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const createTaskTool = tool(
  async ({ title, description, dueDate, priority }) => {
    const task = {
      title,
      description,
      due_date: dueDate,
      priority,
    };
    return `Task creation parameters: ${JSON.stringify(task)}`;
  },
  {
    name: "create_task",
    description: "Create a new task",
    schema: z.object({
      title: z.string().describe("Task title"),
      description: z.string().nullable().describe("Task description"),
      dueDate: z.string().nullable().describe("Due date in ISO format"),
      priority: z.enum(["low", "medium", "high"]).nullable().describe("Task priority"),
    }),
  }
);