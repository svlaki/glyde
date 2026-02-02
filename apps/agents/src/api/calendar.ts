import { Request, Response } from 'express';
import { CalendarIntegrationService } from '../services/CalendarIntegrationService.js';
import { CalendarAnalysisService } from '../services/CalendarAnalysisService.js';
import multer from 'multer';

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/calendar' || file.originalname.endsWith('.ics')) {
      cb(null, true);
    } else {
      cb(new Error('Only .ics files are allowed'));
    }
  }
});

export const uploadMiddleware = upload.single('file');

/**
 * Get Google OAuth URL
 * POST /api/calendar/google/auth
 */
export async function getGoogleAuthUrl(req: Request, res: Response) {
  try {
    const userId = req.authUserId;

    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const authUrl = CalendarIntegrationService.getGoogleAuthUrl(userId);

    res.json({
      success: true,
      authUrl,
      state: userId
    });
  } catch (error: any) {
    console.error('Error generating Google auth URL:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate Google auth URL'
    });
  }
}

/**
 * Handle Google OAuth callback
 * POST /api/calendar/google/callback
 */
export async function handleGoogleCallback(req: Request, res: Response) {
  try {
    const userId = req.authUserId;
    const { code, state } = req.body;

    if (!userId || !code || !state) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
      return;
    }

    // Verify state matches userId
    if (state !== userId) {
      res.status(400).json({
        success: false,
        error: 'Invalid state parameter'
      });
      return;
    }

    const accessToken = await CalendarIntegrationService.handleGoogleCallback(code, state);

    res.json({
      success: true,
      accessToken, // Return token to frontend for immediate use
      message: 'Google Calendar connected successfully'
    });
  } catch (error: any) {
    console.error('Error handling Google callback:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to connect Google Calendar'
    });
  }
}

/**
 * Import events from Google Calendar
 * POST /api/calendar/google/import
 */
export async function importGoogleCalendar(req: Request, res: Response) {
  try {
    const userId = req.authUserId;
    const { accessToken } = req.body;

    if (!userId || !accessToken) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
      return;
    }

    // Fetch events from Google Calendar
    const events = await CalendarIntegrationService.importGoogleEvents(userId, accessToken);

    // Import events into user schema
    const { eventCount, dateRange } = await CalendarIntegrationService.completeCalendarImport(
      userId,
      'google',
      events
    );

    // Queue analysis job
    const analysisJobId = await CalendarAnalysisService.queueAnalysisJob(userId);

    res.json({
      success: true,
      eventCount,
      dateRange,
      analysisJobId,
      message: `Imported ${eventCount} events from Google Calendar`
    });
  } catch (error: any) {
    console.error('Error importing Google Calendar:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to import Google Calendar'
    });
  }
}

/**
 * Upload and parse .ics file
 * POST /api/calendar/upload
 */
export async function uploadCalendarFile(req: Request, res: Response) {
  try {
    const userId = req.authUserId;

    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    if (!req.file) {
      res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
      return;
    }

    // Parse .ics file
    const events = CalendarIntegrationService.parseICSFile(req.file.buffer);

    // Import events into user schema
    const { eventCount, dateRange } = await CalendarIntegrationService.completeCalendarImport(
      userId,
      'ics',
      events
    );

    // Queue analysis job
    const analysisJobId = await CalendarAnalysisService.queueAnalysisJob(userId);

    res.json({
      success: true,
      eventCount,
      dateRange,
      analysisJobId,
      message: `Imported ${eventCount} events from .ics file`
    });
  } catch (error: any) {
    console.error('Error uploading calendar file:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload calendar file'
    });
  }
}

/**
 * Get analysis job status
 * GET /api/calendar/analysis/:jobId
 */
export async function getAnalysisStatus(req: Request, res: Response) {
  try {
    const userId = req.authUserId;
    const { jobId } = req.params;

    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    if (!jobId) {
      res.status(400).json({
        success: false,
        error: 'Missing jobId parameter'
      });
      return;
    }

    const job = CalendarAnalysisService.getAnalysisStatus(jobId);

    if (!job) {
      res.status(404).json({
        success: false,
        error: 'Analysis job not found'
      });
      return;
    }

    res.json({
      success: true,
      status: job.status,
      progress: job.progress,
      result: job.result,
      error: job.error
    });
  } catch (error: any) {
    console.error('Error getting analysis status:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get analysis status'
    });
  }
}
