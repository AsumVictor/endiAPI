// Student routes
import { Router } from 'express';
import type { Request, Response } from 'express';
import { asyncHandler, AppError } from '../utils/errors.js';
import { StudentService } from '../services/student.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();

/**
 * @swagger
 * /api/students/streak:
 *   get:
 *     summary: Get student login streak information
 *     description: Returns the student's current streak count and last login date
 *     tags: [Students]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Streak information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     streak_count:
 *                       type: integer
 *                       example: 5
 *                     last_login:
 *                       type: string
 *                       format: date
 *                       example: "2024-01-15"
 *                       nullable: true
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Only students can view their streak
 *       404:
 *         description: Student profile not found
 *       500:
 *         description: Internal server error
 */
router.get('/streak',
  authenticateToken,
  requireRole(['student', 'admin']),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    
    // Ensure the user is viewing their own streak or is an admin
    if (req.user!.role !== 'admin' && req.user!.id !== userId) {
      throw new AppError('You can only view your own streak', 403);
    }

    const streakData = await StudentService.getStreak(userId);
    res.status(200).json({
      success: true,
      message: 'Streak information retrieved successfully',
      data: streakData,
    });
  })
);

/**
 * @swagger
 * /api/students/streak:
 *   put:
 *     summary: Update student login streak
 *     description: Updates the student's daily login streak count and last login date. Logic: If today equals last_login, no change. If current date - last_login > 5 days, reset streak to 0. Else decrease streak by missed days.
 *     tags: [Students]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Streak updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Streak updated successfully!"
 *                 data:
 *                   type: object
 *                   properties:
 *                     streak_count:
 *                       type: integer
 *                       example: 5
 *                     last_login:
 *                       type: string
 *                       format: date
 *                       example: "2024-01-15"
 *                     days_missed:
 *                       type: integer
 *                       example: 0
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Only students can update their streak
 *       404:
 *         description: Student profile not found
 *       500:
 *         description: Internal server error
 */
router.put('/streak',
  authenticateToken,
  requireRole(['student', 'admin']),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    
    // Ensure the user is updating their own streak or is an admin
    if (req.user!.role !== 'admin' && req.user!.id !== userId) {
      throw new AppError('You can only update your own streak', 403);
    }

    const result = await StudentService.updateStreak(userId);
    res.status(200).json(result);
  })
);

/**
 * @swagger
 * /api/students/dashboard:
 *   get:
 *     summary: Get student dashboard data
 *     description: Returns comprehensive dashboard data including course progress, completed courses, recent activity, and statistics
 *     tags: [Students]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Dashboard data retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     total_courses_enrolled:
 *                       type: integer
 *                       example: 5
 *                     completed_courses_count:
 *                       type: integer
 *                       example: 2
 *                     completed_courses:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             example: "course-uuid"
 *                           title:
 *                             type: string
 *                             example: "Introduction to Machine Learning"
 *                     total_videos_watched:
 *                       type: integer
 *                       example: 25
 *                     course_progress:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           title:
 *                             type: string
 *                             example: "Introduction to Machine Learning"
 *                           summary:
 *                             type: string
 *                             example: "Learn the fundamentals of ML"
 *                           thumbnail_url:
 *                             type: string
 *                             nullable: true
 *                             example: "https://example.com/thumbnail.jpg"
 *                           total_videos:
 *                             type: integer
 *                             example: 10
 *                           total_watched_videos:
 *                             type: integer
 *                             example: 7
 *                           course_id:
 *                             type: string
 *                             example: "course-uuid"
 *                     recent_enrolled_courses:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             example: "course-uuid"
 *                           title:
 *                             type: string
 *                             example: "Introduction to Machine Learning"
 *                           timestamp:
 *                             type: string
 *                             format: date-time
 *                             example: "2024-01-15T10:30:00Z"
 *                     recent_watched_videos:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             example: "video-uuid"
 *                           title:
 *                             type: string
 *                             example: "Python Variables Basics"
 *                           timestamp:
 *                             type: string
 *                             format: date-time
 *                             example: "2024-01-15T10:30:00Z"
 *                     recent_completed_videos:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             example: "video-uuid"
 *                           title:
 *                             type: string
 *                             example: "Python Variables Basics"
 *                           timestamp:
 *                             type: string
 *                             format: date-time
 *                             example: "2024-01-15T10:30:00Z"
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Only students can view their dashboard
 *       404:
 *         description: Student profile not found
 *       500:
 *         description: Internal server error
 */
router.get('/dashboard',
  authenticateToken,
  requireRole(['student', 'admin']),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    
    // Ensure the user is viewing their own dashboard or is an admin
    if (req.user!.role !== 'admin' && req.user!.id !== userId) {
      throw new AppError('You can only view your own dashboard', 403);
    }

    const result = await StudentService.getDashboard(userId);
    res.status(200).json(result);
  })
);

/**
 * @swagger
 * /api/students/videos/{videoId}/progress:
 *   post:
 *     summary: Create video progress (start watching a video)
 *     description: Creates a new video progress entry with completed set to false. Returns "already watch" if progress already exists.
 *     tags: [Students]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: videoId
 *         required: true
 *         schema:
 *           type: string
 *         description: Video ID
 *     responses:
 *       200:
 *         description: Video progress created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Video progress created successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     video_id:
 *                       type: string
 *                     student_id:
 *                       type: string
 *                     completed:
 *                       type: boolean
 *                       example: false
 *                     completed_at:
 *                       type: string
 *                       nullable: true
 *       400:
 *         description: Bad request or already watch
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "already watch"
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Not enrolled in course or only students can create progress
 *       404:
 *         description: Video or student profile not found
 *       500:
 *         description: Internal server error
 */
router.post('/videos/:videoId/progress',
  authenticateToken,
  requireRole(['student', 'admin']),
  asyncHandler(async (req: Request, res: Response) => {
    const { videoId } = req.params;
    if (!videoId || typeof videoId !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Video ID is required',
      });
      return;
    }

    const userId = req.user!.id;
    
    // Ensure the user is creating their own progress or is an admin
    if (req.user!.role !== 'admin' && req.user!.id !== userId) {
      throw new AppError('You can only create your own video progress', 403);
    }

    const result = await StudentService.createVideoProgress(videoId, userId);
    
    if (!result.success) {
      res.status(400).json(result);
      return;
    }
    
    res.status(200).json(result);
  })
);

/**
 * @swagger
 * /api/students/videos/{videoId}/progress/complete:
 *   put:
 *     summary: Mark video as completed
 *     description: Updates video progress to mark the video as completed (sets completed to true and sets completed_at timestamp)
 *     tags: [Students]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: videoId
 *         required: true
 *         schema:
 *           type: string
 *         description: Video ID
 *     responses:
 *       200:
 *         description: Video marked as completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Video marked as completed"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     video_id:
 *                       type: string
 *                     student_id:
 *                       type: string
 *                     completed:
 *                       type: boolean
 *                       example: true
 *                     completed_at:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Not enrolled in course or only students can complete videos
 *       404:
 *         description: Video or student profile not found
 *       500:
 *         description: Internal server error
 */
router.put('/videos/:videoId/progress/complete',
  authenticateToken,
  requireRole(['student', 'admin']),
  asyncHandler(async (req: Request, res: Response) => {
    const { videoId } = req.params;
    if (!videoId || typeof videoId !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Video ID is required',
      });
      return;
    }

    const userId = req.user!.id;
    
    // Ensure the user is completing their own video or is an admin
    if (req.user!.role !== 'admin' && req.user!.id !== userId) {
      throw new AppError('You can only complete your own videos', 403);
    }

    const result = await StudentService.completeVideo(videoId, userId);
    res.status(200).json(result);
  })
);

export default router;

