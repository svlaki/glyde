import { Request, Response } from 'express';
import aspectService from '../services/AspectService.js';
import { getSupabaseClient } from '../services/SupabaseService.js';
import { logger } from '../utils/logger.js';
import {
  sendErrorResponse,
  parseBody,
  userIdSchema,
  createAspectSchema,
  updateAspectSchema,
  aspectIdSchema,
  aspectColorSchema
} from './utils.js';

export async function getUserAspects(req: Request, res: Response): Promise<void> {
  try {
    const parsed = parseBody(res, userIdSchema, req.body);
    if (!parsed) return;

    logger.info('Fetching aspects for user', { user_id: parsed.user_id });

    const aspects = await aspectService.getAspects(parsed.user_id);

    res.json({
      success: true,
      aspects: aspects
    });
  } catch (error) {
    sendErrorResponse(res, 500, 'Failed to fetch user aspects', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

export async function createUserAspect(req: Request, res: Response): Promise<void> {
  try {
    const parsed = parseBody(res, createAspectSchema, req.body);
    if (!parsed) return;

    logger.info('Creating aspect for user', { user_id: parsed.user_id });

    const aspect = await aspectService.createAspect(parsed.user_id, {
      name: parsed.name.trim(),
      color: parsed.color.trim(),
      description: parsed.description?.trim(),
      context: parsed.context || {}
    });

    if (!aspect) {
      sendErrorResponse(res, 500, 'Failed to create aspect - service returned null');
      return;
    }

    res.json({
      success: true,
      aspect: aspect
    });
  } catch (error) {
    sendErrorResponse(res, 500, 'Failed to create user aspect', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

export async function updateUserAspect(req: Request, res: Response): Promise<void> {
  try {
    const parsed = parseBody(res, updateAspectSchema, req.body);
    if (!parsed) return;

    logger.info('Updating aspect', { aspect_id: parsed.aspect_id, user_id: parsed.user_id });

    const aspect = await aspectService.updateAspect(parsed.user_id, parsed.aspect_id, {
      name: parsed.name?.trim(),
      color: parsed.color?.trim(),
      description: parsed.description?.trim(),
      context: parsed.context,
      visibility: parsed.visibility
    });

    if (!aspect) {
      sendErrorResponse(res, 404, 'Aspect not found or failed to update');
      return;
    }

    // When enabling sharing, ensure owner is in aspect_members
    if (parsed.visibility === 'shared') {
      const supabase = getSupabaseClient();
      await supabase
        .from('aspect_members')
        .upsert(
          { aspect_id: parsed.aspect_id, user_id: parsed.user_id, role: 'owner' },
          { onConflict: 'aspect_id,user_id' }
        );
    }

    // When disabling sharing, remove all members
    if (parsed.visibility === 'private') {
      const supabase = getSupabaseClient();
      await supabase
        .from('aspect_members')
        .delete()
        .eq('aspect_id', parsed.aspect_id);
    }

    res.json({
      success: true,
      aspect: aspect
    });
  } catch (error) {
    sendErrorResponse(res, 500, 'Failed to update user aspect', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

export async function deleteUserAspect(req: Request, res: Response): Promise<void> {
  try {
    const parsed = parseBody(res, aspectIdSchema, req.body);
    if (!parsed) return;

    logger.info('Deleting aspect', { aspect_id: parsed.aspect_id, user_id: parsed.user_id });

    await aspectService.deleteAspect(parsed.user_id, parsed.aspect_id);

    res.json({
      success: true,
      message: 'Aspect deleted successfully'
    });
  } catch (error) {
    sendErrorResponse(res, 500, 'Failed to delete user aspect', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

export async function archiveUserAspect(req: Request, res: Response): Promise<void> {
  try {
    const parsed = parseBody(res, aspectIdSchema, req.body);
    if (!parsed) return;

    await aspectService.archiveAspect(parsed.user_id, parsed.aspect_id);

    res.json({
      success: true,
      message: 'Aspect archived successfully'
    });
  } catch (error) {
    sendErrorResponse(res, 500, 'Failed to archive user aspect', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

export async function unarchiveUserAspect(req: Request, res: Response): Promise<void> {
  try {
    const parsed = parseBody(res, aspectIdSchema, req.body);
    if (!parsed) return;

    await aspectService.unarchiveAspect(parsed.user_id, parsed.aspect_id);

    res.json({
      success: true,
      message: 'Aspect unarchived successfully'
    });
  } catch (error) {
    sendErrorResponse(res, 500, 'Failed to unarchive user aspect', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

export async function getArchivedAspects(req: Request, res: Response): Promise<void> {
  try {
    const parsed = parseBody(res, userIdSchema, req.body);
    if (!parsed) return;

    const aspects = await aspectService.getArchivedAspects(parsed.user_id);

    res.json({
      success: true,
      aspects: aspects
    });
  } catch (error) {
    sendErrorResponse(res, 500, 'Failed to fetch archived aspects', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

export async function getAspectColor(req: Request, res: Response): Promise<void> {
  try {
    const parsed = parseBody(res, aspectColorSchema, req.body);
    if (!parsed) return;

    const color = await aspectService.getAspectColor(parsed.user_id, parsed.aspect_name);

    res.json({
      success: true,
      color: color
    });
  } catch (error) {
    sendErrorResponse(res, 500, 'Failed to fetch aspect color', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
