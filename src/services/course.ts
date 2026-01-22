// Course service
import { supabase } from '../config/database.js';
import { AppError } from '../utils/errors.js';
import type {
  CreateCourseRequest,
  UpdateCourseRequest,
  CourseResponse,
  EnrollmentResponse,
  BrowseCoursesRequest,
  BrowseCoursesResponse,
  CourseWithStats,
  CourseDetailsResponse,
  CourseDetails,
  LecturerCourseDetails
} from '../models/course.js';

export class CourseService {
  /**
   * Create a new course
   */
  static async createCourse(data: CreateCourseRequest, userId: string): Promise<CourseResponse> {
    try {
      // First, get the lecturer record for this user
      const { data: lecturer, error: lecturerError } = await supabase
        .from('lecturers')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (lecturerError || !lecturer) {
        throw new AppError('Lecturer profile not found. Please complete your lecturer profile first.', 404);
      }

      const courseData = {
        id: crypto.randomUUID(),
        title: data.title,
        description: data.description,
        thumbnail_url: data.thumbnail_url || null,
        lecturer_id: lecturer.id, // Use the lecturer.id, not user.id
        created_at: new Date().toISOString(),
      };

      const { data: course, error } = await supabase
        .from('courses')
        .insert([courseData])
        .select()
        .single();

      if (error) {
        throw new AppError(`Failed to create course: ${error.message}`, 400);
      }

      return {
        success: true,
        message: 'Course created successfully',
        data: course,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to create course', 500);
    }
  }

  /**
   * Get course by ID
   */
  static async getCourseById(courseId: string): Promise<CourseResponse> {
    try {
      const { data: course, error } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .single();

      if (error || !course) {
        throw new AppError('Course not found', 404);
      }

      return {
        success: true,
        message: 'Course retrieved successfully',
        data: course,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to retrieve course', 500);
    }
  }

  /**
   * Update course
   */
  static async updateCourse(courseId: string, data: UpdateCourseRequest, userId: string): Promise<CourseResponse> {
    try {
      // First, get the lecturer record for this user
      const { data: lecturer, error: lecturerError } = await supabase
        .from('lecturers')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (lecturerError || !lecturer) {
        throw new AppError('Lecturer profile not found', 404);
      }

      // Verify the lecturer owns this course
      const { data: existingCourse, error: fetchError } = await supabase
        .from('courses')
        .select('lecturer_id')
        .eq('id', courseId)
        .single();

      if (fetchError || !existingCourse) {
        throw new AppError('Course not found', 404);
      }

      if (existingCourse.lecturer_id !== lecturer.id) {
        throw new AppError('You can only update your own courses', 403);
      }

      const updateData: any = {};
      if (data.title !== undefined) updateData.title = data.title;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.thumbnail_url !== undefined) updateData.thumbnail_url = data.thumbnail_url;

      const { data: course, error } = await supabase
        .from('courses')
        .update(updateData)
        .eq('id', courseId)
        .select()
        .single();

      if (error) {
        throw new AppError(`Failed to update course: ${error.message}`, 400);
      }

      return {
        success: true,
        message: 'Course updated successfully',
        data: course,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to update course', 500);
    }
  }

  /**
   * Delete course
   */
  static async deleteCourse(courseId: string, userId: string): Promise<CourseResponse> {
    try {
      // First, get the lecturer record for this user
      const { data: lecturer, error: lecturerError } = await supabase
        .from('lecturers')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (lecturerError || !lecturer) {
        throw new AppError('Lecturer profile not found', 404);
      }

      // Verify the lecturer owns this course
      const { data: existingCourse, error: fetchError } = await supabase
        .from('courses')
        .select('lecturer_id')
        .eq('id', courseId)
        .single();

      if (fetchError || !existingCourse) {
        throw new AppError('Course not found', 404);
      }

      if (existingCourse.lecturer_id !== lecturer.id) {
        throw new AppError('You can only delete your own courses', 403);
      }

      const { error } = await supabase
        .from('courses')
        .delete()
        .eq('id', courseId);

      if (error) {
        throw new AppError(`Failed to delete course: ${error.message}`, 400);
      }

      return {
        success: true,
        message: 'Course deleted successfully',
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to delete course', 500);
    }
  }

  /**
   * Get all courses by lecturer
   */
  static async getCoursesByLecturer(userId: string): Promise<CourseResponse> {
    try {
      // First, get the lecturer record for this user
      const { data: lecturer, error: lecturerError } = await supabase
        .from('lecturers')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (lecturerError || !lecturer) {
        throw new AppError('Lecturer profile not found', 404);
      }

      const { data: courses, error } = await supabase
        .from('courses')
        .select(`
          *,
          lecturers!courses_lecturer_id_fkey(first_name, last_name)
        `)
        .eq('lecturer_id', lecturer.id)
        .order('created_at', { ascending: false });

      if (error) {
        throw new AppError(`Failed to fetch courses: ${error.message}`, 400);
      }

      return {
        success: true,
        message: 'Courses retrieved successfully',
        data: courses,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to retrieve courses', 500);
    }
  }

  /**
   * Get students enrolled in a course
   */
  static async getCourseStudents(courseId: string): Promise<CourseResponse> {
    try {
      const { data: enrollments, error } = await supabase
        .from('course_enrollments')
        .select(`
          *,
          students!course_enrollments_student_id_fkey(first_name, last_name, email)
        `)
        .eq('course_id', courseId)
        .order('enrolled_at', { ascending: false });

      if (error) {
        throw new AppError(`Failed to fetch students: ${error.message}`, 400);
      }

      return {
        success: true,
        message: 'Students retrieved successfully',
        data: enrollments,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to retrieve students', 500);
    }
  }

  /**
   * Get course enrollments
   */
  static async getCourseEnrollments(courseId: string): Promise<CourseResponse> {
    try {
      const { data: enrollments, error } = await supabase
        .from('course_enrollments')
        .select('*')
        .eq('course_id', courseId)
        .order('enrolled_at', { ascending: false });

      if (error) {
        throw new AppError(`Failed to fetch enrollments: ${error.message}`, 400);
      }

      return {
        success: true,
        message: 'Enrollments retrieved successfully',
        data: enrollments,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to retrieve enrollments', 500);
    }
  }

  /**
   * Enroll student in course
   */
  static async enrollStudent(courseId: string, userId: string): Promise<EnrollmentResponse> {
    try {
      // First, get the student record for this user
      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (studentError || !student) {
        throw new AppError('Student profile not found. Please complete your student profile first.', 404);
      }

      // Check if student is already enrolled
      const { data: existingEnrollment } = await supabase
        .from('course_enrollments')
        .select('id')
        .eq('course_id', courseId)
        .eq('student_id', student.id)
        .single();

      if (existingEnrollment) {
        throw new AppError('Student is already enrolled in this course', 409);
      }

      const enrollmentData = {
        id: crypto.randomUUID(),
        course_id: courseId,
        student_id: student.id, // Use the student.id, not user.id
        enrolled_at: new Date().toISOString(),
      };

      const { data: enrollment, error } = await supabase
        .from('course_enrollments')
        .insert([enrollmentData])
        .select()
        .single();

      if (error) {
        throw new AppError(`Failed to enroll student: ${error.message}`, 400);
      }

      return {
        success: true,
        message: 'Student enrolled successfully',
        data: enrollment,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to enroll student', 500);
    }
  }

  /**
   * Unenroll student from course
   */
  static async unenrollStudent(courseId: string, userId: string): Promise<EnrollmentResponse> {
    try {
      // First, get the student record for this user
      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (studentError || !student) {
        throw new AppError('Student profile not found', 404);
      }

      const { error } = await supabase
        .from('course_enrollments')
        .delete()
        .eq('course_id', courseId)
        .eq('student_id', student.id);

      if (error) {
        throw new AppError(`Failed to unenroll student: ${error.message}`, 400);
      }

      return {
        success: true,
        message: 'Student unenrolled successfully',
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to unenroll student', 500);
    }
  }

  /**
   * Get student's enrolled courses
   */
  static async getStudentCourses(userId: string): Promise<CourseResponse> {
    try {
      // First, get the student record for this user
      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (studentError || !student) {
        throw new AppError('Student profile not found', 404);
      }

      const { data: enrollments, error } = await supabase
        .from('course_enrollments')
        .select(`
          *,
          courses!course_enrollments_course_id_fkey(
            id,
            title,
            description,
            thumbnail_url,
            created_at,
            lecturers!courses_lecturer_id_fkey(first_name, last_name)
          )
        `)
        .eq('student_id', student.id)
        .order('enrolled_at', { ascending: false });

      if (error) {
        throw new AppError(`Failed to fetch student courses: ${error.message}`, 400);
      }

      return {
        success: true,
        message: 'Student courses retrieved successfully',
        data: enrollments,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to retrieve student courses', 500);
    }
  }

  /**
   * Browse courses with pagination and filtering
   */
  static async browseCourses(userId: string, options: BrowseCoursesRequest): Promise<BrowseCoursesResponse> {
    try {
      // First, get the student record for this user
      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (studentError || !student) {
        throw new AppError('Student profile not found', 404);
      }

      // Set default values
      const page = Math.max(1, options.page || 1);
      const limit = Math.min(50, Math.max(1, options.limit || 10));
      const offset = (page - 1) * limit;
      const sort = options.sort || 'popular';

      let courses: any[] = [];
      let totalItems = 0;

      // Handle different filter types with optimized queries
      if (options.type === 'enrolled') {
        // Get courses the student is enrolled in with pagination
        let query = supabase
          .from('course_enrollments')
          .select(`
            course_id,
            enrolled_at,
            courses!course_enrollments_course_id_fkey(
              *,
              lecturers!courses_lecturer_id_fkey(
                first_name,
                last_name,
                avatar_url
              )
            )
          `)
          .eq('student_id', student.id);

        // Apply sorting at database level
        switch (sort) {
          case 'newest':
            query = query.order('enrolled_at', { ascending: false });
            break;
          case 'oldest':
            query = query.order('enrolled_at', { ascending: true });
            break;
          case 'title':
            query = query.order('courses.title', { ascending: true });
            break;
          case 'popular':
          default:
            query = query.order('enrolled_at', { ascending: false });
            break;
        }

        // Apply pagination
        query = query.range(offset, offset + limit - 1);

        const { data: enrollments, error: enrollmentError } = await query;

        if (enrollmentError) {
          throw new AppError(`Failed to fetch enrollments: ${enrollmentError.message}`, 400);
        }

        // Get total count for pagination
        const { count } = await supabase
          .from('course_enrollments')
          .select('*', { count: 'exact', head: true })
          .eq('student_id', student.id);

        totalItems = count || 0;
        courses = enrollments?.map(enrollment => ({
          ...enrollment.courses,
          enrollment_date: enrollment.enrolled_at,
        })) || [];

      } else if (options.type === 'not_enrolled') {
        // Get courses the student is NOT enrolled in with optimized query
        let query = supabase
          .from('courses')
          .select(`
            *,
            lecturers!courses_lecturer_id_fkey(
              first_name,
              last_name,
              avatar_url
            )
          `)
          .not('id', 'in', `(
            SELECT course_id 
            FROM course_enrollments 
            WHERE student_id = '${student.id}'
          )`);

        // Apply sorting at database level
        switch (sort) {
          case 'newest':
            query = query.order('created_at', { ascending: false });
            break;
          case 'oldest':
            query = query.order('created_at', { ascending: true });
            break;
          case 'title':
            query = query.order('title', { ascending: true });
            break;
          case 'popular':
          default:
            query = query.order('created_at', { ascending: false });
            break;
        }

        // Apply pagination
        query = query.range(offset, offset + limit - 1);

        const { data: allCourses, error: coursesError } = await query;

        if (coursesError) {
          throw new AppError(`Failed to fetch courses: ${coursesError.message}`, 400);
        }

        // Get total count for pagination
        const { count } = await supabase
          .from('courses')
          .select('*', { count: 'exact', head: true })
          .not('id', 'in', `(
            SELECT course_id 
            FROM course_enrollments 
            WHERE student_id = '${student.id}'
          )`);

        totalItems = count || 0;
        courses = allCourses || [];

      } else if (options.type === 'completed') {
        // For now, treat completed as enrolled since we don't have completion tracking yet
        let query = supabase
          .from('course_enrollments')
          .select(`
            course_id,
            enrolled_at,
            courses!course_enrollments_course_id_fkey(
              *,
              lecturers!courses_lecturer_id_fkey(
                first_name,
                last_name,
                avatar_url
              )
            )
          `)
          .eq('student_id', student.id);

        // Apply sorting at database level
        switch (sort) {
          case 'newest':
            query = query.order('enrolled_at', { ascending: false });
            break;
          case 'oldest':
            query = query.order('enrolled_at', { ascending: true });
            break;
          case 'title':
            query = query.order('courses.title', { ascending: true });
            break;
          case 'popular':
          default:
            query = query.order('enrolled_at', { ascending: false });
            break;
        }

        // Apply pagination
        query = query.range(offset, offset + limit - 1);

        const { data: enrollments, error: enrollmentError } = await query;

        if (enrollmentError) {
          throw new AppError(`Failed to fetch enrollments: ${enrollmentError.message}`, 400);
        }

        // Get total count for pagination
        const { count } = await supabase
          .from('course_enrollments')
          .select('*', { count: 'exact', head: true })
          .eq('student_id', student.id);

        totalItems = count || 0;
        courses = enrollments?.map(enrollment => ({
          ...enrollment.courses,
          enrollment_date: enrollment.enrolled_at,
        })) || [];

      } else {
        // 'all_courses' - get all courses with optimized query
        let query = supabase
          .from('courses')
          .select(`
            *,
            lecturers!courses_lecturer_id_fkey(
              first_name,
              last_name,
              avatar_url
            )
          `);

        // Apply sorting at database level
        switch (sort) {
          case 'newest':
            query = query.order('created_at', { ascending: false });
            break;
          case 'oldest':
            query = query.order('created_at', { ascending: true });
            break;
          case 'title':
            query = query.order('title', { ascending: true });
            break;
          case 'popular':
          default:
            query = query.order('created_at', { ascending: false });
            break;
        }

        // Apply pagination
        query = query.range(offset, offset + limit - 1);

        const { data: allCourses, error: coursesError } = await query;

        if (coursesError) {
          throw new AppError(`Failed to fetch courses: ${coursesError.message}`, 400);
        }

        // Get total count for pagination
        const { count } = await supabase
          .from('courses')
          .select('*', { count: 'exact', head: true });

        totalItems = count || 0;
        courses = allCourses || [];
      }

      // Sorting is now handled at database level

      // Process courses to add enrollment stats and student enrollment status
      const processedCourses: CourseWithStats[] = [];

      for (const course of courses) {
        // Get enrollment count for this course
        const { count: enrollmentCount } = await supabase
          .from('course_enrollments')
          .select('*', { count: 'exact', head: true })
          .eq('course_id', course.id);

        // Check if current student is enrolled (for all_courses type)
        let isEnrolled = false;
        let enrollmentDate: string | undefined;

        if (options.type === 'enrolled' || options.type === 'completed') {
          isEnrolled = true;
          enrollmentDate = course.enrollment_date;
        } else if (options.type === 'all_courses') {
          const { data: studentEnrollment } = await supabase
            .from('course_enrollments')
            .select('enrolled_at')
            .eq('course_id', course.id)
            .eq('student_id', student.id)
            .single();

          isEnrolled = !!studentEnrollment;
          enrollmentDate = studentEnrollment?.enrolled_at || undefined;
        }
        // For not_enrolled, isEnrolled is always false

        const lecturer = course.lecturers;
        const lecturerName = lecturer ? `${lecturer.first_name} ${lecturer.last_name}` : 'Unknown Lecturer';

        processedCourses.push({
          id: course.id,
          title: course.title,
          description: course.description,
          thumbnail_url: course.thumbnail_url,
          lecturer_id: course.lecturer_id,
          created_at: course.created_at,
          enrollment_count: enrollmentCount || 0,
          lecturer_name: lecturerName,
          lecturer_avatar: lecturer?.avatar_url || null,
          is_enrolled: isEnrolled,
          ...(enrollmentDate && { enrollment_date: enrollmentDate }),
        });
      }

      // Sort by popularity if requested (after getting enrollment counts)
      if (sort === 'popular') {
        processedCourses.sort((a, b) => b.enrollment_count - a.enrollment_count);
      }

      // Calculate pagination info
      const totalPages = Math.ceil(totalItems / limit);
      const hasNext = page < totalPages;
      const hasPrev = page > 1;

      return {
        success: true,
        message: 'Courses retrieved successfully',
        data: {
          courses: processedCourses,
          pagination: {
            current_page: page,
            total_pages: totalPages,
            total_items: totalItems,
            items_per_page: limit,
            has_next: hasNext,
            has_prev: hasPrev,
          },
        },
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to browse courses', 500);
    }
  }

  /**
   * Get detailed course information with videos and statistics
   */
  static async getCourseDetails(courseId: string, userId?: string): Promise<CourseDetailsResponse> {
    try {
      // Get course with lecturer information
      const { data: course, error: courseError } = await supabase
        .from('courses')
        .select(`
          *,
          lecturers!courses_lecturer_id_fkey(
            id,
            first_name,
            last_name,
            avatar_url
          )
        `)
        .eq('id', courseId)
        .single();

      if (courseError || !course) {
        throw new AppError('Course not found', 404);
      }

      // Get total videos count
      const { count: totalVideos } = await supabase
        .from('videos')
        .select('*', { count: 'exact', head: true })
        .eq('course_id', courseId);

      // Get total enrollments count
      const { count: totalEnrollments } = await supabase
        .from('course_enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('course_id', courseId);

      // Get all public videos for the course
      const { data: videos, error: videosError } = await supabase
        .from('videos')
        .select('*')
        .eq('course_id', courseId)
        .eq('ispublic', true)
        .order('created_at', { ascending: false });

      if (videosError) {
        throw new AppError(`Failed to fetch videos: ${videosError.message}`, 400);
      }

      // Get user's video progress if userId is provided
      let userProgress: any[] = [];
      let studentId: string | null = null;
      if (userId) {
        // Check if user is a student
        const { data: student } = await supabase
          .from('students')
          .select('id')
          .eq('user_id', userId)
          .single();

        if (student) {
          studentId = student.id;
          const { data: progress } = await supabase
            .from('video_progress')
            .select('video_id, completed, completed_at')
            .eq('student_id', student.id);

          userProgress = progress || [];
        }
      }

      // Process videos with user progress information
      const videosWithProgress = (videos || []).map(video => {
        const progress = userProgress.find(p => p.video_id === video.id);
        return {
          id: video.id,
          title: video.title,
          thumbnail_url: video.thumbnail_url,
          level: video.level,
          ispublic: video.ispublic,
          created_at: video.created_at,
          is_watched: progress?.completed || false,
          ...(progress?.completed && progress?.completed_at && { completed_at: progress.completed_at }),
        };
      });

      // Check if user is enrolled in the course
      let is_enrolled = false;
      if (studentId) {
        const { data: enrollment } = await supabase
          .from('course_enrollments')
          .select('id')
          .eq('course_id', courseId)
          .eq('student_id', studentId)
          .single();

        is_enrolled = !!enrollment;
      }

      const courseDetails: CourseDetails = {
        id: course.id,
        title: course.title,
        description: course.description,
        thumbnail_url: course.thumbnail_url,
        created_at: course.created_at,
        lecturer: {
          id: course.lecturers.id,
          first_name: course.lecturers.first_name,
          last_name: course.lecturers.last_name,
          avatar_url: course.lecturers.avatar_url || undefined,
        },
        total_videos: totalVideos || 0,
        total_enrollments: totalEnrollments || 0,
        is_enrolled,
        videos: videosWithProgress,
      };

      return {
        success: true,
        message: 'Course details retrieved successfully',
        data: courseDetails,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to retrieve course details', 500);
    }
  }

  /**
   * Get all courses by lecturer with enrollment metrics
   */
  static async getCoursesByLecturerWithMetrics(userId: string): Promise<CourseResponse> {
    try {
      // First, get the lecturer record for this user
      const { data: lecturer, error: lecturerError } = await supabase
        .from('lecturers')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (lecturerError || !lecturer) {
        throw new AppError('Lecturer profile not found', 404);
      }

      const { data: courses, error } = await supabase
        .from('courses')
        .select('*')
        .eq('lecturer_id', lecturer.id)
        .order('created_at', { ascending: false });

      if (error) {
        throw new AppError(`Failed to fetch courses: ${error.message}`, 400);
      }

      // Get metrics for each course
      const coursesWithMetrics = await Promise.all(
        (courses || []).map(async (course) => {
          // Get total students enrolled
          const { count: totalStudents } = await supabase
            .from('course_enrollments')
            .select('*', { count: 'exact', head: true })
            .eq('course_id', course.id);

          // Get total videos
          const { count: totalVideos } = await supabase
            .from('videos')
            .select('*', { count: 'exact', head: true })
            .eq('course_id', course.id);

          return {
            ...course,
            total_students: totalStudents || 0,
            total_videos: totalVideos || 0,
          };
        })
      );

      return {
        success: true,
        message: 'Courses retrieved successfully',
        data: coursesWithMetrics,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to retrieve courses', 500);
    }
  }

  /**
   * Get course details by lecturer with videos and enrollment metrics
   */
  static async getCourseDetailsByLecturer(courseId: string, userId: string): Promise<CourseDetailsResponse> {
    try {
      // First, get the lecturer record for this user
      const { data: lecturer, error: lecturerError } = await supabase
        .from('lecturers')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (lecturerError || !lecturer) {
        throw new AppError('Lecturer profile not found', 404);
      }

      // Get course with lecturer information
      const { data: course, error: courseError } = await supabase
        .from('courses')
        .select(`
          *,
          lecturers!courses_lecturer_id_fkey(
            id,
            first_name,
            last_name,
            avatar_url
          )
        `)
        .eq('id', courseId)
        .single();

      if (courseError || !course) {
        throw new AppError('Course not found', 404);
      }

      // Verify the lecturer owns this course
      if (course.lecturer_id !== lecturer.id) {
        throw new AppError('You can only view details of your own courses', 403);
      }

      // Get total videos count
      const { count: totalVideos } = await supabase
        .from('videos')
        .select('*', { count: 'exact', head: true })
        .eq('course_id', courseId);

      // Get total enrollments count
      const { count: totalEnrollments } = await supabase
        .from('course_enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('course_id', courseId);

      // Get all videos for the course (including private ones since lecturer owns it)
      const { data: videos, error: videosError } = await supabase
        .from('videos')
        .select('*')
        .eq('course_id', courseId)
        .order('created_at', { ascending: false });

      if (videosError) {
        throw new AppError(`Failed to fetch videos: ${videosError.message}`, 400);
      }

      // Get completion stats for each video
      const videosWithStats = await Promise.all(
        (videos || []).map(async (video) => {
          // Get completion count for this video
          const { count: completedCount } = await supabase
            .from('video_progress')
            .select('*', { count: 'exact', head: true })
            .eq('video_id', video.id)
            .eq('completed', true);

          const completionRate = totalEnrollments && totalEnrollments > 0
            ? (completedCount || 0) / totalEnrollments
            : 0;

          return {
            id: video.id,
            title: video.title,
            description: video.description,
            thumbnail_url: video.thumbnail_url,
            camera_video_url: video.camera_video_url,
            transcript_url: video.transcript_url,
            level: video.level,
            ispublic: video.ispublic,
            created_at: video.created_at,
            completed_count: completedCount || 0,
            completion_rate: Math.round(completionRate * 100),
          };
        })
      );

      const courseDetails: LecturerCourseDetails = {
        id: course.id,
        title: course.title,
        description: course.description,
        thumbnail_url: course.thumbnail_url,
        created_at: course.created_at,
        lecturer: {
          id: course.lecturers.id,
          first_name: course.lecturers.first_name,
          last_name: course.lecturers.last_name,
          avatar_url: course.lecturers.avatar_url || undefined,
        },
        total_videos: totalVideos || 0,
        total_enrollments: totalEnrollments || 0,
        videos: videosWithStats,
      };

      return {
        success: true,
        message: 'Course details retrieved successfully',
        data: courseDetails,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to retrieve course details', 500);
    }
  }
}
