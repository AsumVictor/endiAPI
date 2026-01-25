// Assignment routes
import { Router } from 'express';
import type { Request, Response } from 'express';
import expressValidator from 'express-validator';
const { body, query, validationResult } = expressValidator as any;
import { asyncHandler } from '../utils/errors.js';
import { AssignmentService } from '../services/assignment.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import type { CreateAssignmentRequest, UpdateAssignmentRequest } from '../models/assignment.js';

const router = Router();

// Validation middleware for query parameters
const validateGetAssignments = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('course_id').optional().isUUID().withMessage('Course ID must be a valid UUID'),
  query('type').optional().isIn(['CAPSTONE', 'EXERCISE', 'MID_SEM', 'FINAL_EXAM']).withMessage('Type must be CAPSTONE, EXERCISE, MID_SEM, or FINAL_EXAM'),
  query('status').optional().isIn(['draft', 'processing', 'ready_for_review', 'published', 'graded']).withMessage('Status must be draft, processing, ready_for_review, published, or graded'),
  query('time_status').optional().isIn(['ongoing', 'ended']).withMessage('Time status must be ongoing or ended'),
  query('deadline_before').optional().isISO8601().withMessage('Deadline before must be a valid ISO 8601 timestamp'),
  query('deadline_after').optional().isISO8601().withMessage('Deadline after must be a valid ISO 8601 timestamp'),
  query('search').optional().isString().withMessage('Search must be a string'),
];

/**
 * @swagger
 * /api/assignments:
 *   get:
 *     summary: Get all assignments for the current lecturer
 *     description: |
 *       Fetch all assignments owned by the logged-in lecturer with filtering and pagination.
 *       
 *       **Filters:**
 *       - `course_id`: Filter by course UUID
 *       - `type`: Filter by assignment type (CAPSTONE, EXERCISE, MID_SEM, FINAL_EXAM)
 *       - `status`: Filter by assignment status (draft, processing, ready_for_review, published, graded)
 *       - `time_status`: Filter by time status (ongoing, ended)
 *       - `deadline_before`: Filter assignments with deadline before this date
 *       - `deadline_after`: Filter assignments with deadline after this date
 *       - `search`: Search in assignment title (case-insensitive)
 *       
 *       **Pagination:**
 *       - `page`: Page number (default: 1)
 *       - `limit`: Items per page (default: 20, max: 100)
 *     tags: [Assignments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Items per page
 *       - in: query
 *         name: course_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by course ID
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [CAPSTONE, EXERCISE, MID_SEM, FINAL_EXAM]
 *         description: Filter by assignment type
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, processing, ready_for_review, published, graded]
 *         description: Filter by assignment status
 *       - in: query
 *         name: time_status
 *         schema:
 *           type: string
 *           enum: [ongoing, ended]
 *         description: Filter by time status (ongoing = deadline not passed, ended = deadline passed or graded)
 *       - in: query
 *         name: deadline_before
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter assignments with deadline before this date
 *       - in: query
 *         name: deadline_after
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter assignments with deadline after this date
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in assignment title (case-insensitive)
 *     responses:
 *       200:
 *         description: Assignments retrieved successfully
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
 *                   example: "Assignments retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     assignments:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           title:
 *                             type: string
 *                           type:
 *                             type: string
 *                             enum: [CAPSTONE, EXERCISE, MID_SEM, FINAL_EXAM]
 *                           course_name:
 *                             type: string
 *                           course_id:
 *                             type: string
 *                             format: uuid
 *                           deadline:
 *                             type: string
 *                             format: date-time
 *                             nullable: true
 *                           status:
 *                             type: string
 *                             enum: [draft, processing, ready_for_review, published, graded]
 *                           time_status:
 *                             type: string
 *                             enum: [ongoing, ended]
 *                           created_at:
 *                             type: string
 *                             format: date-time
 *                           updated_at:
 *                             type: string
 *                             format: date-time
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         total_pages:
 *                           type: integer
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Lecturer profile not found
 */
router.get('/',
  authenticateToken,
  requireRole(['lecturer']),
  validateGetAssignments,
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

    const userId = req.user!.id;
    const page = parseInt(req.query['page'] as string) || 1;
    const limit = parseInt(req.query['limit'] as string) || 20;

    // Build filters object, only including defined values
    const filters: {
      course_id?: string;
      type?: 'CAPSTONE' | 'EXERCISE' | 'MID_SEM' | 'FINAL_EXAM';
      status?: 'draft' | 'processing' | 'ready_for_review' | 'published' | 'graded';
      time_status?: 'ongoing' | 'ended';
      deadline_before?: string;
      deadline_after?: string;
      search?: string;
    } = {};

    if (req.query['course_id']) {
      filters.course_id = req.query['course_id'] as string;
    }
    if (req.query['type']) {
      filters.type = req.query['type'] as 'CAPSTONE' | 'EXERCISE' | 'MID_SEM' | 'FINAL_EXAM';
    }
    if (req.query['status']) {
      filters.status = req.query['status'] as 'draft' | 'processing' | 'ready_for_review' | 'published' | 'graded';
    }
    if (req.query['time_status']) {
      filters.time_status = req.query['time_status'] as 'ongoing' | 'ended';
    }
    if (req.query['deadline_before']) {
      filters.deadline_before = req.query['deadline_before'] as string;
    }
    if (req.query['deadline_after']) {
      filters.deadline_after = req.query['deadline_after'] as string;
    }
    if (req.query['search']) {
      filters.search = req.query['search'] as string;
    }

    const result = await AssignmentService.getLecturerAssignments(userId, filters, { page, limit });
    res.status(200).json(result);
  })
);

/**
 * @swagger
 * /api/assignments/student:
 *   get:
 *     summary: Get all assignments for the current student (based on enrolled courses)
 *     description: |
 *       Fetch all published/graded assignments from courses the student is enrolled in.
 *       Includes filtering and pagination.
 *       
 *       **Filters:**
 *       - `course_id`: Filter by course UUID
 *       - `type`: Filter by assignment type (CAPSTONE, EXERCISE, MID_SEM, FINAL_EXAM)
 *       - `time_status`: Filter by time status (not_started, started, ended)
 *       - `deadline_before`: Filter assignments with deadline before this date
 *       - `deadline_after`: Filter assignments with deadline after this date
 *       - `search`: Search in assignment title (case-insensitive)
 *       - `has_session`: Filter by whether student has a session (true/false)
 *       
 *       **Pagination:**
 *       - `page`: Page number (default: 1)
 *       - `limit`: Items per page (default: 20, max: 100)
 *     tags: [Assignments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Items per page
 *       - in: query
 *         name: course_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by course ID
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [CAPSTONE, EXERCISE, MID_SEM, FINAL_EXAM]
 *         description: Filter by assignment type
 *       - in: query
 *         name: time_status
 *         schema:
 *           type: string
 *           enum: [not_started, started, ended]
 *         description: Filter by time status
 *       - in: query
 *         name: deadline_before
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter assignments with deadline before this date
 *       - in: query
 *         name: deadline_after
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter assignments with deadline after this date
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in assignment title (case-insensitive)
 *       - in: query
 *         name: has_session
 *         schema:
 *           type: boolean
 *         description: Filter by whether student has a session
 *     responses:
 *       200:
 *         description: Assignments retrieved successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Student profile not found
 */
router.get('/student',
  authenticateToken,
  requireRole(['student']),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const page = parseInt(req.query['page'] as string) || 1;
    const limit = parseInt(req.query['limit'] as string) || 20;

    // Build filters object, only including defined values
    const filters: {
      course_id?: string;
      type?: 'CAPSTONE' | 'EXERCISE' | 'MID_SEM' | 'FINAL_EXAM';
      time_status?: 'not_started' | 'started' | 'ended';
      deadline_before?: string;
      deadline_after?: string;
      search?: string;
      has_session?: boolean;
    } = {};

    if (req.query['course_id']) {
      filters.course_id = req.query['course_id'] as string;
    }
    if (req.query['type']) {
      filters.type = req.query['type'] as 'CAPSTONE' | 'EXERCISE' | 'MID_SEM' | 'FINAL_EXAM';
    }
    if (req.query['time_status']) {
      filters.time_status = req.query['time_status'] as 'not_started' | 'started' | 'ended';
    }
    if (req.query['deadline_before']) {
      filters.deadline_before = req.query['deadline_before'] as string;
    }
    if (req.query['deadline_after']) {
      filters.deadline_after = req.query['deadline_after'] as string;
    }
    if (req.query['search']) {
      filters.search = req.query['search'] as string;
    }
    if (req.query['has_session'] !== undefined) {
      filters.has_session = req.query['has_session'] === 'true';
    }

    const result = await AssignmentService.getStudentAssignments(userId, filters, { page, limit });
    res.status(200).json(result);
  })
);

/**
 * @swagger
 * /api/assignments/{assignmentId}/student:
 *   get:
 *     summary: Get assignment details for the current student (includes timing status and session id)
 *     description: |
 *       Fetch assignment information for a student before starting the assignment.
 *       Returns assignment details including timing status and existing session ID if the student has started.
 *     tags: [Assignments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: assignmentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Assignment details for student
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     assignment_id:
 *                       type: string
 *                       format: uuid
 *                     title:
 *                       type: string
 *                     course_title:
 *                       type: string
 *                     time_status:
 *                       type: string
 *                       enum: [not_started, started, ended]
 *                     start_time:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *                     duration_minutes:
 *                       type: integer
 *                       nullable: true
 *                     session_id:
 *                       type: string
 *                       format: uuid
 *                       nullable: true
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not enrolled or assignment not published
 *       404:
 *         description: Assignment or student profile not found
 */
router.get('/:assignmentId/student',
  authenticateToken,
  requireRole(['student']),
  asyncHandler(async (req: Request, res: Response) => {
    const assignmentId = req.params['assignmentId'];
    if (!assignmentId) {
      res.status(400).json({ success: false, error: 'Assignment ID is required' });
      return;
    }
    const userId = req.user!.id;
    const result = await AssignmentService.getAssignmentForStudent(assignmentId, userId);
    res.status(200).json(result);
  })
);

/**
 * @swagger
 * /api/assignments/{assignmentId}:
 *   get:
 *     summary: Get detailed assignment information (lecturer only)
 *     description: |
 *       Fetch comprehensive assignment details. Response varies by assignment status:
 *       
 *       **Status: "processing"**
 *       - Returns minimal data: id, title, status, generated_types, total_types
 *       - Indicates assignment is still being processed
 *       
 *       **Status: "ready_for_review"**
 *       - Returns full assignment details including course info and resources
 *       - Statistics are not included (no submissions yet)
 *       
 *       **Status: "published" or "graded"**
 *       - Returns complete information including:
 *         - All assignment fields (title, description, type, status, etc.)
 *         - Course information
 *         - Resources (files, links, PDFs)
 *         - Full statistics (submissions, enrolled students, questions, scores)
 *         - Question breakdown by type
 *     tags: [Assignments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: assignmentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Assignment details retrieved successfully
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
 *                   example: "Assignment details retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     title:
 *                       type: string
 *                     description:
 *                       type: string
 *                       nullable: true
 *                     type:
 *                       type: string
 *                       enum: [CAPSTONE, EXERCISE, MID_SEM, FINAL_EXAM]
 *                     status:
 *                       type: string
 *                       enum: [draft, processing, ready_for_review, published, graded]
 *                     ai_allowed:
 *                       type: boolean
 *                     course_id:
 *                       type: string
 *                       format: uuid
 *                     course_name:
 *                       type: string
 *                     course_description:
 *                       type: string
 *                       nullable: true
 *                     start_time:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *                     duration_minutes:
 *                       type: integer
 *                       nullable: true
 *                     deadline:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *                     time_status:
 *                       type: string
 *                       enum: [ongoing, ended]
 *                     total_types:
 *                       type: integer
 *                     generated_types:
 *                       type: integer
 *                     resources:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/AssignmentResource'
 *                     statistics:
 *                       type: object
 *                       properties:
 *                         total_enrolled_students:
 *                           type: integer
 *                           example: 45
 *                         total_submissions:
 *                           type: integer
 *                           example: 32
 *                         total_in_progress:
 *                           type: integer
 *                           example: 8
 *                         total_expired:
 *                           type: integer
 *                           example: 2
 *                         total_sessions:
 *                           type: integer
 *                           example: 42
 *                         submission_rate:
 *                           type: integer
 *                           example: 71
 *                           description: "Percentage of enrolled students who submitted"
 *                         total_questions:
 *                           type: integer
 *                           example: 20
 *                         average_score:
 *                           type: number
 *                           nullable: true
 *                           example: 85.5
 *                         questions_by_type:
 *                           type: object
 *                           properties:
 *                             MCQ:
 *                               type: integer
 *                               example: 10
 *                             FILLIN:
 *                               type: integer
 *                               example: 5
 *                             ESSAY:
 *                               type: integer
 *                               example: 3
 *                             CODE:
 *                               type: integer
 *                               example: 2
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not assignment owner
 *       404:
 *         description: Assignment or lecturer profile not found
 */
router.get('/:assignmentId',
  authenticateToken,
  requireRole(['lecturer']),
  asyncHandler(async (req: Request, res: Response) => {
    const assignmentId = req.params['assignmentId'];
    if (!assignmentId) {
      res.status(400).json({ success: false, error: 'Assignment ID is required' });
      return;
    }
    const userId = req.user!.id;
    const result = await AssignmentService.getAssignmentDetails(assignmentId, userId);
    res.status(200).json(result);
  })
);

/**
 * @swagger
 * /api/assignments/{assignmentId}/submissions:
 *   get:
 *     summary: Get all submissions for an assignment (lecturer only)
 *     description: |
 *       Fetch all student submissions (sessions) for a specific assignment.
 *       Includes student information (name, email) and submission details.
 *     tags: [Assignments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: assignmentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Submissions retrieved successfully
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
 *                   example: "Submissions retrieved successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                         description: "Session ID"
 *                       student_id:
 *                         type: string
 *                         format: uuid
 *                       student_name:
 *                         type: string
 *                         example: "John Doe"
 *                       student_email:
 *                         type: string
 *                         example: "john.doe@example.com"
 *                       started_at:
 *                         type: string
 *                         format: date-time
 *                       submitted_at:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                       status:
 *                         type: string
 *                         enum: [in_progress, submitted, expired]
 *                       score:
 *                         type: number
 *                         nullable: true
 *                       time_used_seconds:
 *                         type: integer
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not assignment owner
 *       404:
 *         description: Assignment or lecturer profile not found
 */
router.get('/:assignmentId/submissions',
  authenticateToken,
  requireRole(['lecturer']),
  asyncHandler(async (req: Request, res: Response) => {
    const assignmentId = req.params['assignmentId'];
    if (!assignmentId) {
      res.status(400).json({ success: false, error: 'Assignment ID is required' });
      return;
    }
    const userId = req.user!.id;
    const result = await AssignmentService.getAssignmentSubmissions(assignmentId, userId);
    res.status(200).json(result);
  })
);

/**
 * @swagger
 * /api/assignments/{assignmentId}/questions:
 *   get:
 *     summary: Get all questions for an assignment (lecturer only)
 *     description: |
 *       Fetch all questions for a specific assignment.
 *       Questions are grouped into two categories:
 *       - `code_programs`: CODE type questions (from code_programs)
 *       - `non_code`: MCQ, FILLIN, and ESSAY type questions (from question_types)
 *       Questions within each group are returned in order by order_index.
 *     tags: [Assignments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: assignmentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Questions retrieved successfully
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
 *                   example: "Questions retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     code_programs:
 *                       type: array
 *                       description: CODE type questions (from code_programs)
 *                       items:
 *                         $ref: '#/components/schemas/Question'
 *                     non_code:
 *                       type: array
 *                       description: MCQ, FILLIN, and ESSAY type questions (from question_types)
 *                       items:
 *                         $ref: '#/components/schemas/Question'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not assignment owner
 *       404:
 *         description: Assignment or lecturer profile not found
 */
router.get('/:assignmentId/questions',
  authenticateToken,
  requireRole(['lecturer']),
  asyncHandler(async (req: Request, res: Response) => {
    const assignmentId = req.params['assignmentId'];
    if (!assignmentId) {
      res.status(400).json({ success: false, error: 'Assignment ID is required' });
      return;
    }
    const userId = req.user!.id;
    const result = await AssignmentService.getAssignmentQuestions(assignmentId, userId);
    res.status(200).json(result);
  })
);

/**
 * @swagger
 * /api/assignments/{assignmentId}/student:
 *   get:
 *     summary: Get assignment details for the current student (includes timing status and session id)
 *     tags: [Assignments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: assignmentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Assignment details for student
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     assignment_id:
 *                       type: string
 *                       format: uuid
 *                     title:
 *                       type: string
 *                     course_title:
 *                       type: string
 *                     time_status:
 *                       type: string
 *                       enum: [not_started, started, ended]
 *                     start_time:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *                     duration_minutes:
 *                       type: integer
 *                       nullable: true
 *                     session_id:
 *                       type: string
 *                       format: uuid
 *                       nullable: true
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not enrolled or assignment not published
 *       404:
 *         description: Assignment or student profile not found
 */
/**
 * @swagger
 * /api/assignments/student:
 *   get:
 *     summary: Get all assignments for the current student (based on enrolled courses)
 *     description: |
 *       Fetch all published/graded assignments from courses the student is enrolled in.
 *       Includes filtering and pagination.
 *       
 *       **Filters:**
 *       - `course_id`: Filter by course UUID
 *       - `type`: Filter by assignment type (CAPSTONE, EXERCISE, MID_SEM, FINAL_EXAM)
 *       - `time_status`: Filter by time status (not_started, started, ended)
 *       - `deadline_before`: Filter assignments with deadline before this date
 *       - `deadline_after`: Filter assignments with deadline after this date
 *       - `search`: Search in assignment title (case-insensitive)
 *       - `has_session`: Filter by whether student has a session (true/false)
 *       
 *       **Pagination:**
 *       - `page`: Page number (default: 1)
 *       - `limit`: Items per page (default: 20, max: 100)
 *     tags: [Assignments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Items per page
 *       - in: query
 *         name: course_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by course ID
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [CAPSTONE, EXERCISE, MID_SEM, FINAL_EXAM]
 *         description: Filter by assignment type
 *       - in: query
 *         name: time_status
 *         schema:
 *           type: string
 *           enum: [not_started, started, ended]
 *         description: Filter by time status
 *       - in: query
 *         name: deadline_before
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter assignments with deadline before this date
 *       - in: query
 *         name: deadline_after
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter assignments with deadline after this date
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in assignment title (case-insensitive)
 *       - in: query
 *         name: has_session
 *         schema:
 *           type: boolean
 *         description: Filter by whether student has a session
 *     responses:
 *       200:
 *         description: Assignments retrieved successfully
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/assignments/{assignmentId}/student/details:
 *   get:
 *     summary: Get detailed assignment view for student (for taking exam)
 *     description: |
 *       Fetch comprehensive assignment details for students when they're taking the exam.
 *       Includes:
 *       - All assignment information (title, description, type, timing, etc.)
 *       - Questions grouped into code_programs and non_code
 *       - Learning resources (files, links, PDFs)
 *       - Session information (if student has started)
 *       - Time tracking information
 *       
 *       **Requirements:**
 *       - Student must be enrolled in the course
 *       - Assignment must be published or graded
 *       - This endpoint is designed for when student has a session and is taking the exam
 *     tags: [Assignments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: assignmentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Assignment details retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not enrolled or assignment not published
 *       404:
 *         description: Assignment or student profile not found
 */
router.get('/:assignmentId/student/details',
  authenticateToken,
  requireRole(['student']),
  asyncHandler(async (req: Request, res: Response) => {
    const assignmentId = req.params['assignmentId'];
    if (!assignmentId) {
      res.status(400).json({ success: false, error: 'Assignment ID is required' });
      return;
    }
    const userId = req.user!.id;
    const result = await AssignmentService.getStudentAssignmentDetails(assignmentId, userId);
    res.status(200).json(result);
  })
);

/**
 * @swagger
 * /api/assignments/session/{sessionId}/details:
 *   get:
 *     summary: Get detailed assignment view for student using session ID (for taking exam)
 *     description: |
 *       Fetch comprehensive assignment details for students when they're actively taking the exam.
 *       Uses session ID to identify the assignment and validates:
 *       - Session belongs to the student
 *       - Session is active (not submitted or expired)
 *       - Assignment deadline has not passed
 *       - Assignment is published or graded
 *       
 *       **Returns:**
 *       - All assignment information (title, description, type, timing, etc.)
 *       - Questions grouped into code_programs and non_code
 *       - Learning resources (files, links, PDFs)
 *       - Session information (status, time used)
 *       - Time tracking information
 *       - Student's submitted answers (user_answers) for this session, if any exist
 *       
 *       **Use Case:**
 *       This endpoint is designed for when a student is actively taking an exam.
 *       The student already has a session, so they use the sessionId to get all exam details.
 *       The user_answers array contains all answers the student has submitted for questions in this session.
 *     tags: [Assignments]
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
 *         description: Assignment details retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Session not accessible, deadline passed, or session submitted/expired
 *       404:
 *         description: Session or assignment not found
 */
router.get('/session/:sessionId/details',
  authenticateToken,
  requireRole(['student']),
  asyncHandler(async (req: Request, res: Response) => {
    const sessionId = req.params['sessionId'];
    if (!sessionId) {
      res.status(400).json({ success: false, error: 'Session ID is required' });
      return;
    }
    const userId = req.user!.id;
    const result = await AssignmentService.getStudentAssignmentDetailsBySession(sessionId, userId);
    res.status(200).json(result);
  })
);

// Validation middleware for updating assignment
// Validates any assignment field that can be updated
const validateUpdateAssignment = [
  body('title').optional().isLength({ min: 3, max: 255 }).withMessage('Title must be 3-255 characters'),
  body('description').optional().isString().withMessage('Description must be a string'),
  body('type').optional().isIn(['CAPSTONE', 'EXERCISE', 'MID_SEM', 'FINAL_EXAM']).withMessage('Type must be CAPSTONE, EXERCISE, MID_SEM, or FINAL_EXAM'),
  body('start_time').optional().custom((value: string | null | undefined) => {
    if (value === null || value === undefined) {
      return true;
    }
    if (typeof value !== 'string') {
      throw new Error('Start time must be an ISO 8601 timestamp or null');
    }
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
      throw new Error('Start time must be a valid ISO 8601 timestamp or null');
    }
    return true;
  }),
  body('deadline').optional().custom((value: string | null | undefined) => {
    if (value === null || value === undefined) {
      return true;
    }
    if (typeof value !== 'string') {
      throw new Error('Deadline must be an ISO 8601 timestamp or null');
    }
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
      throw new Error('Deadline must be a valid ISO 8601 timestamp or null');
    }
    return true;
  }),
  body('duration').optional().custom((value: number | null | undefined) => {
    if (value === null || value === undefined) {
      return true;
    }
    if (!Number.isInteger(value) || value < 1) {
      throw new Error('Duration must be a positive integer (minutes) or null');
    }
    return true;
  }),
  body('duration_minutes').optional().custom((value: number | null | undefined) => {
    if (value === null || value === undefined) {
      return true;
    }
    if (!Number.isInteger(value) || value < 1) {
      throw new Error('Duration must be a positive integer (minutes) or null');
    }
    return true;
  }),
  body('status').optional().isIn(['draft', 'processing', 'ready_for_review', 'published', 'graded']).withMessage('Status must be draft, processing, ready_for_review, published, or graded'),
  body('is_ai_allowed').optional().isBoolean().withMessage('is_ai_allowed must be a boolean'),
  body('ai_allowed').optional().isBoolean().withMessage('ai_allowed must be a boolean'),
];

// Validation middleware
const validateCreateAssignment = [
  body('type').optional().isIn(['CAPSTONE', 'EXERCISE', 'MID_SEM', 'FINAL_EXAM']).withMessage('Type must be CAPSTONE, EXERCISE, MID_SEM, or FINAL_EXAM'),
  body('title').isLength({ min: 3, max: 255 }).withMessage('Title must be 3-255 characters'),
  body('description').optional().isString().withMessage('Description must be a string'),
  body('start_time').optional().isISO8601().withMessage('Start time must be a valid ISO 8601 timestamp'),
  body('deadline').optional().custom((value: string | null | undefined) => {
    if (value === null || value === undefined) {
      return true;
    }
    if (typeof value !== 'string') {
      throw new Error('Deadline must be an ISO 8601 timestamp or null');
    }
    // Basic ISO8601 check via Date parsing
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
      throw new Error('Deadline must be a valid ISO 8601 timestamp or null');
    }
    return true;
  }),
  body('duration').optional().custom((value: number | null | undefined) => {
    if (value === null || value === undefined) {
      return true; // null/undefined is allowed
    }
    if (!Number.isInteger(value) || value < 1) {
      throw new Error('Duration must be a positive integer (minutes) or null');
    }
    return true;
  }),
  body('course_id').isUUID().withMessage('Course ID must be a valid UUID'),
  body('is_ai_allowed').optional().isBoolean().withMessage('is_ai_allowed must be a boolean'),
  body('resources').optional().isArray().withMessage('Resources must be an array'),
  body('resources.*.type').optional().isIn(['pdf', 'file', 'link']).withMessage('Resource type must be pdf, file, or link'),
  body('resources.*.url').optional().isURL().withMessage('Resource URL must be a valid URL'),
];

/**
 * @swagger
 * components:
 *   schemas:
 *     Assignment:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           example: "550e8400-e29b-41d4-a716-446655440000"
 *         course_id:
 *           type: string
 *           format: uuid
 *           example: "660e8400-e29b-41d4-a716-446655440001"
 *         lecturer_id:
 *           type: string
 *           format: uuid
 *           example: "770e8400-e29b-41d4-a716-446655440002"
 *         type:
 *           type: string
 *           enum: [CAPSTONE, EXERCISE, MID_SEM, FINAL_EXAM]
 *           example: "EXERCISE"
 *           description: "Assignment type/category"
 *         title:
 *           type: string
 *           example: "Machine Learning Fundamentals Assignment"
 *         description:
 *           type: string
 *           nullable: true
 *           example: "Complete exercises on regression and classification"
 *         start_time:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           example: "2024-01-15T10:00:00Z"
 *         duration_minutes:
 *           type: integer
 *           nullable: true
 *           example: 120
 *           description: "Duration in minutes (null = unbounded)"
 *         deadline:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           example: "2024-01-15T12:00:00Z"
 *           description: "Hard deadline; assignment is ended only after this passes (nullable)"
 *         ai_allowed:
 *           type: boolean
 *           example: false
 *         status:
 *           type: string
 *           enum: [draft, processing, ready_for_review, published, graded]
 *           example: "draft"
 *         total_types:
 *           type: integer
 *           example: 3
 *           description: "Total number of question types (question_types + code_programs)"
 *         generated_types:
 *           type: integer
 *           example: 0
 *           description: "Number of question types that have been generated"
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *     AssignmentResource:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           example: "880e8400-e29b-41d4-a716-446655440003"
 *         assignment_id:
 *           type: string
 *           format: uuid
 *           example: "550e8400-e29b-41d4-a716-446655440000"
 *         resource_type:
 *           type: string
 *           enum: [pdf, file, link]
 *           example: "pdf"
 *         url:
 *           type: string
 *           format: uri
 *           example: "https://example.com/resource.pdf"
 *         description:
 *           type: string
 *           nullable: true
 *           example: "Course textbook chapter 5"
 *         created_at:
 *           type: string
 *           format: date-time
 *     Question:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           example: "990e8400-e29b-41d4-a716-446655440004"
 *         assignment_id:
 *           type: string
 *           format: uuid
 *           example: "550e8400-e29b-41d4-a716-446655440000"
 *         type:
 *           type: string
 *           enum: [MCQ, FILLIN, ESSAY, CODE]
 *           example: "MCQ"
 *         prompt_markdown:
 *           type: string
 *           example: "What is the time complexity of binary search?"
 *         content_json:
 *           type: object
 *           nullable: true
 *           description: "Structured data (MCQ options, code metadata)"
 *         points:
 *           type: integer
 *           example: 5
 *         order_index:
 *           type: integer
 *           example: 1
 *         created_at:
 *           type: string
 *           format: date-time
 *     StudentAssignmentSession:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           example: "aa0e8400-e29b-41d4-a716-446655440005"
 *         student_id:
 *           type: string
 *           format: uuid
 *           example: "bb0e8400-e29b-41d4-a716-446655440006"
 *         assignment_id:
 *           type: string
 *           format: uuid
 *           example: "550e8400-e29b-41d4-a716-446655440000"
 *         started_at:
 *           type: string
 *           format: date-time
 *         last_resumed_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: "If null, the session is currently paused"
 *         time_used_seconds:
 *           type: integer
 *           example: 120
 *           description: "Accumulated active time used (seconds)"
 *         submitted_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         status:
 *           type: string
 *           enum: [in_progress, submitted, expired]
 *           example: "in_progress"
 *         score:
 *           type: number
 *           nullable: true
 *           example: 85.5
 *         created_at:
 *           type: string
 *           format: date-time
 *     StudentAnswer:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           example: "cc0e8400-e29b-41d4-a716-446655440007"
 *         session_id:
 *           type: string
 *           format: uuid
 *           example: "aa0e8400-e29b-41d4-a716-446655440005"
 *         question_id:
 *           type: string
 *           format: uuid
 *           example: "990e8400-e29b-41d4-a716-446655440004"
 *         answer_text:
 *           type: string
 *           nullable: true
 *           example: "O(log n)"
 *           description: "For FILLIN and ESSAY question types"
 *         selected_option:
 *           type: string
 *           nullable: true
 *           example: "A"
 *           description: "For MCQ question type"
 *         code_submission:
 *           type: string
 *           nullable: true
 *           example: "def binary_search(arr, target):\n    left, right = 0, len(arr) - 1\n    ..."
 *           description: "For CODE question type"
 *         language:
 *           type: string
 *           nullable: true
 *           example: "python"
 *           description: "Programming language for CODE question type"
 *         created_at:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/assignments:
 *   post:
 *     summary: Create a new assignment
 *     description: |
 *       Create a new assignment. Only lecturers can create assignments for their own courses.
 *       
 *       **Question Generation:**
 *       - If `total_questions` and `question_types` or `code_programs` are provided, a question generation job will be automatically sent to Azure Service Bus
 *       - `question_types` should be provided as percentages (e.g., {"MCQ": 50, "ESSAY": 30, "CODE": 20})
 *       - Percentages will be converted to actual question counts and ranges automatically
 *       - Each `code_programs` entry represents one code question
 *     tags: [Assignments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - course_id
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [CAPSTONE, EXERCISE, MID_SEM, FINAL_EXAM]
 *                 example: "EXERCISE"
 *                 description: "Assignment type/category (defaults to EXERCISE if omitted)"
 *               title:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 255
 *                 example: "Machine Learning Fundamentals Assignment"
 *               description:
 *                 type: string
 *                 example: "Complete exercises on regression and classification"
 *               start_time:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *                 example: "2024-01-15T10:00:00Z"
 *                 description: "When the assignment becomes available (null = available immediately)"
 *               duration:
 *                 type: integer
 *                 nullable: true
 *                 minimum: 1
 *                 example: 120
 *                 description: "Duration in minutes (null = unbounded). If deadline is not provided, assignment won't end by time unless graded."
 *               course_id:
 *                 type: string
 *                 format: uuid
 *                 example: "660e8400-e29b-41d4-a716-446655440001"
 *               is_ai_allowed:
 *                 type: boolean
 *                 example: false
 *                 description: "Whether students are allowed to use AI tools during the assignment"
 *               question_types:
 *                 type: object
 *                 additionalProperties:
 *                   type: number
 *                   minimum: 0
 *                   maximum: 100
 *                 example: {"MCQ": 50, "ESSAY": 30, "FILLIN": 20}
 *                 description: |
 *                   Question type percentages (must sum to 100 or less).
 *                   Valid types: MCQ, FILLIN, ESSAY, CODE.
 *                   Percentages will be converted to actual counts based on total_questions.
 *                   Sent to question generation service (not stored in database).
 *               code_programs:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - prompt
 *                     - language
 *                   properties:
 *                     prompt:
 *                       type: string
 *                       example: "Write a function to reverse a linked list"
 *                     language:
 *                       type: string
 *                       example: "python"
 *                 example:
 *                   - prompt: "Implement a binary search algorithm"
 *                     language: "python"
 *                   - prompt: "Create a REST API endpoint"
 *                     language: "javascript"
 *                 description: |
 *                   Array of code programming questions.
 *                   Each entry represents one code question.
 *                   Sent to question generation service (not stored in database).
 *               prompt:
 *                 type: string
 *                 example: "Generate questions based on the course materials provided"
 *                 description: "AI generation prompt for question generation service (not stored in database)"
 *               files:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - name
 *                     - url
 *                   properties:
 *                     name:
 *                       type: string
 *                       example: "course_materials.pdf"
 *                     url:
 *                       type: string
 *                       format: uri
 *                       example: "https://example.com/files/course_materials.pdf"
 *                 example:
 *                   - name: "lecture_notes.pdf"
 *                     url: "https://example.com/files/lecture_notes.pdf"
 *                   - name: "assignment_guidelines.docx"
 *                     url: "https://example.com/files/guidelines.docx"
 *                 description: "Reference files for question generation (not stored in database)"
 *               resources:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - type
 *                     - url
 *                   properties:
 *                     type:
 *                       type: string
 *                       enum: [pdf, file, link]
 *                       example: "pdf"
 *                     url:
 *                       type: string
 *                       format: uri
 *                       example: "https://example.com/resource.pdf"
 *                     description:
 *                       type: string
 *                       example: "Course textbook chapter 5"
 *                 example:
 *                   - type: "pdf"
 *                     url: "https://example.com/textbook.pdf"
 *                     description: "Required reading material"
 *                   - type: "link"
 *                     url: "https://example.com/tutorial"
 *                     description: "Helpful tutorial link"
 *                 description: "Student-facing assignment resources (stored in assignment_resources table)"
 *               total_questions:
 *                 type: integer
 *                 minimum: 1
 *                 example: 20
 *                 description: |
 *                   Total number of questions to generate.
 *                   Used to calculate actual counts from question_types percentages.
 *                   Sent to question generation service (not stored in database).
 *     responses:
 *       201:
 *         description: Assignment created successfully
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
 *                   example: "Assignment created successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Assignment'
 *       400:
 *         description: Validation error or creation failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Validation failed"
 *                 details:
 *                   type: array
 *                   items:
 *                     type: object
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions or course ownership mismatch
 *       404:
 *         description: Lecturer profile or course not found
 */
router.post('/',
  authenticateToken,
  requireRole(['lecturer']),
  validateCreateAssignment,
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

    const assignmentData: CreateAssignmentRequest = req.body;
    const userId = req.user!.id;

    const result = await AssignmentService.createAssignment(assignmentData, userId);
    res.status(201).json(result);
  })
);

/**
 * @swagger
 * /api/assignments/{assignmentId}:
 *   patch:
 *     summary: Update assignment (lecturer only)
 *     description: |
 *       Update assignment fields. Only the assignment owner (lecturer) can update.
 *       All fields are optional - only provided fields will be updated.
 *       
 *       **Status Updates:**
 *       - Can change status between: draft, processing, ready_for_review, published, graded
 *       - Use this to publish an assignment (ready_for_review → published) or mark as graded
 *     tags: [Assignments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: assignmentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: |
 *               Any assignment field can be updated (except immutable fields: id, created_at, lecturer_id, course_id, total_types, generated_types).
 *               All fields are optional - only provided fields will be updated.
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 255
 *                 example: "Updated Assignment Title"
 *               description:
 *                 type: string
 *                 example: "Updated description"
 *               type:
 *                 type: string
 *                 enum: [CAPSTONE, EXERCISE, MID_SEM, FINAL_EXAM]
 *                 example: "EXERCISE"
 *               start_time:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *                 example: "2024-01-15T10:00:00Z"
 *               duration:
 *                 type: integer
 *                 nullable: true
 *                 minimum: 1
 *                 example: 120
 *                 description: "Duration in minutes (maps to duration_minutes)"
 *               duration_minutes:
 *                 type: integer
 *                 nullable: true
 *                 minimum: 1
 *                 example: 120
 *                 description: "Duration in minutes (alternative to duration)"
 *               deadline:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *                 example: "2024-01-15T12:00:00Z"
 *               status:
 *                 type: string
 *                 enum: [draft, processing, ready_for_review, published, graded]
 *                 example: "published"
 *                 description: "Assignment status"
 *               is_ai_allowed:
 *                 type: boolean
 *                 example: false
 *                 description: "Maps to ai_allowed field"
 *               ai_allowed:
 *                 type: boolean
 *                 example: false
 *                 description: "Whether AI is allowed (alternative to is_ai_allowed)"
 *     responses:
 *       200:
 *         description: Assignment updated successfully
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
 *                   example: "Assignment updated successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Assignment'
 *       400:
 *         description: Validation error or update failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not assignment owner
 *       404:
 *         description: Assignment or lecturer profile not found
 */
router.patch('/:assignmentId',
  authenticateToken,
  requireRole(['lecturer']),
  validateUpdateAssignment,
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

    const assignmentId = req.params['assignmentId'];
    if (!assignmentId) {
      res.status(400).json({ success: false, error: 'Assignment ID is required' });
      return;
    }

    const updateData: UpdateAssignmentRequest = req.body;
    const userId = req.user!.id;

    const result = await AssignmentService.updateAssignment(assignmentId, updateData, userId);
    res.status(200).json(result);
  })
);

export default router;
