export { createProjectTool } from './create-project.js';
export { listProjectsTool } from './list-projects.js';
export { updateProjectTool } from './update-project.js';
export { archiveProjectTool } from './archive-project.js';
export { tagToProjectTool } from './tag-to-project.js';

import { createProjectTool } from './create-project.js';
import { listProjectsTool } from './list-projects.js';
import { updateProjectTool } from './update-project.js';
import { archiveProjectTool } from './archive-project.js';
import { tagToProjectTool } from './tag-to-project.js';

export const projectTools = [
  createProjectTool,
  listProjectsTool,
  updateProjectTool,
  archiveProjectTool,
  tagToProjectTool,
];
