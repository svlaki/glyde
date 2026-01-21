import { createRuleTool } from "./create-rule.js";
import { listRulesTool } from "./list-rules.js";
import { deleteRuleTool } from "./delete-rule.js";
import { toggleRuleTool } from "./toggle-rule.js";

export { createRuleTool, listRulesTool, deleteRuleTool, toggleRuleTool };

export const rulesTools = [createRuleTool, listRulesTool, deleteRuleTool, toggleRuleTool];
