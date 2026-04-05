import { Router, Request, Response } from 'express'
import { SharedAspectService } from '../services/SharedAspectService.js'
import { getSupabaseClient } from '../services/SupabaseService.js'
import { authenticateRequest } from './middleware/auth.js'

const router = Router()

/**
 * Create shared aspect
 * POST /shared-aspects
 * Body: { name, description?, color?, icon? }
 */
router.post('/', authenticateRequest, async (req: Request, res: Response) => {
  try {
    const userId = req.authUserId
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }
    const { name, description, color, icon } = req.body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Aspect name is required' })
    }

    const supabase = getSupabaseClient()
    const service = new SharedAspectService(supabase)

    const result = await service.createSharedAspect(userId, {
      name: name.trim(),
      description,
      color,
      icon
    })

    const statusCode = result.success ? 201 : 400
    return res.status(statusCode).json(result)
  } catch (error) {
    console.error('Error creating shared aspect:', error)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/**
 * Get user's shared aspects
 * GET /shared-aspects
 */
router.get('/', authenticateRequest, async (req: Request, res: Response) => {
  try {
    const userId = req.authUserId
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }
    const supabase = getSupabaseClient()
    const service = new SharedAspectService(supabase)

    const result = await service.getUserSharedAspects(userId)
    const statusCode = result.success ? 200 : 500
    return res.status(statusCode).json(result)
  } catch (error) {
    console.error('Error fetching shared aspects:', error)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/**
 * Get aspect members
 * GET /shared-aspects/:aspectId/members
 */
router.get('/:aspectId/members', authenticateRequest, async (req: Request, res: Response) => {
  try {
    const userId = req.authUserId
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }
    const { aspectId } = req.params

    if (!aspectId) {
      return res.status(400).json({ success: false, error: 'Aspect ID is required' })
    }

    const supabase = getSupabaseClient()
    const service = new SharedAspectService(supabase)

    const result = await service.getAspectMembers(aspectId, userId)
    const statusCode = result.success ? 200 : 400
    return res.status(statusCode).json(result)
  } catch (error) {
    console.error('Error fetching aspect members:', error)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/**
 * Add member to aspect
 * POST /shared-aspects/:aspectId/members
 * Body: { userId, role }
 */
router.post('/:aspectId/members', authenticateRequest, async (req: Request, res: Response) => {
  try {
    const userId = req.authUserId
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }
    const { aspectId } = req.params
    const { userId: invitedUserId, role } = req.body

    if (!aspectId || !invitedUserId || !role) {
      return res.status(400).json({ success: false, error: 'Missing required fields' })
    }

    if (!['member', 'viewer'].includes(role)) {
      return res.status(400).json({ success: false, error: 'Invalid role' })
    }

    const supabase = getSupabaseClient()
    const service = new SharedAspectService(supabase)

    const result = await service.addMember(aspectId, userId, invitedUserId, role)
    const statusCode = result.success ? 201 : 400
    return res.status(statusCode).json(result)
  } catch (error) {
    console.error('Error adding member:', error)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/**
 * Update member role
 * PUT /shared-aspects/:aspectId/members/:memberId
 * Body: { role }
 */
router.put('/:aspectId/members/:memberId', authenticateRequest, async (req: Request, res: Response) => {
  try {
    const userId = req.authUserId
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }
    const { aspectId, memberId } = req.params
    const { role } = req.body

    if (!role || !['member', 'viewer'].includes(role)) {
      return res.status(400).json({ success: false, error: 'Invalid role' })
    }

    const supabase = getSupabaseClient()
    const service = new SharedAspectService(supabase)

    const result = await service.updateMemberRole(aspectId, userId, memberId, role)
    const statusCode = result.success ? 200 : 400
    return res.status(statusCode).json(result)
  } catch (error) {
    console.error('Error updating member role:', error)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/**
 * Remove member from aspect
 * DELETE /shared-aspects/:aspectId/members/:memberId
 */
router.delete('/:aspectId/members/:memberId', authenticateRequest, async (req: Request, res: Response) => {
  try {
    const userId = req.authUserId
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }
    const { aspectId, memberId } = req.params

    if (!aspectId || !memberId) {
      return res.status(400).json({ success: false, error: 'Missing required fields' })
    }

    const supabase = getSupabaseClient()
    const service = new SharedAspectService(supabase)

    const result = await service.removeMember(aspectId, userId, memberId)
    const statusCode = result.success ? 200 : 400
    return res.status(statusCode).json(result)
  } catch (error) {
    console.error('Error removing member:', error)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/**
 * Accept aspect invite
 * POST /shared-aspects/:aspectId/accept
 */
router.post('/:aspectId/accept', authenticateRequest, async (req: Request, res: Response) => {
  try {
    const userId = req.authUserId
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }
    const { aspectId } = req.params

    const supabase = getSupabaseClient()
    const service = new SharedAspectService(supabase)

    const result = await service.acceptInvite(aspectId, userId)
    const statusCode = result.success ? 200 : 400
    return res.status(statusCode).json(result)
  } catch (error) {
    console.error('Error accepting aspect invite:', error)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/**
 * Decline aspect invite
 * POST /shared-aspects/:aspectId/decline
 */
router.post('/:aspectId/decline', authenticateRequest, async (req: Request, res: Response) => {
  try {
    const userId = req.authUserId
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }
    const { aspectId } = req.params

    const supabase = getSupabaseClient()
    const service = new SharedAspectService(supabase)

    const result = await service.declineInvite(aspectId, userId)
    const statusCode = result.success ? 200 : 400
    return res.status(statusCode).json(result)
  } catch (error) {
    console.error('Error declining aspect invite:', error)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/**
 * Update shared aspect metadata
 * PUT /shared-aspects/:aspectId
 * Body: { name?, description?, color?, icon? }
 */
router.put('/:aspectId', authenticateRequest, async (req: Request, res: Response) => {
  try {
    const userId = req.authUserId
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }
    const { aspectId } = req.params
    const { name, description, color, icon } = req.body

    if (!aspectId) {
      return res.status(400).json({ success: false, error: 'Aspect ID is required' })
    }

    const supabase = getSupabaseClient()
    const service = new SharedAspectService(supabase)

    const result = await service.updateSharedAspect(aspectId, userId, {
      name,
      description,
      color,
      icon
    })

    const statusCode = result.success ? 200 : 400
    return res.status(statusCode).json(result)
  } catch (error) {
    console.error('Error updating shared aspect:', error)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/**
 * Delete shared aspect
 * DELETE /shared-aspects/:aspectId
 */
router.delete('/:aspectId', authenticateRequest, async (req: Request, res: Response) => {
  try {
    const userId = req.authUserId
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }
    const { aspectId } = req.params

    if (!aspectId) {
      return res.status(400).json({ success: false, error: 'Aspect ID is required' })
    }

    const supabase = getSupabaseClient()
    const service = new SharedAspectService(supabase)

    const result = await service.deleteSharedAspect(aspectId, userId)
    const statusCode = result.success ? 200 : 400
    return res.status(statusCode).json(result)
  } catch (error) {
    console.error('Error deleting shared aspect:', error)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

export default router
