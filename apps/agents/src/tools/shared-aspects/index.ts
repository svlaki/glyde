export { shareAspectTool } from './share-aspect.js';
export { getAspectMembersTool } from './get-aspect-members.js';
export { removeAspectMemberTool } from './remove-aspect-member.js';
export { updateAspectMemberRoleTool } from './update-aspect-member-role.js';

import { shareAspectTool } from './share-aspect.js';
import { getAspectMembersTool } from './get-aspect-members.js';
import { removeAspectMemberTool } from './remove-aspect-member.js';
import { updateAspectMemberRoleTool } from './update-aspect-member-role.js';

export const sharedAspectTools = [
  shareAspectTool,
  getAspectMembersTool,
  removeAspectMemberTool,
  updateAspectMemberRoleTool,
];
