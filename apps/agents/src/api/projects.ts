import { Request, Response } from 'express';
import projectService from '../services/ProjectService.js';
import { logger } from '../utils/logger.js';
import {
  sendErrorResponse,
  parseBody,
  userIdSchema,
  createProjectSchema,
  updateProjectSchema,
  projectIdSchema,
  tagProjectSchema
} from './utils.js';

export async function getUserProjects(req: Request, res: Response): Promise<void> {
  try {
    const parsed = parseBody(res, userIdSchema, req.body);
    if (!parsed) return;

    const projects = await projectService.getProjects(parsed.user_id);

    res.json({
      success: true,
      projects
    });
  } catch (error) {
    sendErrorResponse(res, 500, 'Failed to fetch user projects', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

export async function createUserProject(req: Request, res: Response): Promise<void> {
  try {
    const parsed = parseBody(res, createProjectSchema, req.body);
    if (!parsed) return;

    logger.info('Creating project for user', { user_id: parsed.user_id });

    const project = await projectService.createProject(parsed.user_id, {
      name: parsed.name,
      aspect_id: parsed.aspect_id,
      description: parsed.description,
      deadline: parsed.deadline,
      details: parsed.details
    });

    if (!project) {
      sendErrorResponse(res, 500, 'Failed to create project');
      return;
    }

    res.json({
      success: true,
      project
    });
  } catch (error) {
    sendErrorResponse(res, 500, 'Failed to create project', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

export async function updateUserProject(req: Request, res: Response): Promise<void> {
  try {
    const parsed = parseBody(res, updateProjectSchema, req.body);
    if (!parsed) return;

    const project = await projectService.updateProject(parsed.user_id, parsed.project_id, {
      name: parsed.name,
      description: parsed.description,
      deadline: parsed.deadline,
      details: parsed.details,
      aspect_id: parsed.aspect_id
    });

    if (!project) {
      sendErrorResponse(res, 404, 'Project not found or failed to update');
      return;
    }

    res.json({
      success: true,
      project
    });
  } catch (error) {
    sendErrorResponse(res, 500, 'Failed to update project', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

export async function deleteUserProject(req: Request, res: Response): Promise<void> {
  try {
    const parsed = parseBody(res, projectIdSchema, req.body);
    if (!parsed) return;

    await projectService.deleteProject(parsed.user_id, parsed.project_id);

    res.json({
      success: true,
      message: 'Project deleted successfully'
    });
  } catch (error) {
    sendErrorResponse(res, 500, 'Failed to delete project', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

export async function archiveUserProject(req: Request, res: Response): Promise<void> {
  try {
    const parsed = parseBody(res, projectIdSchema, req.body);
    if (!parsed) return;

    await projectService.archiveProject(parsed.user_id, parsed.project_id);

    res.json({
      success: true,
      message: 'Project archived successfully'
    });
  } catch (error) {
    sendErrorResponse(res, 500, 'Failed to archive project', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

export async function unarchiveUserProject(req: Request, res: Response): Promise<void> {
  try {
    const parsed = parseBody(res, projectIdSchema, req.body);
    if (!parsed) return;

    await projectService.unarchiveProject(parsed.user_id, parsed.project_id);

    res.json({
      success: true,
      message: 'Project unarchived successfully'
    });
  } catch (error) {
    sendErrorResponse(res, 500, 'Failed to unarchive project', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

export async function getArchivedProjects(req: Request, res: Response): Promise<void> {
  try {
    const parsed = parseBody(res, userIdSchema, req.body);
    if (!parsed) return;

    const projects = await projectService.getArchivedProjects(parsed.user_id);

    res.json({
      success: true,
      projects
    });
  } catch (error) {
    sendErrorResponse(res, 500, 'Failed to fetch archived projects', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

export async function getProjectDetail(req: Request, res: Response): Promise<void> {
  try {
    const parsed = parseBody(res, projectIdSchema, req.body);
    if (!parsed) return;

    const project = await projectService.getProjectById(parsed.user_id, parsed.project_id);
    if (!project) {
      sendErrorResponse(res, 404, 'Project not found');
      return;
    }

    const [tasks, events] = await Promise.all([
      projectService.getProjectTasks(parsed.user_id, parsed.project_id),
      projectService.getProjectEvents(parsed.user_id, parsed.project_id)
    ]);

    res.json({
      success: true,
      project,
      tasks,
      events
    });
  } catch (error) {
    sendErrorResponse(res, 500, 'Failed to fetch project detail', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

export async function tagEntityToProject(req: Request, res: Response): Promise<void> {
  try {
    const parsed = parseBody(res, tagProjectSchema, req.body);
    if (!parsed) return;

    await projectService.tagEntity(
      parsed.user_id,
      parsed.entity_type,
      parsed.entity_id,
      parsed.project_id
    );

    res.json({
      success: true,
      message: `${parsed.entity_type} tagged to project successfully`
    });
  } catch (error) {
    sendErrorResponse(res, 500, 'Failed to tag entity to project', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
