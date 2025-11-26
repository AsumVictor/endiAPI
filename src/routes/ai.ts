// AI routes - proxy requests to external AI server
import { Router } from 'express';
import type { Request, Response } from 'express';
import expressValidator from 'express-validator';
const { body, validationResult } = expressValidator as any;
import { asyncHandler, AppError } from '../utils/errors.ts';
import { AIService } from '../services/ai.ts';
import { authenticateToken } from '../middleware/auth.ts';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     ExplainRequest:
 *       type: object
 *       required:
 *         - question
 *         - user_id
 *       properties:
 *         file_system:
 *           type: object
 *           description: Optional file system structure with files, folders, and active file
 *           properties:
 *             files:
 *               type: object
 *               additionalProperties:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     example: "file-1"
 *                   name:
 *                     type: string
 *                     example: "main.py"
 *                   path:
 *                     type: string
 *                     example: "src/main.py"
 *                   folder:
 *                     type: string
 *                     example: "src"
 *                   code:
 *                     type: string
 *                     example: "print('Hello')"
 *                   language:
 *                     type: string
 *                     example: "python"
 *             folders:
 *               type: array
 *               items:
 *                 type: string
 *               example: ["src", "src/utils", "docs"]
 *             activeFileId:
 *               type: string
 *               description: Optional active file ID
 *               example: "file-1"
 *         question:
 *           type: string
 *           example: "What does this code do?"
 *         user_id:
 *           type: string
 *           example: "user123"
 *         code_snippet:
 *           type: string
 *           description: Optional code snippet if not providing file_system
 *           example: "print('Hello')"
 *     ExplainResponse:
 *       type: object
 *       properties:
 *         answer:
 *           type: string
 *           description: Markdown formatted explanation
 *     InteractionRequest:
 *       type: object
 *       required:
 *         - user_id
 *         - question
 *       properties:
 *         user_id:
 *           type: string
 *           example: "user123"
 *         question:
 *           type: string
 *           example: "How do lists work in Python?"
 *     InteractionResponse:
 *       type: object
 *       properties:
 *         answer:
 *           type: string
 *           description: Markdown formatted answer
 *     AssessmentRequest:
 *       type: object
 *       required:
 *         - user_id
 *         - assessment
 *         - difficulty
 *       properties:
 *         user_id:
 *           type: string
 *           example: "user123"
 *         assessment:
 *           type: string
 *           example: "I want to learn about loops."
 *         difficulty:
 *           type: string
 *           enum: [beginner, intermediate, pro]
 *           example: "intermediate"
 *     AssessmentTopicRequest:
 *       type: object
 *       required:
 *         - questions_prompt
 *         - difficulty
 *       properties:
 *         questions_prompt:
 *           type: string
 *           example: "Python Decorators"
 *         difficulty:
 *           type: string
 *           enum: [easy, medium, hard, very_hard]
 *           example: "hard"
 *     AssessmentTopicResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         difficulty:
 *           type: string
 *           example: "medium"
 *         question_count:
 *           type: number
 *           example: 10
 *         questions:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               ID:
 *                 type: string
 *                 example: "1"
 *               question_prompt:
 *                 type: string
 *                 example: "Which of the following best describes..."
 *               options:
 *                 type: object
 *                 additionalProperties:
 *                   type: string
 *                 description: Object with option letters (A-Z) as keys and option text as values
 *                 example:
 *                   A: "First option"
 *                   B: "Second option"
 *                   C: "Third option"
 *                   D: "Fourth option"
 *         answers:
 *           type: object
 *           additionalProperties:
 *             type: string
 *           example:
 *             "1": "A"
 *             "2": "B"
 *         schemes:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               ID:
 *                 type: string
 *                 example: "1"
 *               answers:
 *                 type: object
 *                 additionalProperties:
 *                   type: object
 *                   properties:
 *                     isCorrect:
 *                       type: boolean
 *                     explanation:
 *                       type: string
 *                 description: Object with option letters (A-Z) as keys and answer details as values
 *                 example:
 *                   A:
 *                     isCorrect: true
 *                     explanation: "This is the correct answer"
 *                   B:
 *                     isCorrect: false
 *                     explanation: "This is incorrect"
 *     AssessmentPdfRequest:
 *       type: object
 *       required:
 *         - pdf_text
 *         - difficulty
 *       properties:
 *         pdf_text:
 *           type: string
 *           description: Full text content extracted from PDF
 *           example: "Full text content extracted from PDF..."
 *         difficulty:
 *           type: string
 *           enum: [easy, medium, hard, very_hard]
 *           example: "medium"
 *     AssessmentPdfResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         difficulty:
 *           type: string
 *           example: "medium"
 *         question_count:
 *           type: number
 *           example: 10
 *         questions:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               ID:
 *                 type: string
 *                 example: "1"
 *               question_prompt:
 *                 type: string
 *                 example: "Which of the following best describes..."
 *               options:
 *                 type: object
 *                 additionalProperties:
 *                   type: string
 *                 description: Object with option letters (A-Z) as keys and option text as values
 *                 example:
 *                   A: "First option"
 *                   B: "Second option"
 *                   C: "Third option"
 *                   D: "Fourth option"
 *         answers:
 *           type: object
 *           additionalProperties:
 *             type: string
 *           example:
 *             "1": "A"
 *             "2": "B"
 *         schemes:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               ID:
 *                 type: string
 *                 example: "1"
 *               answers:
 *                 type: object
 *                 additionalProperties:
 *                   type: object
 *                   properties:
 *                     isCorrect:
 *                       type: boolean
 *                     explanation:
 *                       type: string
 *                 description: Object with option letters (A-Z) as keys and answer details as values
 *                 example:
 *                   A:
 *                     isCorrect: true
 *                     explanation: "This is the correct answer"
 *                   B:
 *                     isCorrect: false
 *                     explanation: "This is incorrect"
 */

/**
 * @swagger
 * /api/ai/explain:
 *   post:
 *     summary: Explain code or answer questions about code
 *     description: Sends a request to the AI server to explain code snippets or answer questions about code
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ExplainRequest'
 *     responses:
 *       200:
 *         description: Explanation retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ExplainResponse'
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error or AI server error
 */
router.post('/explain',
  // authenticateToken,
  [
    body('question').notEmpty().withMessage('Question is required'),
    body('user_id').notEmpty().withMessage('User ID is required'),
    body('file_system').optional().isObject().withMessage('File system must be an object'),
    body('code_snippet').optional().isString().withMessage('Code snippet must be a string'),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(`Validation failed: ${errors.array().map((e: any) => e.msg).join(', ')}`, 400);
    }

    const { file_system, question, user_id, code_snippet } = req.body;

    const result = await AIService.explain({
      file_system,
      question,
      user_id,
      code_snippet,
    });

    res.status(200).json({
      success: true,
      message: 'Explanation retrieved successfully',
      data: result,
    });
  })
);

/**
 * @swagger
 * /api/ai/interaction:
 *   post:
 *     summary: General interaction/question answering
 *     description: Sends a general question to the AI server for interactive learning
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/InteractionRequest'
 *     responses:
 *       200:
 *         description: Answer retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InteractionResponse'
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error or AI server error
 */
router.post('/interaction',
  // authenticateToken,
  [
    body('user_id').notEmpty().withMessage('User ID is required'),
    body('question').notEmpty().withMessage('Question is required'),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(`Validation failed: ${errors.array().map((e: any) => e.msg).join(', ')}`, 400);
    }

    const { user_id, question } = req.body;

    const result = await AIService.interaction({
      user_id,
      question,
    });

    res.status(200).json({
      success: true,
      message: 'Answer retrieved successfully',
      data: result,
    });
  })
);

/**
 * @swagger
 * /api/ai/assessment:
 *   post:
 *     summary: Generate assessment based on user input
 *     description: Creates an assessment with questions/hints based on user's learning goals
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AssessmentRequest'
 *     responses:
 *       200:
 *         description: Assessment generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AssessmentResponse'
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error or AI server error
 */
router.post('/assessment',
  //authenticateToken,
  [
    body('user_id').notEmpty().withMessage('User ID is required'),
    body('assessment').notEmpty().withMessage('Assessment description is required'),
    body('difficulty').isIn(['beginner', 'intermediate', 'pro']).withMessage('Difficulty must be beginner, intermediate, or pro'),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(`Validation failed: ${errors.array().map((e: any) => e.msg).join(', ')}`, 400);
    }

    const { user_id, assessment, difficulty } = req.body;

    const result = await AIService.assessment({
      user_id,
      assessment,
      difficulty,
    });

    res.status(200).json({
      success: true,
      message: 'Assessment generated successfully',
      data: result,
    });
  })
);

/**
 * @swagger
 * /api/ai/assessment/topic:
 *   post:
 *     summary: Generate assessment questions from a topic
 *     description: Creates assessment questions based on a specific topic and difficulty level
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AssessmentTopicRequest'
 *     responses:
 *       200:
 *         description: Assessment questions generated successfully
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
 *                   example: "Assessment questions generated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     success:
 *                       type: boolean
 *                     difficulty:
 *                       type: string
 *                     question_count:
 *                       type: number
 *                     questions:
 *                       type: array
 *                     answers:
 *                       type: object
 *                     schemes:
 *                       type: array
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error or AI server error
 */
router.post('/assessment/topic',
  //authenticateToken,
  [
    body('questions_prompt').notEmpty().withMessage('Questions prompt is required'),
    body('difficulty').isIn(['easy', 'medium', 'hard', 'very_hard']).withMessage('Difficulty must be easy, medium, hard, or very_hard'),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(`Validation failed: ${errors.array().map((e: any) => e.msg).join(', ')}`, 400);
    }

    const { questions_prompt, difficulty } = req.body;

    const result = await AIService.assessmentTopic({
      questions_prompt,
      difficulty,
    });

    res.status(200).json({
      success: true,
      message: 'Assessment questions generated successfully',
      data: result,
    });
  })
);

/**
 * @swagger
 * /api/ai/assessment/pdf:
 *   post:
 *     summary: Generate assessment questions from PDF text
 *     description: Creates assessment questions based on text extracted from a PDF document
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AssessmentPdfRequest'
 *     responses:
 *       200:
 *         description: Assessment questions generated successfully
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
 *                   example: "Assessment questions generated successfully"
 *                 data:
 *                   $ref: '#/components/schemas/AssessmentPdfResponse'
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error or AI server error
 */
router.post('/assessment/pdf',
  //authenticateToken,
  [
    body('pdf_text').notEmpty().withMessage('PDF text is required'),
    body('difficulty').isIn(['easy', 'medium', 'hard', 'very_hard']).withMessage('Difficulty must be easy, medium, hard, or very_hard'),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(`Validation failed: ${errors.array().map((e: any) => e.msg).join(', ')}`, 400);
    }

    const { pdf_text, difficulty } = req.body;

    const result = await AIService.assessmentPdf({
      pdf_text,
      difficulty,
    });

    res.status(200).json({
      success: true,
      message: 'Assessment questions generated successfully',
      data: result,
    });
  })
);

export default router;

