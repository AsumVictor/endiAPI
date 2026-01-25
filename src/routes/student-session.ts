// Student Assignment Session routes
import { Router } from 'express';
import type { Request, Response } from 'express';
import expressValidator from 'express-validator';
const { body, validationResult } = expressValidator as any;
import { asyncHandler } from '../utils/errors.js';
import { StudentSessionService } from '../services/student-session.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { examLimiter } from '../middleware/index.js';
import type { CreateSessionRequest, UpdateSessionRequest } from '../models/assignment.js';

const router = Router();

// Validation middleware
const validateCreateSession = [
  body('assignment_id').isUUID().withMessage('Assignment ID must be a valid UUID'),
];

const validateUpdateSession = [
  body('submitted_at').optional().isISO8601().withMessage('Submitted at must be a valid ISO 8601 timestamp'),
  body('status').optional().isIn(['in_progress', 'submitted', 'expired']).withMessage('Status must be in_progress, submitted, or expired'),
  body('score').optional().isFloat({ min: 0 }).withMessage('Score must be a non-negative number'),
];

/**
 * @swagger
 * /api/student-sessions:
 *   post:
 *     summary: Create a new session (start an assignment)
 *     description: |
 *       Students can create a session to start working on an assignment.
 *       
 *       **Validation:**
 *       - Assignment must be published
 *       - Assignment must have started (if start_time is set)
 *       - Assignment deadline must not have passed (if deadline is set)
 *       - Only one session per student per assignment is allowed
 *     tags: [Student Sessions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - assignment_id
 *             properties:
 *               assignment_id:
 *                 type: string
 *                 format: uuid
 *                 example: "550e8400-e29b-41d4-a716-446655440000"
 *     responses:
 *       201:
 *         description: Session created successfully
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
 *                   example: "Session created successfully"
 *                 data:
 *                   $ref: '#/components/schemas/StudentAssignmentSession'
 *       400:
 *         description: Validation error or creation failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Assignment not published, not started, or deadline passed
 *       404:
 *         description: Assignment not found
 *       409:
 *         description: Session already exists for this assignment
 */
router.post('/',
  authenticateToken,
  requireRole(['student', 'admin']),
  validateCreateSession,
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

    const sessionData: CreateSessionRequest = req.body;
    const userId = req.user!.id;

    const result = await StudentSessionService.createSession(sessionData, userId);
    res.status(201).json(result);
  })
);

/**
 * @swagger
 * /api/student-sessions/{sessionId}/pause:
 *   patch:
 *     summary: Pause a session (stop the timer)
 *     tags: [Student Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Session paused successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Session not found
 */
router.patch('/:sessionId/pause',
  authenticateToken,
  requireRole(['student', 'admin']),
  asyncHandler(async (req: Request, res: Response) => {
    const sessionId = req.params['sessionId'];
    if (!sessionId) {
      res.status(400).json({ success: false, error: 'Session ID is required' });
      return;
    }
    const userId = req.user!.id;
    const result = await StudentSessionService.pauseSession(sessionId, userId);
    res.status(200).json(result);
  })
);

/**
 * @swagger
 * /api/student-sessions/{sessionId}/resume:
 *   patch:
 *     summary: Resume a session (start the timer)
 *     description: Resuming enforces assignment duration with a 45-second grace period.
 *     tags: [Student Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Session resumed successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden or duration exceeded
 *       404:
 *         description: Session not found
 */
router.patch('/:sessionId/resume',
  authenticateToken,
  requireRole(['student', 'admin']),
  asyncHandler(async (req: Request, res: Response) => {
    const sessionId = req.params['sessionId'];
    if (!sessionId) {
      res.status(400).json({ success: false, error: 'Session ID is required' });
      return;
    }
    const userId = req.user!.id;
    const result = await StudentSessionService.resumeSession(sessionId, userId);
    res.status(200).json(result);
  })
);

/**
 * @swagger
 * /api/student-sessions/my:
 *   get:
 *     summary: Get all sessions for the current student
 *     description: Get all assignment sessions for the authenticated student, ordered by creation date (newest first)
 *     tags: [Student Sessions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sessions retrieved successfully
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
 *                   example: "Sessions retrieved successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/StudentAssignmentSession'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Student profile not found
 */
router.get('/my',
  authenticateToken,
  requireRole(['student', 'admin']),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    const result = await StudentSessionService.getSessionsByStudent(userId);
    res.status(200).json(result);
  })
);

/**
 * @swagger
 * /api/student-sessions/assignment/{assignmentId}:
 *   get:
 *     summary: Get all sessions for an assignment (lecturer only)
 *     description: Lecturers can view all student sessions for their own assignments, ordered by creation date (newest first)
 *     tags: [Student Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: assignmentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         example: "550e8400-e29b-41d4-a716-446655440000"
 *     responses:
 *       200:
 *         description: Sessions retrieved successfully
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
 *                   example: "Sessions retrieved successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/StudentAssignmentSession'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not assignment owner
 *       404:
 *         description: Assignment not found
 */
router.get('/assignment/:assignmentId',
  authenticateToken,
  requireRole(['lecturer', 'admin']),
  asyncHandler(async (req: Request, res: Response) => {
    const { assignmentId } = req.params;
    if (!assignmentId || typeof assignmentId !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Assignment ID is required',
      });
      return;
    }

    const userId = req.user!.id;

    const result = await StudentSessionService.getSessionsByAssignment(assignmentId, userId);
    res.status(200).json(result);
  })
);

/**
 * @swagger
 * /api/student-sessions/{sessionId}:
 *   get:
 *     summary: Get session by ID
 *     description: Get a specific session by ID. Students can view their own sessions, lecturers can view sessions for their assignments
 *     tags: [Student Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         example: "aa0e8400-e29b-41d4-a716-446655440005"
 *     responses:
 *       200:
 *         description: Session retrieved successfully
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
 *                   example: "Session retrieved successfully"
 *                 data:
 *                   $ref: '#/components/schemas/StudentAssignmentSession'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not session owner or assignment owner
 *       404:
 *         description: Session not found
 */
router.get('/:sessionId',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    if (!sessionId || typeof sessionId !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Session ID is required',
      });
      return;
    }

    const userId = req.user!.id;
    const isLecturer = req.user!.role === 'lecturer' || req.user!.role === 'admin';

    const result = await StudentSessionService.getSessionById(sessionId, userId, isLecturer);
    res.status(200).json(result);
  })
);

/**
 * @swagger
 * /api/student-sessions/{sessionId}:
 *   put:
 *     summary: Update session
 *     description: Students can update their own sessions (e.g., submit assignment). Cannot update submitted sessions.
 *     tags: [Student Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         example: "aa0e8400-e29b-41d4-a716-446655440005"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               submitted_at:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *                 example: "2024-01-15T12:00:00Z"
 *                 description: "Timestamp when assignment was submitted (null to unsubmit)"
 *               status:
 *                 type: string
 *                 enum: [in_progress, submitted, expired]
 *                 example: "submitted"
 *                 description: "Session status"
 *               score:
 *                 type: number
 *                 nullable: true
 *                 minimum: 0
 *                 example: 85.5
 *                 description: "Assignment score (null if not graded)"
 *     responses:
 *       200:
 *         description: Session updated successfully
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
 *                   example: "Session updated successfully"
 *                 data:
 *                   $ref: '#/components/schemas/StudentAssignmentSession'
 *       400:
 *         description: Validation error or update failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not session owner or session already submitted
 *       404:
 *         description: Session not found
 */
router.put('/:sessionId',
  authenticateToken,
  requireRole(['student', 'admin']),
  validateUpdateSession,
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

    const { sessionId } = req.params;
    if (!sessionId || typeof sessionId !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Session ID is required',
      });
      return;
    }

    const updateData: UpdateSessionRequest = req.body;
    const userId = req.user!.id;

    const result = await StudentSessionService.updateSession(sessionId, updateData, userId);
    res.status(200).json(result);
  })
);

/**
 * @swagger
 * /api/student-sessions/{sessionId}:
 *   delete:
 *     summary: Delete session
 *     description: Students can delete their own sessions. This will also delete all associated answers.
 *     tags: [Student Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         example: "aa0e8400-e29b-41d4-a716-446655440005"
 *     responses:
 *       200:
 *         description: Session deleted successfully
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
 *                   example: "Session deleted successfully"
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not session owner
 *       404:
 *         description: Session not found
 */
router.delete('/:sessionId',
  authenticateToken,
  requireRole(['student', 'admin']),
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    if (!sessionId || typeof sessionId !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Session ID is required',
      });
      return;
    }

    const userId = req.user!.id;

    const result = await StudentSessionService.deleteSession(sessionId, userId);
    res.status(200).json(result);
  })
);

/**
 * @swagger
 * /api/student-sessions/{sessionId}/heartbeat:
 *   post:
 *     summary: Send heartbeat to update session time tracking
 *     description: |
 *       Updates the session's time_used_seconds based on active time since last_resumed_at.
 *       This should be called periodically (e.g., every 30-60 seconds) by the frontend
 *       while the student is actively working on the assignment.
 *       
 *       **How it works:**
 *       - If session is paused (no last_resumed_at), returns without updating
 *       - If session is active, calculates time used and updates time_used_seconds
 *       - Checks duration limit and expires session if exceeded
 *       - Keeps last_resumed_at unchanged to indicate session is still active
 *       
 *       **Use Cases:**
 *       - Periodic time tracking during active exam
 *       - Auto-save mechanism can call this
 *       - Frontend timer can sync with server time
 *     tags: [Student Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Student assignment session ID
 *     responses:
 *       200:
 *         description: Heartbeat updated successfully
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
 *                   example: "Heartbeat updated successfully"
 *                 data:
 *                   $ref: '#/components/schemas/StudentAssignmentSession'
 *       403:
 *         description: Session is paused, expired, or duration exceeded
 *       404:
 *         description: Session not found
 */
router.post('/:sessionId/heartbeat',
  examLimiter,
  authenticateToken,
  requireRole(['student']),
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    if (!sessionId || typeof sessionId !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Session ID is required',
      });
      return;
    }

    const userId = req.user!.id;

    const result = await StudentSessionService.heartbeat(sessionId, userId);
    res.status(200).json(result);
  })
);

/**
 * @swagger
 * /api/student-sessions/{sessionId}/submit:
 *   post:
 *     summary: Submit assignment (student only)
 *     description: |
 *       Students can submit their assignment session. This will:
 *       - Finalize the time_used_seconds (stops the timer)
 *       - Set status to 'submitted'
 *       - Set submitted_at to current timestamp
 *       - Prevent further modifications to answers
 *       
 *       **If already submitted:**
 *       - Updates submitted_at to current timestamp (idempotent operation)
 *       
 *       **Validation:**
 *       - Session must belong to the student
 *       - Session must not be expired
 *       - Assignment deadline must not have passed (if deadline is set)
 *       - Assignment must not be graded
 *       
 *       **Note:** This endpoint takes no body parameters - only the sessionId in the path.
 *     tags: [Student Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Student assignment session ID
 *         example: "aa0e8400-e29b-41d4-a716-446655440005"
 *     responses:
 *       200:
 *         description: Assignment submitted successfully
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
 *                   example: "Assignment submitted successfully"
 *                 data:
 *                   $ref: '#/components/schemas/StudentAssignmentSession'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not session owner, session expired, deadline passed, or assignment graded
 *       404:
 *         description: Session or assignment not found
 */
router.post('/:sessionId/submit',
  authenticateToken,
  requireRole(['student']),
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    if (!sessionId || typeof sessionId !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Session ID is required',
      });
      return;
    }

    const userId = req.user!.id;

    const result = await StudentSessionService.submitSession(sessionId, userId);
    res.status(200).json(result);
  })
);

export default router;
