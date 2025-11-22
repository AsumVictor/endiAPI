// Lecturer routes
import { Router } from 'express';
import type { Request, Response } from 'express';
import { asyncHandler, AppError } from '../utils/errors.ts';
import { CourseService } from '../services/course.ts';
import { VideoService } from '../services/video.ts';
import { authenticateToken, requireRole } from '../middleware/auth.ts';
import { supabase } from '../config/database.ts';

const router = Router();

/**
 * @swagger
 * /api/lecturers/courses:
 *   get:
 *     summary: Get all courses by lecturer with metrics
 *     description: Fetch all courses created by the lecturer with enrollment and video count metrics
 *     tags: [Lecturers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Courses retrieved successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Lecturer not found
 */
router.get('/courses',
  authenticateToken,
  requireRole(['lecturer', 'admin']),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const result = await CourseService.getCoursesByLecturerWithMetrics(userId);
    res.status(200).json(result);
  })
);

/**
 * @swagger
 * /api/lecturers/courses/{courseId}/details:
 *   get:
 *     summary: Get course details with videos and metrics (lecturer view)
 *     description: Fetch comprehensive course details including all videos (public and private) with completion stats
 *     tags: [Lecturers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *         description: Course ID
 *     responses:
 *       200:
 *         description: Course details retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not course owner
 *       404:
 *         description: Course not found
 */
router.get('/courses/:courseId/details',
  authenticateToken,
  requireRole(['lecturer', 'admin']),
  asyncHandler(async (req: Request, res: Response) => {
    const { courseId } = req.params;
    if (!courseId || typeof courseId !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Course ID is required',
      });
      return;
    }

    const userId = req.user!.id;
    const result = await CourseService.getCourseDetailsByLecturer(courseId, userId);
    res.status(200).json(result);
  })
);

/**
 * @swagger
 * /api/lecturers/videos:
 *   get:
 *     summary: Get all videos by lecturer
 *     description: Fetch all videos created by the lecturer across all their courses
 *     tags: [Lecturers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Videos retrieved successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Lecturer not found
 */
router.get('/videos',
  authenticateToken,
  requireRole(['lecturer', 'admin']),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const result = await VideoService.getVideosByLecturer(userId);
    res.status(200).json(result);
  })
);

/**
 * @swagger
 * /api/lecturers/videos/{videoId}:
 *   get:
 *     summary: Get specific video by ID (lecturer view)
 *     description: Fetch details of a specific video owned by the lecturer
 *     tags: [Lecturers]
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
 *         description: Video retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not video owner
 *       404:
 *         description: Video not found
 */
router.get('/videos/:videoId',
  authenticateToken,
  requireRole(['lecturer', 'admin']),
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
    const result = await VideoService.getVideoByIdForLecturer(videoId, userId);
    res.status(200).json(result);
  })
);

/**
 * @swagger
 * /api/lecturers/videos/{videoId}/public:
 *   put:
 *     summary: Set video to public
 *     description: Changes video visibility to public (ispublic = true). Only the course owner can update video visibility.
 *     tags: [Lecturers]
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
 *         description: Video set to public successfully
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
 *                   example: "Video set to public successfully"
 *                 data:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not video owner
 *       404:
 *         description: Video not found
 *       500:
 *         description: Internal server error
 */
router.put('/videos/:videoId/public',
  authenticateToken,
  requireRole(['lecturer', 'admin']),
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
    const result = await VideoService.updateVideo(videoId, { ispublic: true }, userId);
    res.status(200).json({
      success: true,
      message: 'Video set to public successfully',
      data: result.data,
    });
  })
);

/**
 * @swagger
 * /api/lecturers/videos/{videoId}/private:
 *   put:
 *     summary: Set video to private
 *     description: Changes video visibility to private (ispublic = false). Only the course owner can update video visibility.
 *     tags: [Lecturers]
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
 *         description: Video set to private successfully
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
 *                   example: "Video set to private successfully"
 *                 data:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not video owner
 *       404:
 *         description: Video not found
 *       500:
 *         description: Internal server error
 */
router.put('/videos/:videoId/private',
  authenticateToken,
  requireRole(['lecturer', 'admin']),
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
    const result = await VideoService.updateVideo(videoId, { ispublic: false }, userId);
    res.status(200).json({
      success: true,
      message: 'Video set to private successfully',
      data: result.data,
    });
  })
);

/**
 * @swagger
 * /api/lecturers/{lecturerId}/courses:
 *   get: 
 *     summary: Get lecturer's courses
 *     description: Fetch all courses owned by a lecturer. Accessible by lecturer and admin.
 *     tags: [Lecturers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: lecturerId
 *         required: true
 *         schema:
 *           type: string
 *         description: Lecturer profile ID
 *     responses:
 *       200:
 *         description: Courses retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/:lecturerId/courses',
  authenticateToken,
  requireRole(['lecturer', 'admin']),
  asyncHandler(async (req: Request, res: Response) => {
    const { lecturerId } = req.params;
    if (!lecturerId || typeof lecturerId !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Lecturer ID is required',
      });
      return;
    }

    // Get the lecturer record to check if this lecturer belongs to the authenticated user
    const { data: lecturer, error: lecturerError } = await supabase
      .from('lecturers')
      .select('user_id')
      .eq('id', lecturerId)
      .single();

    if (lecturerError || !lecturer) {
      throw new AppError('Lecturer not found', 404);
    }

    // Check if user is accessing their own courses or is admin
    if (req.user!.role !== 'admin' && req.user!.id !== lecturer.user_id) {
      throw new AppError('You can only view your own courses', 403);
    }

    const result = await CourseService.getCoursesByLecturer(lecturer.user_id);
    res.status(200).json(result);
  })
);

export default router;

