export { addEventMemberTool } from './add-event-member.js';
export { removeEventMemberTool } from './remove-event-member.js';
export { getEventMembersTool } from './get-event-members.js';
export { updateMemberRoleTool } from './update-member-role.js';

import { addEventMemberTool } from './add-event-member.js';
import { removeEventMemberTool } from './remove-event-member.js';
import { getEventMembersTool } from './get-event-members.js';
import { updateMemberRoleTool } from './update-member-role.js';

export const sharedEventTools = [
  addEventMemberTool,
  removeEventMemberTool,
  getEventMembersTool,
  updateMemberRoleTool,
];
