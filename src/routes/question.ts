// Question routes
import { Router } from 'express';
import type { Request, Response } from 'express';
import expressValidator from 'express-validator';
const { body, validationResult } = expressValidator as any;
import { asyncHandler } from '../utils/errors.js';
import { QuestionService } from '../services/question.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import type { CreateQuestionRequest, UpdateQuestionRequest } from '../models/assignment.js';

const router = Router();

// Validation middleware
const validateCreateQuestion = [
  body('assignment_id').isUUID().withMessage('Assignment ID must be a valid UUID'),
  body('type').isIn(['MCQ', 'FILLIN', 'ESSAY', 'CODE']).withMessage('Type must be MCQ, FILLIN, ESSAY, or CODE'),
  body('prompt_markdown').notEmpty().withMessage('Prompt markdown is required'),
  body('content_json').optional(),
  body('points').optional().isInt({ min: 1 }).withMessage('Points must be a positive integer'),
  body('order_index').isInt({ min: 0 }).withMessage('Order index must be a non-negative integer'),
];

const validateUpdateQuestion = [
  body('type').optional().isIn(['MCQ', 'FILLIN', 'ESSAY', 'CODE']).withMessage('Type must be MCQ, FILLIN, ESSAY, or CODE'),
  body('prompt_markdown').optional().notEmpty().withMessage('Prompt markdown cannot be empty'),
  body('content_json').optional(),
  body('points').optional().isInt({ min: 1 }).withMessage('Points must be a positive integer'),
  body('order_index').optional().isInt({ min: 0 }).withMessage('Order index must be a non-negative integer'),
];

/**
 * @swagger
 * /api/questions:
 *   post:
 *     summary: Create a new question
 *     description: Create a new question for an assignment. Only lecturers can create questions for their own assignments.
 *     tags: [Questions]
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
 *               - type
 *               - prompt_markdown
 *               - order_index
 *             properties:
 *               assignment_id:
 *                 type: string
 *                 format: uuid
 *                 example: "550e8400-e29b-41d4-a716-446655440000"
 *               type:
 *                 type: string
 *                 enum: [MCQ, FILLIN, ESSAY, CODE]
 *                 example: "MCQ"
 *                 description: "Question type"
 *               prompt_markdown:
 *                 type: string
 *                 example: "What is the time complexity of binary search?"
 *                 description: "Question prompt in markdown format"
 *               content_json:
 *                 type: object
 *                 nullable: true
 *                 example:
 *                   options: ["O(1)", "O(log n)", "O(n)", "O(n log n)"]
 *                   correct_answer: "O(log n)"
 *                 description: "Structured data (MCQ options, code metadata)"
 *               points:
 *                 type: integer
 *                 minimum: 1
 *                 default: 1
 *                 example: 5
 *                 description: "Points awarded for correct answer"
 *               order_index:
 *                 type: integer
 *                 minimum: 0
 *                 example: 1
 *                 description: "Order of question in assignment (0-based)"
 *     responses:
 *       201:
 *         description: Question created successfully
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
 *                   example: "Question created successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Question'
 *       400:
 *         description: Validation error or creation failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not assignment owner
 *       404:
 *         description: Assignment not found
 */
router.post('/',
  authenticateToken,
  requireRole(['lecturer', 'admin']),
  validateCreateQuestion,
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

    const questionData: CreateQuestionRequest = req.body;
    const userId = req.user!.id;

    const result = await QuestionService.createQuestion(questionData, userId);
    res.status(201).json(result);
  })
);

/**
 * @swagger
 * /api/questions/assignment/{assignmentId}:
 *   get:
 *     summary: Get all questions for an assignment
 *     description: Get all questions for a specific assignment, ordered by order_index
 *     tags: [Questions]
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
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Question'
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
router.get('/assignment/:assignmentId',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const { assignmentId } = req.params;
    if (!assignmentId || typeof assignmentId !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Assignment ID is required',
      });
      return;
    }

    const result = await QuestionService.getQuestionsByAssignment(assignmentId);
    res.status(200).json(result);
  })
);

/**
 * @swagger
 * /api/questions/{questionId}:
 *   get:
 *     summary: Get question by ID
 *     description: Get a specific question by ID
 *     tags: [Questions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: questionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         example: "990e8400-e29b-41d4-a716-446655440004"
 *     responses:
 *       200:
 *         description: Question retrieved successfully
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
 *                   example: "Question retrieved successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Question'
 *       404:
 *         description: Question not found
 *       401:
 *         description: Unauthorized
 */
router.get('/:questionId',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const { questionId } = req.params;
    if (!questionId || typeof questionId !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Question ID is required',
      });
      return;
    }

    const result = await QuestionService.getQuestionById(questionId);
    res.status(200).json(result);
  })
);

/**
 * @swagger
 * /api/questions/{questionId}:
 *   put:
 *     summary: Update question
 *     description: Update a question. Only lecturers can update questions in their own assignments.
 *     tags: [Questions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: questionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         example: "990e8400-e29b-41d4-a716-446655440004"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [MCQ, FILLIN, ESSAY, CODE]
 *                 example: "MCQ"
 *               prompt_markdown:
 *                 type: string
 *                 example: "What is the space complexity of merge sort?"
 *               content_json:
 *                 type: object
 *                 nullable: true
 *                 example:
 *                   options: ["O(1)", "O(n)", "O(n log n)", "O(n²)"]
 *                   correct_answer: "O(n)"
 *               points:
 *                 type: integer
 *                 minimum: 1
 *                 example: 10
 *               order_index:
 *                 type: integer
 *                 minimum: 0
 *                 example: 2
 *     responses:
 *       200:
 *         description: Question updated successfully
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
 *                   example: "Question updated successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Question'
 *       400:
 *         description: Validation error or update failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not assignment owner
 *       404:
 *         description: Question not found
 */
router.put('/:questionId',
  authenticateToken,
  requireRole(['lecturer', 'admin']),
  validateUpdateQuestion,
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

    const { questionId } = req.params;
    if (!questionId || typeof questionId !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Question ID is required',
      });
      return;
    }

    const updateData: UpdateQuestionRequest = req.body;
    const userId = req.user!.id;

    const result = await QuestionService.updateQuestion(questionId, updateData, userId);
    res.status(200).json(result);
  })
);

/**
 * @swagger
 * /api/questions/{questionId}:
 *   delete:
 *     summary: Delete question
 *     description: Delete a question. Only lecturers can delete questions from their own assignments.
 *     tags: [Questions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: questionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         example: "990e8400-e29b-41d4-a716-446655440004"
 *     responses:
 *       200:
 *         description: Question deleted successfully
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
 *                   example: "Question deleted successfully"
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not assignment owner
 *       404:
 *         description: Question not found
 */
router.delete('/:questionId',
  authenticateToken,
  requireRole(['lecturer', 'admin']),
  asyncHandler(async (req: Request, res: Response) => {
    const { questionId } = req.params;
    if (!questionId || typeof questionId !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Question ID is required',
      });
      return;
    }

    const userId = req.user!.id;

    const result = await QuestionService.deleteQuestion(questionId, userId);
    res.status(200).json(result);
  })
);

export default router;
