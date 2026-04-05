import { Router, Request, Response } from 'express'
import { SharedEventService } from '../services/SharedEventService.js'
import { getSupabaseClient } from '../services/SupabaseService.js'
import { authenticateRequest } from './middleware/auth.js'

const router = Router()

/**
 * Get event members
 * GET /shared-events/:eventId/members
 */
router.get('/:eventId/members', authenticateRequest, async (req: Request, res: Response) => {
  try {
    const userId = req.authUserId
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }
    const { eventId } = req.params

    if (!eventId) {
      return res.status(400).json({ success: false, error: 'Event ID is required' })
    }

    const supabase = getSupabaseClient()
    const service = new SharedEventService(supabase)

    const result = await service.getEventMembers(eventId, userId)
    const statusCode = result.success ? 200 : 400
    return res.status(statusCode).json(result)
  } catch (error) {
    console.error('Error fetching event members:', error)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/**
 * Add member to event (sends invite, status = pending)
 * POST /shared-events/:eventId/members
 * Body: { userId, role }
 */
router.post('/:eventId/members', authenticateRequest, async (req: Request, res: Response) => {
  try {
    const userId = req.authUserId
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }
    const { eventId } = req.params
    const { userId: invitedUserId, role } = req.body

    if (!eventId || !invitedUserId || !role) {
      return res.status(400).json({ success: false, error: 'Missing required fields' })
    }

    if (!['member', 'viewer'].includes(role)) {
      return res.status(400).json({ success: false, error: 'Invalid role. Must be "member" or "viewer"' })
    }

    const supabase = getSupabaseClient()
    const service = new SharedEventService(supabase)

    const result = await service.addMember(eventId, userId, invitedUserId, role)
    const statusCode = result.success ? 201 : 400
    return res.status(statusCode).json(result)
  } catch (error) {
    console.error('Error adding event member:', error)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/**
 * Accept event invite
 * POST /shared-events/:eventId/accept
 */
router.post('/:eventId/accept', authenticateRequest, async (req: Request, res: Response) => {
  try {
    const userId = req.authUserId
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }
    const { eventId } = req.params

    const supabase = getSupabaseClient()
    const service = new SharedEventService(supabase)

    const result = await service.acceptInvite(eventId, userId)
    const statusCode = result.success ? 200 : 400
    return res.status(statusCode).json(result)
  } catch (error) {
    console.error('Error accepting event invite:', error)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/**
 * Decline event invite
 * POST /shared-events/:eventId/decline
 */
router.post('/:eventId/decline', authenticateRequest, async (req: Request, res: Response) => {
  try {
    const userId = req.authUserId
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }
    const { eventId } = req.params

    const supabase = getSupabaseClient()
    const service = new SharedEventService(supabase)

    const result = await service.declineInvite(eventId, userId)
    const statusCode = result.success ? 200 : 400
    return res.status(statusCode).json(result)
  } catch (error) {
    console.error('Error declining event invite:', error)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/**
 * Update member role
 * PUT /shared-events/:eventId/members/:memberId
 * Body: { role }
 */
router.put('/:eventId/members/:memberId', authenticateRequest, async (req: Request, res: Response) => {
  try {
    const userId = req.authUserId
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }
    const { eventId, memberId } = req.params
    const { role } = req.body

    if (!role || !['member', 'viewer'].includes(role)) {
      return res.status(400).json({ success: false, error: 'Invalid role. Must be "member" or "viewer"' })
    }

    const supabase = getSupabaseClient()
    const service = new SharedEventService(supabase)

    const result = await service.updateMemberRole(eventId, userId, memberId, role)
    const statusCode = result.success ? 200 : 400
    return res.status(statusCode).json(result)
  } catch (error) {
    console.error('Error updating event member role:', error)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/**
 * Remove member from event
 * DELETE /shared-events/:eventId/members/:memberId
 */
router.delete('/:eventId/members/:memberId', authenticateRequest, async (req: Request, res: Response) => {
  try {
    const userId = req.authUserId
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }
    const { eventId, memberId } = req.params

    if (!eventId || !memberId) {
      return res.status(400).json({ success: false, error: 'Missing required fields' })
    }

    const supabase = getSupabaseClient()
    const service = new SharedEventService(supabase)

    const result = await service.removeMember(eventId, userId, memberId)
    const statusCode = result.success ? 200 : 400
    return res.status(statusCode).json(result)
  } catch (error) {
    console.error('Error removing event member:', error)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

export default router
