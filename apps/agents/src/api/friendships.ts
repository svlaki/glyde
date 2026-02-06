import { Router, Request, Response } from 'express'
import { FriendshipService } from '../services/FriendshipService.js'
import { getSupabaseClient } from '../services/SupabaseService.js'
import { authenticateRequest } from './middleware/auth.js'

const router = Router()

/**
 * Send friend request
 * POST /friends/request
 * Body: { addresseeEmail: string }
 */
router.post('/request', authenticateRequest, async (req: Request, res: Response) => {
  try {
    const userId = req.authUserId
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }
    const { addresseeEmail } = req.body

    if (!addresseeEmail || typeof addresseeEmail !== 'string') {
      return res.status(400).json({ success: false, error: 'Email is required' })
    }

    const supabase = getSupabaseClient()
    const friendshipService = new FriendshipService(supabase)

    const result = await friendshipService.sendFriendRequest(userId, addresseeEmail)
    const statusCode = result.success ? 201 : 400
    return res.status(statusCode).json(result)
  } catch (error) {
    console.error('Error sending friend request:', error)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/**
 * Accept friend request
 * POST /friends/:friendshipId/accept
 */
router.post('/:friendshipId/accept', authenticateRequest, async (req: Request, res: Response) => {
  try {
    const userId = req.authUserId
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }
    const { friendshipId } = req.params

    if (!friendshipId) {
      return res.status(400).json({ success: false, error: 'Friendship ID is required' })
    }

    const supabase = getSupabaseClient()
    const friendshipService = new FriendshipService(supabase)

    const result = await friendshipService.acceptFriendRequest(friendshipId, userId)
    const statusCode = result.success ? 200 : 400
    return res.status(statusCode).json(result)
  } catch (error) {
    console.error('Error accepting friend request:', error)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/**
 * Decline or block friend request
 * POST /friends/:friendshipId/decline
 * Query params: block=true/false (default: false)
 */
router.post('/:friendshipId/decline', authenticateRequest, async (req: Request, res: Response) => {
  try {
    const userId = req.authUserId
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }
    const { friendshipId } = req.params
    const { block } = req.query

    if (!friendshipId) {
      return res.status(400).json({ success: false, error: 'Friendship ID is required' })
    }

    const blockUser = block === 'true' || block === '1'
    const supabase = getSupabaseClient()
    const friendshipService = new FriendshipService(supabase)

    const result = await friendshipService.declineFriendRequest(friendshipId, userId, blockUser)
    const statusCode = result.success ? 200 : 400
    return res.status(statusCode).json(result)
  } catch (error) {
    console.error('Error declining friend request:', error)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/**
 * Get all accepted friends for authenticated user
 * GET /friends
 */
router.get('/', authenticateRequest, async (req: Request, res: Response) => {
  try {
    const userId = req.authUserId
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }
    const supabase = getSupabaseClient()
    const friendshipService = new FriendshipService(supabase)

    const result = await friendshipService.getFriends(userId)
    const statusCode = result.success ? 200 : 500
    return res.status(statusCode).json(result)
  } catch (error) {
    console.error('Error getting friends:', error)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/**
 * Get pending friend requests (incoming) for authenticated user
 * GET /friends/requests
 */
router.get('/requests', authenticateRequest, async (req: Request, res: Response) => {
  try {
    const userId = req.authUserId
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }
    const supabase = getSupabaseClient()
    const friendshipService = new FriendshipService(supabase)

    const result = await friendshipService.getPendingRequests(userId)
    const statusCode = result.success ? 200 : 500
    return res.status(statusCode).json(result)
  } catch (error) {
    console.error('Error getting pending requests:', error)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/**
 * Remove friend
 * DELETE /friends/:friendshipId
 */
router.delete('/:friendshipId', authenticateRequest, async (req: Request, res: Response) => {
  try {
    const userId = req.authUserId
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }
    const { friendshipId } = req.params

    if (!friendshipId) {
      return res.status(400).json({ success: false, error: 'Friendship ID is required' })
    }

    const supabase = getSupabaseClient()
    const friendshipService = new FriendshipService(supabase)

    const result = await friendshipService.removeFriend(friendshipId, userId)
    const statusCode = result.success ? 200 : 400
    return res.status(statusCode).json(result)
  } catch (error) {
    console.error('Error removing friend:', error)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/**
 * Update friend notes
 * PUT /friends/:friendshipId/notes
 * Body: { notes: string }
 */
router.put('/:friendshipId/notes', authenticateRequest, async (req: Request, res: Response) => {
  try {
    const userId = req.authUserId
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }
    const { friendshipId } = req.params
    const { notes } = req.body

    if (!friendshipId) {
      return res.status(400).json({ success: false, error: 'Friendship ID is required' })
    }

    if (typeof notes !== 'string') {
      return res.status(400).json({ success: false, error: 'Notes must be a string' })
    }

    const supabase = getSupabaseClient()
    const friendshipService = new FriendshipService(supabase)

    const result = await friendshipService.updateFriendNotes(friendshipId, userId, notes)
    const statusCode = result.success ? 200 : 400
    return res.status(statusCode).json(result)
  } catch (error) {
    console.error('Error updating friend notes:', error)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/**
 * Add aspect to friend
 * POST /friends/:friendshipId/aspects
 * Body: { aspectId: string }
 */
router.post('/:friendshipId/aspects', authenticateRequest, async (req: Request, res: Response) => {
  try {
    const userId = req.authUserId
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }
    const { friendshipId } = req.params
    const { aspectId } = req.body

    if (!friendshipId) {
      return res.status(400).json({ success: false, error: 'Friendship ID is required' })
    }

    if (!aspectId || typeof aspectId !== 'string') {
      return res.status(400).json({ success: false, error: 'Aspect ID is required' })
    }

    const supabase = getSupabaseClient()
    const friendshipService = new FriendshipService(supabase)

    const result = await friendshipService.addFriendAspect(friendshipId, userId, aspectId)
    const statusCode = result.success ? 200 : 400
    return res.status(statusCode).json(result)
  } catch (error) {
    console.error('Error adding friend aspect:', error)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/**
 * Remove aspect from friend
 * DELETE /friends/:friendshipId/aspects/:aspectId
 */
router.delete('/:friendshipId/aspects/:aspectId', authenticateRequest, async (req: Request, res: Response) => {
  try {
    const userId = req.authUserId
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }
    const { friendshipId, aspectId } = req.params

    if (!friendshipId) {
      return res.status(400).json({ success: false, error: 'Friendship ID is required' })
    }

    if (!aspectId) {
      return res.status(400).json({ success: false, error: 'Aspect ID is required' })
    }

    const supabase = getSupabaseClient()
    const friendshipService = new FriendshipService(supabase)

    const result = await friendshipService.removeFriendAspect(friendshipId, userId, aspectId)
    const statusCode = result.success ? 200 : 400
    return res.status(statusCode).json(result)
  } catch (error) {
    console.error('Error removing friend aspect:', error)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

export default router
