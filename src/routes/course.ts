// Course routes
import { Router } from 'express';
import type { Request, Response } from 'express';
import expressValidator from 'express-validator';
const { body, validationResult } = expressValidator;
import { asyncHandler, AppError } from '../utils/errors.ts';
import { CourseService } from '../services/course.ts';
import { VideoService } from '../services/video.ts';
import { authenticateToken, requireRole } from '../middleware/auth.ts';
import type { CreateCourseRequest, UpdateCourseRequest, BrowseCoursesRequest } from '../models/course.ts';

const router = Router();

// Validation middleware
const validateCreateCourse = [
  body('title').isLength({ min: 3, max: 255 }).withMessage('Title must be 3-255 characters'),
  body('description').isLength({ min: 10, max: 2000 }).withMessage('Description must be 10-2000 characters'),
  body('thumbnail_url').optional().isURL().withMessage('Thumbnail URL must be a valid URL'),
];

const validateUpdateCourse = [
  body('title').optional().isLength({ min: 3, max: 255 }).withMessage('Title must be 3-255 characters'),
  body('description').optional().isLength({ min: 10, max: 2000 }).withMessage('Description must be 10-2000 characters'),
  body('thumbnail_url').optional().isURL().withMessage('Thumbnail URL must be a valid URL'),
];

/**
 * @swagger
 * components:
 *   schemas:
 *     Course:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "uuid-here"
 *         title:
 *           type: string
 *           example: "Introduction to Machine Learning"
 *         description:
 *           type: string
 *           example: "Learn the fundamentals of ML algorithms"
 *         thumbnail_url:
 *           type: string
 *           example: "https://example.com/thumbnail.jpg"
 *         lecturer_id:
 *           type: string
 *           example: "lecturer-uuid-here"
 *         created_at:
 *           type: string
 *           format: date-time
 *     CourseEnrollment:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "uuid-here"
 *         course_id:
 *           type: string
 *           example: "course-uuid-here"
 *         student_id:
 *           type: string
 *           example: "student-uuid-here"
 *         enrolled_at:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/courses:
 *   post:
 *     summary: Create a new course
 *     description: Create a new course. Only lecturers can create courses.
 *     tags: [Courses]
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
 *               - description
 *             properties:
 *               title:
 *                 type: string
 *                 example: "Introduction to Machine Learning"
 *               description:
 *                 type: string
 *                 example: "Learn the fundamentals of ML algorithms"
 *               thumbnail_url:
 *                 type: string
 *                 example: "https://example.com/thumbnail.jpg"
 *     responses:
 *       201:
 *         description: Course created successfully
 *       400:
 *         description: Validation error or creation failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 */
router.post('/',
  authenticateToken,
  requireRole(['lecturer', 'admin']),
  validateCreateCourse,
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array(),
      });
      return
    }

    const courseData: CreateCourseRequest = req.body;
    const userId = req.user!.id;

    const result = await CourseService.createCourse(courseData, userId);
    res.status(201).json(result);
  })
);

/**
 * @swagger
 * /api/courses/browse:
 *   get:
 *     summary: Browse courses with pagination and filtering
 *     description: Get courses with enrollment stats and student enrollment status. Student only.
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [all_courses, enrolled, not_enrolled, completed]
 *         description: Filter type for courses
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
 *           maximum: 50
 *           default: 10
 *         description: Items per page
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [popular, newest, oldest, title]
 *           default: popular
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Courses retrieved successfully
 *       400:
 *         description: Validation error or request failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not a student
 *       404:
 *         description: Student profile not found
 */
router.get('/browse',
  authenticateToken,
  requireRole(['student']),
  asyncHandler(async (req: Request, res: Response) => {
    // Extract and validate query parameters
    const { type, page, limit, sort } = req.query;

    if (!type || typeof type !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Type parameter is required',
      });
      return;
    }

    if (!['all_courses', 'enrolled', 'not_enrolled', 'completed'].includes(type)) {
      res.status(400).json({
        success: false,
        error: 'Type must be one of: all_courses, enrolled, not_enrolled, completed',
      });
      return;
    }

    const browseOptions: BrowseCoursesRequest = {
      type: type as 'all_courses' | 'enrolled' | 'not_enrolled' | 'completed',
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 10,
      sort: (sort as 'popular' | 'newest' | 'oldest' | 'title') || 'popular',
    };

    const userId = req.user!.id;
    const result = await CourseService.browseCourses(userId, browseOptions);
    res.status(200).json(result);
  })
);

/**
 * @swagger
 * /api/courses/{courseId}:
 *   get:
 *     summary: Get course details
 *     description: Retrieve detailed course information. Accessible by enrolled students and course owner.
 *     tags: [Courses]
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
 *         description: Course retrieved successfully
 *       404:
 *         description: Course not found
 *       401:
 *         description: Unauthorized
 */
router.get('/:courseId',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const { courseId } = req.params;
    if (!courseId || typeof courseId !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Course ID is required',
      });
      return
    }

    const result = await CourseService.getCourseById(courseId);
    res.status(200).json(result);
  })
);

/**
 * @swagger
 * /api/courses/{courseId}:
 *   put:
 *     summary: Update course
 *     description: Update course title, description, or thumbnail. Only the course owner can update.
 *     tags: [Courses]
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
 *             properties:
 *               title:
 *                 type: string
 *                 example: "Advanced Machine Learning"
 *               description:
 *                 type: string
 *                 example: "Deep dive into advanced ML techniques"
 *               thumbnail_url:
 *                 type: string
 *                 example: "https://example.com/new-thumbnail.jpg"
 *     responses:
 *       200:
 *         description: Course updated successfully
 *       400:
 *         description: Validation error or update failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not course owner
 *       404:
 *         description: Course not found
 */
router.put('/:courseId',
  authenticateToken,
  requireRole(['lecturer', 'admin']),
  validateUpdateCourse,
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
      });
      return
    }

    const { courseId } = req.params;
    if (!courseId || typeof courseId !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Course ID is required',
      });
      return
    }
    const updateData: UpdateCourseRequest = req.body;
    const userId = req.user!.id;

    const result = await CourseService.updateCourse(courseId, updateData, userId);
    res.status(200).json(result);
  })
);

/**
 * @swagger
 * /api/courses/{courseId}:
 *   delete:
 *     summary: Delete course
 *     description: Delete a course permanently. Only the course owner can delete.
 *     tags: [Courses]
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
 *         description: Course deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not course owner
 *       404:
 *         description: Course not found
 */
router.delete('/:courseId',
  authenticateToken,
  requireRole(['lecturer', 'admin']),
  asyncHandler(async (req: Request, res: Response) => {
    const { courseId } = req.params;
    if (!courseId || typeof courseId !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Course ID is required',
      });
      return
    }
    const userId = req.user!.id;

    const result = await CourseService.deleteCourse(courseId, userId);
    res.status(200).json(result);
  })
);

/**
 * @swagger
 * /api/lecturers/{lecturerId}/courses:
 *   get:
 *     summary: Get lecturer's courses
 *     description: Fetch all courses owned by a lecturer. Accessible by lecturer and admin.
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: lecturerId
 *         required: true
 *         schema:
 *           type: string
 *         description: Lecturer ID
 *     responses:
 *       200:
 *         description: Courses retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/lecturers/:lecturerId/courses',
  authenticateToken,
  requireRole(['lecturer', 'admin']),
  asyncHandler(async (req: Request, res: Response) => {
    const { lecturerId } = req.params;
    if (!lecturerId || typeof lecturerId !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Lecturer ID is required',
      });
      return
    }

    // Check if user is accessing their own courses or is admin
    if (req.user!.role !== 'admin' && req.user!.id !== lecturerId) {
      throw new AppError('You can only view your own courses', 403);
    }

    const result = await CourseService.getCoursesByLecturer(lecturerId);
    res.status(200).json(result);
  })
);

/**
 * @swagger
 * /api/courses/{courseId}/students:
 *   get:
 *     summary: Get course students
 *     description: List all students enrolled in a given course. Accessible by course owner and admin.
 *     tags: [Courses]
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
 *         description: Students retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Course not found
 */
router.get('/:courseId/students',
  authenticateToken,
  requireRole(['lecturer', 'admin']),
  asyncHandler(async (req: Request, res: Response) => {
    const { courseId } = req.params;
    if (!courseId || typeof courseId !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Course ID is required',
      });
      return
    }
    const result = await CourseService.getCourseStudents(courseId);
    res.status(200).json(result);
  })
);

/**
 * @swagger
 * /api/courses/{courseId}/enrollments:
 *   get:
 *     summary: Get course enrollments
 *     description: Fetch detailed enrollment data for a course. Accessible by course owner and admin.
 *     tags: [Courses]
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
 *         description: Enrollments retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Course not found
 */
router.get('/:courseId/enrollments',
  authenticateToken,
  requireRole(['lecturer', 'admin']),
  asyncHandler(async (req: Request, res: Response) => {
    const { courseId } = req.params;
    if (!courseId || typeof courseId !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Course ID is required',
      });
      return
    }
    const result = await CourseService.getCourseEnrollments(courseId);
    res.status(200).json(result);
  })
);

/**
 * @swagger
 * /api/courses/{courseId}/enroll:
 *   post:
 *     summary: Enroll in course
 *     description: Enroll a student in a specific course. Only students can enroll.
 *     tags: [Courses]
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
 *       201:
 *         description: Student enrolled successfully
 *       400:
 *         description: Already enrolled or enrollment failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not a student
 *       404:
 *         description: Course not found
 */
router.post('/:courseId/enroll',
  authenticateToken,
  requireRole(['student']),
  asyncHandler(async (req: Request, res: Response) => {
    const { courseId } = req.params;
    if (!courseId || typeof courseId !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Course ID is required',
      });
      return
    }
    const userId = req.user!.id;

    const result = await CourseService.enrollStudent(courseId, userId);
    res.status(201).json(result);
  })
);

/**
 * @swagger
 * /api/courses/{courseId}/enroll:
 *   delete:
 *     summary: Unenroll from course
 *     description: Unenroll a student from a course. Only students can unenroll themselves.
 *     tags: [Courses]
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
 *         description: Student unenrolled successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not a student
 *       404:
 *         description: Course or enrollment not found
 */
router.delete('/:courseId/enroll',
  authenticateToken,
  requireRole(['student']),
  asyncHandler(async (req: Request, res: Response) => {
    const { courseId } = req.params;
    if (!courseId || typeof courseId !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Course ID is required',
      });
      return
    }
    const userId = req.user!.id;

    const result = await CourseService.unenrollStudent(courseId, userId);
    res.status(200).json(result);
  })
);

/**
 * @swagger
 * /api/students/{studentId}/courses:
 *   get:
 *     summary: Get student's courses
 *     description: Fetch all courses the student is currently enrolled in. Students can only view their own courses.
 *     tags: [Courses]
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
 *         description: Student courses retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - can only view own courses
 *       404:
 *         description: Student not found
 */
router.get('/students/:studentId/courses',
  authenticateToken,
  requireRole(['student', 'admin']),
  asyncHandler(async (req: Request, res: Response) => {
    const { studentId } = req.params;

    if (!studentId || typeof studentId !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Student ID is required',
      });
      return
    }

    // Check if user is accessing their own courses or is admin
    if (req.user!.role !== 'admin' && req.user!.id !== studentId) {
      throw new AppError('You can only view your own courses', 403);
    }

    const result = await CourseService.getStudentCourses(studentId);
    res.status(200).json(result);
  })
);

/**
 * @swagger
 * /api/courses/{courseId}/details:
 *   get:
 *     summary: Get detailed course information
 *     description: Fetch comprehensive course details including lecturer info, statistics, and public videos with user progress
 *     tags: [Courses]
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
 *       404:
 *         description: Course not found
 */
router.get('/:courseId/details',
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
    const result = await CourseService.getCourseDetails(courseId, userId);
    res.status(200).json(result);
  })
);

/**
 * @swagger
 * /api/courses/{courseId}/videos:
 *   post:
 *     summary: Create a new video for a course
 *     description: Add a new video to a specific course (lecturer only)
 *     tags: [Courses]
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
 *                 description: Video title
 *               description:
 *                 type: string
 *                 description: Video description
 *               thumbnail_url:
 *                 type: string
 *                 description: Video thumbnail URL
 *               camera_video_url:
 *                 type: string
 *                 description: Video URL
 *               code_activity:
 *                 type: object
 *                 description: Code activity data
 *               level:
 *                 type: string
 *                 enum: [beginner, intermediate, advanced]
 *                 description: Video difficulty level
 *               initial_data:
 *                 type: object
 *                 description: Initial data for the video
 *               ispublic:
 *                 type: boolean
 *                 description: Whether the video is public
 *                 default: false
 *     responses:
 *       201:
 *         description: Video created successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - not course owner
 *       404:
 *         description: Course not found
 */
router.post('/:courseId/videos',
  authenticateToken,
  requireRole(['lecturer']),
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
    const videoData = req.body;
    
    const result = await VideoService.createVideo(courseId, videoData, userId);
    res.status(201).json(result);
  })
);

export default router;
