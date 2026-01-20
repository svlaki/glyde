import { createRuleTool } from "./create-rule.js";
import { listRulesTool } from "./list-rules.js";
import { deleteRuleTool } from "./delete-rule.js";

export { createRuleTool, listRulesTool, deleteRuleTool };

export const rulesTools = [createRuleTool, listRulesTool, deleteRuleTool];
