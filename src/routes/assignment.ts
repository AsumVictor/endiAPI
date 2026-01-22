// Assignment routes
import { Router } from 'express';
import type { Request, Response } from 'express';
import expressValidator from 'express-validator';
const { body, validationResult } = expressValidator as any;
import { asyncHandler } from '../utils/errors.js';
import { AssignmentService } from '../services/assignment.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import type { CreateAssignmentRequest } from '../models/assignment.js';

const router = Router();

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

// Validation middleware
const validateCreateAssignment = [
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
  requireRole(['lecturer', 'admin']),
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

export default router;
