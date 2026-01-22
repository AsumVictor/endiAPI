// Student Answer routes
import { Router } from 'express';
import type { Request, Response } from 'express';
import expressValidator from 'express-validator';
const { body, validationResult } = expressValidator as any;
import { asyncHandler } from '../utils/errors.js';
import { StudentAnswerService } from '../services/student-answer.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import type { CreateAnswerRequest, UpdateAnswerRequest } from '../models/assignment.js';

const router = Router();

// Validation middleware
const validateCreateAnswer = [
  body('session_id').isUUID().withMessage('Session ID must be a valid UUID'),
  body('question_id').isUUID().withMessage('Question ID must be a valid UUID'),
  body('answer_text').optional().isString().withMessage('Answer text must be a string'),
  body('selected_option').optional().isString().withMessage('Selected option must be a string'),
  body('code_submission').optional().isString().withMessage('Code submission must be a string'),
  body('language').optional().isString().withMessage('Language must be a string'),
];

const validateUpdateAnswer = [
  body('answer_text').optional().isString().withMessage('Answer text must be a string'),
  body('selected_option').optional().isString().withMessage('Selected option must be a string'),
  body('code_submission').optional().isString().withMessage('Code submission must be a string'),
  body('language').optional().isString().withMessage('Language must be a string'),
];

/**
 * @swagger
 * /api/student-answers:
 *   post:
 *     summary: Create a new answer
 *     description: |
 *       Students can create an answer for a question in their session.
 *       
 *       **Validation:**
 *       - Session must belong to the student
 *       - Session must not be submitted
 *       - Assignment must have started and deadline must not have passed (if deadline is set)
 *       - Only one answer per question per session is allowed
 *       
 *       **Answer Fields:**
 *       - `answer_text`: For FILLIN and ESSAY question types
 *       - `selected_option`: For MCQ question type (e.g., "A", "B", "C")
 *       - `code_submission` + `language`: For CODE question type
 *     tags: [Student Answers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - session_id
 *               - question_id
 *             properties:
 *               session_id:
 *                 type: string
 *                 format: uuid
 *                 example: "aa0e8400-e29b-41d4-a716-446655440005"
 *               question_id:
 *                 type: string
 *                 format: uuid
 *                 example: "990e8400-e29b-41d4-a716-446655440004"
 *               answer_text:
 *                 type: string
 *                 nullable: true
 *                 example: "O(log n)"
 *                 description: "For FILLIN and ESSAY question types"
 *               selected_option:
 *                 type: string
 *                 nullable: true
 *                 example: "B"
 *                 description: "For MCQ question type (option letter/identifier)"
 *               code_submission:
 *                 type: string
 *                 nullable: true
 *                 example: "def binary_search(arr, target):\n    left, right = 0, len(arr) - 1\n    while left <= right:\n        mid = (left + right) // 2\n        if arr[mid] == target:\n            return mid\n        elif arr[mid] < target:\n            left = mid + 1\n        else:\n            right = mid - 1\n    return -1"
 *                 description: "For CODE question type"
 *               language:
 *                 type: string
 *                 nullable: true
 *                 example: "python"
 *                 description: "Programming language for CODE question type"
 *     responses:
 *       201:
 *         description: Answer created successfully
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
 *                   example: "Answer created successfully"
 *                 data:
 *                   $ref: '#/components/schemas/StudentAnswer'
 *       400:
 *         description: Validation error or creation failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not session owner, session submitted, or assignment timing invalid
 *       404:
 *         description: Session or question not found
 *       409:
 *         description: Answer already exists for this question
 */
router.post('/',
  authenticateToken,
  requireRole(['student', 'admin']),
  validateCreateAnswer,
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

    const answerData: CreateAnswerRequest = req.body;
    const userId = req.user!.id;

    const result = await StudentAnswerService.createAnswer(answerData, userId);
    res.status(201).json(result);
  })
);

/**
 * @swagger
 * /api/student-answers/session/{sessionId}:
 *   get:
 *     summary: Get all answers for a session
 *     description: Get all answers for a specific session. Students can view their own answers, lecturers can view answers for their assignments
 *     tags: [Student Answers]
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
 *         description: Answers retrieved successfully
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
 *                   example: "Answers retrieved successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/StudentAnswer'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not session owner or assignment owner
 *       404:
 *         description: Session not found
 */
router.get('/session/:sessionId',
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

    const result = await StudentAnswerService.getAnswersBySession(sessionId, userId, isLecturer);
    res.status(200).json(result);
  })
);

/**
 * @swagger
 * /api/student-answers/{answerId}:
 *   get:
 *     summary: Get answer by ID
 *     description: Get a specific answer by ID. Students can view their own answers, lecturers can view answers for their assignments
 *     tags: [Student Answers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: answerId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         example: "cc0e8400-e29b-41d4-a716-446655440007"
 *     responses:
 *       200:
 *         description: Answer retrieved successfully
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
 *                   example: "Answer retrieved successfully"
 *                 data:
 *                   $ref: '#/components/schemas/StudentAnswer'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not session owner or assignment owner
 *       404:
 *         description: Answer not found
 */
router.get('/:answerId',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const { answerId } = req.params;
    if (!answerId || typeof answerId !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Answer ID is required',
      });
      return;
    }

    const userId = req.user!.id;
    const isLecturer = req.user!.role === 'lecturer' || req.user!.role === 'admin';

    const result = await StudentAnswerService.getAnswerById(answerId, userId, isLecturer);
    res.status(200).json(result);
  })
);

/**
 * @swagger
 * /api/student-answers/{answerId}:
 *   put:
 *     summary: Update answer
 *     description: |
 *       Students can update their own answers (before session is submitted).
 *       
 *       **Validation:**
 *       - Answer must belong to student's session
 *       - Session must not be submitted
 *       - Assignment must have started and deadline must not have passed (if deadline is set)
 *     tags: [Student Answers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: answerId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         example: "cc0e8400-e29b-41d4-a716-446655440007"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               answer_text:
 *                 type: string
 *                 nullable: true
 *                 example: "O(n log n)"
 *                 description: "For FILLIN and ESSAY question types"
 *               selected_option:
 *                 type: string
 *                 nullable: true
 *                 example: "C"
 *                 description: "For MCQ question type"
 *               code_submission:
 *                 type: string
 *                 nullable: true
 *                 example: "def merge_sort(arr):\n    if len(arr) <= 1:\n        return arr\n    ..."
 *                 description: "For CODE question type"
 *               language:
 *                 type: string
 *                 nullable: true
 *                 example: "python"
 *                 description: "Programming language for CODE question type"
 *     responses:
 *       200:
 *         description: Answer updated successfully
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
 *                   example: "Answer updated successfully"
 *                 data:
 *                   $ref: '#/components/schemas/StudentAnswer'
 *       400:
 *         description: Validation error or update failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not answer owner, session submitted, or assignment timing invalid
 *       404:
 *         description: Answer not found
 */
router.put('/:answerId',
  authenticateToken,
  requireRole(['student', 'admin']),
  validateUpdateAnswer,
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

    const { answerId } = req.params;
    if (!answerId || typeof answerId !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Answer ID is required',
      });
      return;
    }

    const updateData: UpdateAnswerRequest = req.body;
    const userId = req.user!.id;

    const result = await StudentAnswerService.updateAnswer(answerId, updateData, userId);
    res.status(200).json(result);
  })
);

/**
 * @swagger
 * /api/student-answers/{answerId}:
 *   delete:
 *     summary: Delete answer
 *     description: |
 *       Students can delete their own answers (before session is submitted).
 *       
 *       **Validation:**
 *       - Answer must belong to student's session
 *       - Session must not be submitted
 *       - Assignment must have started and deadline must not have passed (if deadline is set)
 *     tags: [Student Answers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: answerId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         example: "cc0e8400-e29b-41d4-a716-446655440007"
 *     responses:
 *       200:
 *         description: Answer deleted successfully
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
 *                   example: "Answer deleted successfully"
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not answer owner, session submitted, or assignment timing invalid
 *       404:
 *         description: Answer not found
 */
router.delete('/:answerId',
  authenticateToken,
  requireRole(['student', 'admin']),
  asyncHandler(async (req: Request, res: Response) => {
    const { answerId } = req.params;
    if (!answerId || typeof answerId !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Answer ID is required',
      });
      return;
    }

    const userId = req.user!.id;

    const result = await StudentAnswerService.deleteAnswer(answerId, userId);
    res.status(200).json(result);
  })
);

export default router;
