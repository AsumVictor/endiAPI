// Lecturer routes
import { Router } from 'express';
import type { Request, Response } from 'express';
import { asyncHandler, AppError } from '../utils/errors.ts';
import { CourseService } from '../services/course.ts';
import { authenticateToken, requireRole } from '../middleware/auth.ts';
import { supabase } from '../config/database.ts';

const router = Router();

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

