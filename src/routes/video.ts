// Video routes
import { Router } from 'express';
import type { Request, Response } from 'express';
import expressValidator from 'express-validator';
const { body, validationResult } = expressValidator as any;
import { asyncHandler, AppError } from '../utils/errors.ts';
import { VideoService } from '../services/video.ts';
import { authenticateToken, requireRole } from '../middleware/auth.ts';
import type { CreateVideoRequest, UpdateVideoRequest } from '../models/video.ts';

const router = Router();

// Validation middleware
const validateCreateVideo = [
  body('title').isLength({ min: 3, max: 255 }).withMessage('Title must be 3-255 characters'),
  body('description').isLength({ min: 10, max: 2000 }).withMessage('Description must be 10-2000 characters'),
  body('camera_video_url').isURL().withMessage('Video URL must be a valid URL'),
  body('thumbnail_url').optional().isURL().withMessage('Thumbnail URL must be a valid URL'),
  body('snapshot_url').optional().isURL().withMessage('Snapshot URL must be a valid URL'),
  body('event_url').optional().isURL().withMessage('Event URL must be a valid URL'),
  body('transcript_url').optional().isURL().withMessage('Transcript URL must be a valid URL'),
  body('level').isIn(['beginner', 'intermediate', 'advanced']).withMessage('Level must be beginner, intermediate, or advanced'),
  body('ispublic').optional().isBoolean().withMessage('ispublic must be a boolean'),
];

const validateUpdateVideo = [
  body('title').optional().isLength({ min: 3, max: 255 }).withMessage('Title must be 3-255 characters'),
  body('description').optional().isLength({ min: 10, max: 2000 }).withMessage('Description must be 10-2000 characters'),
  body('camera_video_url').optional().isURL().withMessage('Video URL must be a valid URL'),
  body('thumbnail_url').optional().isURL().withMessage('Thumbnail URL must be a valid URL'),
  body('snapshot_url').optional().isURL().withMessage('Snapshot URL must be a valid URL'),
  body('event_url').optional().isURL().withMessage('Event URL must be a valid URL'),
  body('transcript_url').optional().isURL().withMessage('Transcript URL must be a valid URL'),
  body('level').optional().isIn(['beginner', 'intermediate', 'advanced']).withMessage('Level must be beginner, intermediate, or advanced'),
  body('ispublic').optional().isBoolean().withMessage('ispublic must be a boolean'),
];

/**
 * @swagger
 * components:
 *   schemas:
 *     Video:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "uuid-here"
 *         course_id:
 *           type: string
 *           example: "course-uuid-here"
 *         title:
 *           type: string
 *           example: "Introduction to Python Variables"
 *         description:
 *           type: string
 *           example: "Learn how to declare and use variables in Python"
 *         thumbnail_url:
 *           type: string
 *           example: "https://example.com/thumbnail.jpg"
 *         camera_video_url:
 *           type: string
 *           example: "https://example.com/video.mp4"
 *         snapshot_url:
 *           type: string
 *           nullable: true
 *           example: "https://example.com/snapshot.jpg"
 *         event_url:
 *           type: string
 *           nullable: true
 *           example: "https://example.com/event.json"
 *         transcript_url:
 *           type: string
 *           nullable: true
 *           example: "https://example.com/transcript.json"
 *         level:
 *           type: string
 *           enum: [beginner, intermediate, advanced]
 *           example: "beginner"
 *         ispublic:
 *           type: boolean
 *           example: true
 *         created_at:
 *           type: string
 *           format: date-time
 *     VideoProgress:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "uuid-here"
 *         video_id:
 *           type: string
 *           example: "video-uuid-here"
 *         student_id:
 *           type: string
 *           example: "student-uuid-here"
 *         completed:
 *           type: boolean
 *           example: true
 *         completed_at:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/courses/{courseId}/videos:
 *   post:
 *     summary: Create a new video
 *     description: Upload and add a video under a specific course. Only course owner can create videos.
 *     tags: [Videos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *         description: Course ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - description
 *               - camera_video_url
 *               - level
 *             properties:
 *               title:
 *                 type: string
 *                 example: "Introduction to Python Variables"
 *               description:
 *                 type: string
 *                 example: "Learn how to declare and use variables in Python"
 *               camera_video_url:
 *                 type: string
 *                 example: "https://example.com/video.mp4"
 *               thumbnail_url:
 *                 type: string
 *                 example: "https://example.com/thumbnail.jpg"
 *               snapshot_url:
 *                 type: string
 *                 example: "https://example.com/snapshot.jpg"
 *               event_url:
 *                 type: string
 *                 example: "https://example.com/event.json"
 *               transcript_url:
 *                 type: string
 *                 example: "https://example.com/transcript.json"
 *               level:
 *                 type: string
 *                 enum: [beginner, intermediate, advanced]
 *                 example: "beginner"
 *               ispublic:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       201:
 *         description: Video created successfully
 *       400:
 *         description: Validation error or creation failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not course owner
 *       404:
 *         description: Course not found
 */
router.post('/courses/:courseId/videos',
  authenticateToken,
  requireRole(['lecturer', 'admin']),
  validateCreateVideo,
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array(),
      });
      return;
    }

    const { courseId } = req.params;
    if (!courseId || typeof courseId !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Course ID is required',
      });
      return;
    }

    const videoData: CreateVideoRequest = req.body;
    const userId = req.user!.id;

    const result = await VideoService.createVideo(courseId, videoData, userId);
    res.status(201).json(result);
  })
);

/**
 * @swagger
 * /api/courses/{courseId}/videos:
 *   get:
 *     summary: Get course videos
 *     description: Fetch all videos belonging to a course. Accessible by enrolled students and course owner.
 *     tags: [Videos]
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
 *         description: Videos retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not enrolled or course owner
 *       404:
 *         description: Course not found
 */
router.get('/courses/:courseId/videos',
  authenticateToken,
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
    const result = await VideoService.getVideosByCourse(courseId, userId);
    res.status(200).json(result);
  })
);

/**
 * @swagger
 * /api/videos/{videoId}:
 *   get:
 *     summary: Get video details
 *     description: Fetch details of a specific video. Accessible by enrolled students and course owner.
 *     tags: [Videos]
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
 *         description: Forbidden - not enrolled or course owner
 *       404:
 *         description: Video not found
 */
router.get('/:videoId',
  authenticateToken,
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
    const result = await VideoService.getVideoById(videoId, userId);
    res.status(200).json(result);
  })
);

/**
 * @swagger
 * /api/videos/{videoId}:
 *   put:
 *     summary: Update video
 *     description: Update video details. Only course owner can update videos.
 *     tags: [Videos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: videoId
 *         required: true
 *         schema:
 *           type: string
 *         description: Video ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 example: "Advanced Python Variables"
 *               description:
 *                 type: string
 *                 example: "Deep dive into Python variable concepts"
 *               camera_video_url:
 *                 type: string
 *                 example: "https://example.com/new-video.mp4"
 *               thumbnail_url:
 *                 type: string
 *                 example: "https://example.com/new-thumbnail.jpg"
 *               snapshot_url:
 *                 type: string
 *                 example: "https://example.com/new-snapshot.jpg"
 *               event_url:
 *                 type: string
 *                 example: "https://example.com/new-event.json"
 *               transcript_url:
 *                 type: string
 *                 example: "https://example.com/new-transcript.json"
 *               level:
 *                 type: string
 *                 enum: [beginner, intermediate, advanced]
 *                 example: "intermediate"
 *               ispublic:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       200:
 *         description: Video updated successfully
 *       400:
 *         description: Validation error or update failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not course owner
 *       404:
 *         description: Video not found
 */
router.put('/:videoId',
  authenticateToken,
  requireRole(['lecturer', 'admin']),
  validateUpdateVideo,
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array(),
      });
      return;
    }

    const { videoId } = req.params;
    if (!videoId || typeof videoId !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Video ID is required',
      });
      return;
    }

    const updateData: UpdateVideoRequest = req.body;
    const userId = req.user!.id;

    const result = await VideoService.updateVideo(videoId, updateData, userId);
    res.status(200).json(result);
  })
);

/**
 * @swagger
 * /api/videos/{videoId}:
 *   delete:
 *     summary: Delete video
 *     description: Remove a video from the course. Only course owner can delete videos.
 *     tags: [Videos]
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
 *         description: Video deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not course owner
 *       404:
 *         description: Video not found
 */
router.delete('/:videoId',
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
    const result = await VideoService.deleteVideo(videoId, userId);
    res.status(200).json(result);
  })
);

/**
 * @swagger
 * /api/videos/{videoId}/complete:
 *   post:
 *     summary: Mark video as completed
 *     description: Mark a video as completed by the student. Only students can complete videos.
 *     tags: [Videos]
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
 *         description: Video marked as completed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not a student or not enrolled
 *       404:
 *         description: Video not found
 */
router.post('/:videoId/complete',
  authenticateToken,
  requireRole(['student']),
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
    const result = await VideoService.markVideoCompleted(videoId, userId);
    res.status(200).json(result);
  })
);

/**
 * @swagger
 * /api/students/{studentId}/videos/completed:
 *   get:
 *     summary: Get student's completed videos
 *     description: Fetch all videos completed by the student. Students can only view their own completed videos.
 *     tags: [Videos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Student ID
 *     responses:
 *       200:
 *         description: Completed videos retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - can only view own videos
 *       404:
 *         description: Student not found
 */
router.get('/students/:studentId/videos/completed',
  authenticateToken,
  requireRole(['student', 'admin']),
  asyncHandler(async (req: Request, res: Response) => {
    const { studentId } = req.params;
    if (!studentId || typeof studentId !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Student ID is required',
      });
      return;
    }

    // Check if user is accessing their own videos or is admin
    if (req.user!.role !== 'admin' && req.user!.id !== studentId) {
      throw new AppError('You can only view your own completed videos', 403);
    }

    const userId = req.user!.id;
    const result = await VideoService.getStudentCompletedVideos(userId);
    res.status(200).json(result);
  })
);

/**
 * @swagger
 * /api/courses/{courseId}/videos/completions:
 *   get:
 *     summary: Get video completion statistics
 *     description: Retrieve completion counts per video for a course. Only course owner can view statistics.
 *     tags: [Videos]
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
 *         description: Video completion statistics retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not course owner
 *       404:
 *         description: Course not found
 */
router.get('/courses/:courseId/videos/completions',
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
    const result = await VideoService.getCourseVideoCompletions(courseId, userId);
    res.status(200).json(result);
  })
);

/**
 * @swagger
 * /api/courses/{courseId}/students/{studentId}/video-progress:
 *   get:
 *     summary: Get student's video progress
 *     description: View a specific student's video completion status within a course. Only course owner can view student progress.
 *     tags: [Videos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *         description: Course ID
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Student ID
 *     responses:
 *       200:
 *         description: Student video progress retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not course owner
 *       404:
 *         description: Course or student not found
 */
router.get('/courses/:courseId/students/:studentId/video-progress',
  authenticateToken,
  requireRole(['lecturer', 'admin']),
  asyncHandler(async (req: Request, res: Response) => {
    const { courseId, studentId } = req.params;
    if (!courseId || typeof courseId !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Course ID is required',
      });
      return;
    }
    if (!studentId || typeof studentId !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Student ID is required',
      });
      return;
    }

    const userId = req.user!.id;
    const result = await VideoService.getStudentVideoProgress(courseId, studentId, userId);
    res.status(200).json(result);
  })
);

export default router;
