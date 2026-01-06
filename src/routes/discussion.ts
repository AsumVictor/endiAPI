// Discussion routes
import { Router } from 'express';
import type { Request, Response } from 'express';
import expressValidator from 'express-validator';
const { body, validationResult } = expressValidator as any;
import { asyncHandler } from '../utils/errors.ts';
import { DiscussionService } from '../services/discussion.ts';
import { authenticateToken } from '../middleware/auth.ts';
import type { CreateThreadRequest, CreateMessageRequest, UpdateThreadStatusRequest } from '../models/discussion.ts';

const router = Router();

// Validation middleware
const validateCreateThread = [
  body('video_id').isUUID().withMessage('Video ID must be a valid UUID'),
  body('lecturer_id').isUUID().withMessage('Lecturer ID must be a valid UUID'),
  body('video_timestamp_seconds').optional().isInt({ min: 0 }).withMessage('Video timestamp must be a non-negative integer'),
  body('code_snippet').optional().isString().withMessage('Code snippet must be a string'),
  body('question_text').isLength({ min: 10, max: 5000 }).withMessage('Question text must be 10-5000 characters'),
];

const validateCreateMessage = [
  body('content').isLength({ min: 1, max: 5000 }).withMessage('Message content must be 1-5000 characters'),
];

const validateUpdateThreadStatus = [
  body('status').isIn(['open', 'resolved']).withMessage('Status must be either "open" or "resolved"'),
];

/**
 * @swagger
 * components:
 *   schemas:
 *     DiscussionThread:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "uuid-here"
 *         video_id:
 *           type: string
 *           example: "video-uuid-here"
 *         video_timestamp_seconds:
 *           type: integer
 *           nullable: true
 *           example: 120
 *         student_id:
 *           type: string
 *           example: "student-uuid-here"
 *         lecturer_id:
 *           type: string
 *           example: "lecturer-uuid-here"
 *         code_snippet:
 *           type: string
 *           nullable: true
 *           example: "const x = 10;"
 *         question_text:
 *           type: string
 *           example: "How does this code work?"
 *         student_unread:
 *           type: boolean
 *           example: false
 *         lecturer_unread:
 *           type: boolean
 *           example: true
 *         status:
 *           type: string
 *           enum: [open, resolved]
 *           example: "open"
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *          DiscussionMessage:
     *       type: object
     *       properties:
     *         id:
     *           type: string
     *           example: "uuid-here"
     *         thread_id:
     *           type: string
     *           example: "thread-uuid-here"
     *         author_user_id:
     *           type: string
     *           example: "user-uuid-here"
     *         author_name:
     *           type: string
     *           example: "John Doe"
     *           description: "Full name of the message author (first_name + last_name)"
     *         author_role:
     *           type: string
     *           enum: [student, lecturer, admin]
     *           example: "student"
     *           description: "Role of the message author"
     *         content:
     *           type: string
     *           example: "This is a reply message"
     *         created_at:
     *           type: string
     *           format: date-time
 */

/**
 * @swagger
 * /api/discussions/threads:
 *   post:
 *     summary: Create a new discussion thread (student asks a question)
 *     description: Students can create a new discussion thread about a video
 *     tags: [Discussions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - video_id
 *               - lecturer_id
 *               - question_text
 *             properties:
 *               video_id:
 *                 type: string
 *                 format: uuid
 *                 example: "550e8400-e29b-41d4-a716-446655440000"
 *               lecturer_id:
 *                 type: string
 *                 format: uuid
 *                 example: "660e8400-e29b-41d4-a716-446655440001"
 *               video_timestamp_seconds:
 *                 type: integer
 *                 minimum: 0
 *                 example: 120
 *               code_snippet:
 *                 type: string
 *                 example: "const x = 10;"
 *               question_text:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 5000
 *                 example: "How do I declare a variable in Python? I tried using 'var' but it didn't work."
 *     responses:
 *       201:
 *         description: Thread created successfully
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
 *                   example: "Thread created successfully"
 *                 data:
 *                   $ref: '#/components/schemas/DiscussionThread'
 *             example:
 *               success: true
 *               message: "Thread created successfully"
 *               data:
 *                 id: "770e8400-e29b-41d4-a716-446655440002"
 *                 video_id: "550e8400-e29b-41d4-a716-446655440000"
 *                 video_timestamp_seconds: 120
 *                 student_id: "880e8400-e29b-41d4-a716-446655440003"
 *                 lecturer_id: "660e8400-e29b-41d4-a716-446655440001"
 *                 code_snippet: "x = 10\ny = 20"
 *                 question_text: "How do I declare a variable in Python?"
 *                 student_unread: false
 *                 lecturer_unread: true
 *                 status: "open"
 *                 created_at: "2024-01-15T10:30:00.000Z"
 *                 updated_at: "2024-01-15T10:30:00.000Z"
 *       400:
 *         description: Validation error or creation failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not a student or invalid lecturer
 *       404:
 *         description: Video or lecturer not found
 */
router.post(
  '/threads',
  authenticateToken,
  validateCreateThread,
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

    const threadData: CreateThreadRequest = req.body;
    const userId = req.user!.id;

    const result = await DiscussionService.createThread(threadData, userId);
    res.status(201).json(result);
  })
);

/**
 * @swagger
 * /api/discussions/threads:
 *   get:
 *     summary: List all threads for current user
 *     description: Get all threads where the current user is a participant, optionally filtered by course/video
 *     tags: [Discussions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: video_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by video ID
 *       - in: query
 *         name: course_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by course ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [open, resolved]
 *         description: Filter by status
 *     responses:
 *       200:
 *         description: Threads retrieved successfully
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
 *                   example: "Threads retrieved successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/DiscussionThread'
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/threads',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const videoId = req.query['video_id'] as string | undefined;
    const courseId = req.query['course_id'] as string | undefined;
    const status = req.query['status'] as 'open' | 'resolved' | undefined;

    const filters = {
      ...(videoId && { video_id: videoId }),
      ...(courseId && { course_id: courseId }),
      ...(status && { status }),
    };

    const result = await DiscussionService.listThreads(userId, Object.keys(filters).length > 0 ? filters : undefined);
    res.status(200).json(result);
  })
);

/**
 * @swagger
 * /api/discussions/threads/unread:
 *   get:
 *     summary: Get unread threads for current user
 *     description: Get all threads with unread messages for the current user
 *     tags: [Discussions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unread threads retrieved successfully
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
 *                   example: "Unread threads retrieved successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/DiscussionThread'
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/threads/unread',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    const result = await DiscussionService.getUnreadThreads(userId);
    res.status(200).json(result);
  })
);

/**
 * @swagger
 * /api/discussions/threads/{id}:
 *   get:
 *     summary: Get thread with all messages
 *     description: Get a specific thread with all its messages
 *     tags: [Discussions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Thread ID
 *     responses:
 *       200:
 *         description: Thread retrieved successfully
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
 *                   example: "Thread retrieved successfully"
 *                 data:
 *                   type: object
 *                   allOf:
 *                     - $ref: '#/components/schemas/DiscussionThread'
 *                     - type: object
 *                       properties:
 *                         messages:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/DiscussionMessage'
 *             example:
 *               success: true
 *               message: "Thread retrieved successfully"
 *               data:
 *                 id: "770e8400-e29b-41d4-a716-446655440002"
 *                 video_id: "550e8400-e29b-41d4-a716-446655440000"
 *                 video_timestamp_seconds: 120
 *                 student_id: "880e8400-e29b-41d4-a716-446655440003"
 *                 lecturer_id: "660e8400-e29b-41d4-a716-446655440001"
 *                 code_snippet: "x = 10\ny = 20"
 *                 question_text: "How do I declare a variable in Python?"
 *                 student_unread: false
 *                 lecturer_unread: false
 *                 status: "open"
 *                 created_at: "2024-01-15T10:30:00.000Z"
 *                 updated_at: "2024-01-15T10:45:00.000Z"
 *                 messages:
 *                   - id: "aa0e8400-e29b-41d4-a716-446655440004"
 *                     thread_id: "770e8400-e29b-41d4-a716-446655440002"
 *                     author_user_id: "880e8400-e29b-41d4-a716-446655440003"
 *                     author_name: "John Doe"
 *                     author_role: "student"
 *                     content: "How do I declare a variable in Python?"
 *                     created_at: "2024-01-15T10:30:00.000Z"
 *                   - id: "bb0e8400-e29b-41d4-a716-446655440005"
 *                     thread_id: "770e8400-e29b-41d4-a716-446655440002"
 *                     author_user_id: "dd0e8400-e29b-41d4-a716-446655440008"
 *                     author_name: "Jane Smith"
 *                     author_role: "lecturer"
 *                     content: "In Python, you don't need to declare variables. Simply assign: x = 10"
 *                     created_at: "2024-01-15T10:45:00.000Z"
 *       400:
 *         description: Bad Request - Invalid thread ID
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not a participant
 *       404:
 *         description: Thread not found
 */
router.get(
  '/threads/:id',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id || typeof id !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Thread ID is required',
      });
      return;
    }

    const userId = req.user!.id;
    const result = await DiscussionService.getThreadById(id, userId);
    res.status(200).json(result);
  })
);

/**
 * @swagger
 * /api/discussions/threads/{id}/read:
 *   post:
 *     summary: Mark thread as read for current user
 *     description: Mark a thread as read, clearing the unread flag for the current user
 *     tags: [Discussions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Thread ID
 *     responses:
 *       200:
 *         description: Thread marked as read
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
 *                   example: "Thread marked as read"
 *                 data:
 *                   $ref: '#/components/schemas/DiscussionThread'
 *       400:
 *         description: Bad Request - Invalid thread ID
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not a participant
 *       404:
 *         description: Thread not found
 */
router.post(
  '/threads/:id/read',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id || typeof id !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Thread ID is required',
      });
      return;
    }

    const userId = req.user!.id;
    const result = await DiscussionService.markThreadAsRead(id, userId);
    res.status(200).json(result);
  })
);

/**
 * @swagger
 * /api/discussions/threads/{id}/messages:
 *   post:
 *     summary: Add a message to a thread
 *     description: Add a reply message to a discussion thread
 *     tags: [Discussions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Thread ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 5000
 *                 example: "In Python, you don't need to declare variables. Simply assign: x = 10"
 *     responses:
 *       201:
 *         description: Message added successfully
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
 *                   example: "Message added successfully"
 *                 data:
 *                   $ref: '#/components/schemas/DiscussionMessage'
 *             example:
 *               success: true
 *               message: "Message added successfully"
 *               data:
 *                 id: "cc0e8400-e29b-41d4-a716-446655440007"
 *                 thread_id: "770e8400-e29b-41d4-a716-446655440002"
 *                 author_user_id: "dd0e8400-e29b-41d4-a716-446655440008"
 *                 content: "In Python, you don't need to declare variables. Simply assign: x = 10"
 *                 created_at: "2024-01-15T10:45:00.000Z"
 *       400:
 *         description: Validation error or creation failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not a participant
 *       404:
 *         description: Thread not found
 */
router.post(
  '/threads/:id/messages',
  authenticateToken,
  validateCreateMessage,
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

    const { id } = req.params;
    if (!id || typeof id !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Thread ID is required',
      });
      return;
    }

    const messageData: CreateMessageRequest = req.body;
    const userId = req.user!.id;

    const result = await DiscussionService.addMessage(id, messageData, userId);
    res.status(201).json(result);
  })
);

/**
 * @swagger
 * /api/discussions/threads/{id}/status:
 *   patch:
 *     summary: Update thread status (open or resolved)
 *     description: Update a thread's status. Participants can mark threads as resolved or reopen them.
 *     tags: [Discussions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Thread ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [open, resolved]
 *                 example: "resolved"
 *                 description: "New status for the thread"
 *     responses:
 *       200:
 *         description: Thread status updated successfully
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
 *                   example: "Thread resolved successfully"
 *                 data:
 *                   $ref: '#/components/schemas/DiscussionThread'
 *             example:
 *               success: true
 *               message: "Thread resolved successfully"
 *               data:
 *                 id: "770e8400-e29b-41d4-a716-446655440002"
 *                 video_id: "550e8400-e29b-41d4-a716-446655440000"
 *                 status: "resolved"
 *                 updated_at: "2024-01-15T11:00:00.000Z"
 *       400:
 *         description: Bad Request - Invalid thread ID or status value
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not a participant
 *       404:
 *         description: Thread not found
 */
router.patch(
  '/threads/:id/status',
  authenticateToken,
  validateUpdateThreadStatus,
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

    const { id } = req.params;
    if (!id || typeof id !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Thread ID is required',
      });
      return;
    }

    const statusData: UpdateThreadStatusRequest = req.body;
    const userId = req.user!.id;

    const result = await DiscussionService.updateThreadStatus(id, statusData, userId);
    res.status(200).json(result);
  })
);

export default router;

