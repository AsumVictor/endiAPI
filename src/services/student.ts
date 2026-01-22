// Student service for student-related operations
import { supabase } from '../config/database.js';
import { AppError } from '../utils/errors.js';
import type { DashboardResponse, StudentDashboard } from '../models/user.js';
import type { VideoProgressResponse } from '../models/video.js';

export interface UpdateStreakResponse {
  success: boolean;
  message: string;
  data?: {
    streak_count: number;
    last_login: string;
    days_missed?: number;
  };
}

export class StudentService {
  /**
   * Update student streak count and last login
   * Logic:
   * - If today's date equals last_login, don't do anything
   * - If current date - last_login > 5 days, set streak_count to 0 and update last_login
   * - Else set streak_count = streak_count - missed days
   */
  static async updateStreak(userId: string): Promise<UpdateStreakResponse> {
    try {
      // Get the student record
      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('id, streak_count, last_login')
        .eq('user_id', userId)
        .single();

      if (studentError || !student) {
        throw new AppError('Student profile not found', 404);
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0); // Reset time to start of day
      const todayStr = today.toISOString().split('T')[0] || today.toISOString().substring(0, 10); // Format: YYYY-MM-DD

      // If last_login is null, this is the first login
      if (!student.last_login) {
        // First login: set streak to 1
        const { error: updateError } = await supabase
          .from('students')
          .update({
            streak_count: 1,
            last_login: todayStr,
          })
          .eq('id', student.id);

        if (updateError) {
          throw new AppError(`Failed to update streak: ${updateError.message}`, 400);
        }

        return {
          success: true,
          message: 'Streak started! This is your first login.',
          data: {
            streak_count: 1,
            last_login: todayStr,
          },
        };
      }

      // Extract date part only (YYYY-MM-DD) from last_login, handling both date and datetime formats
      const lastLoginDateStr = student.last_login.trim().split('T')[0].split(' ')[0];
      
      // If today's date equals last_login date, don't do anything - prevent multiple updates on same day
      if (lastLoginDateStr === todayStr) {
        return {
          success: true,
          message: 'Streak already updated today',
          data: {
            streak_count: student.streak_count,
            last_login: student.last_login,
          },
        };
      }

      // Parse last_login date for calculation
      const lastLoginDate = new Date(lastLoginDateStr + 'T00:00:00');
      lastLoginDate.setHours(0, 0, 0, 0);

      // Calculate days difference
      const daysDiff = Math.floor((today.getTime() - lastLoginDate.getTime()) / (1000 * 60 * 60 * 24));

      let newStreakCount = student.streak_count;
      let daysMissed = 0;

      // If current date - last_login > 5 days, reset streak to 0
      if (daysDiff > 5) {
        newStreakCount = 0;
        daysMissed = daysDiff;
      } else {
        // Calculate missed days (days between last_login and today, excluding today)
        daysMissed = daysDiff - 1;
        
        // Update streak logic:
        // - If they logged in yesterday (daysDiff === 1), missed days = 0, increment streak
        // - If they missed 1-5 days (daysDiff === 2-6), subtract missed days from streak
        if (daysDiff === 1) {
          // Consecutive login: increment streak
          newStreakCount = student.streak_count + 1;
        } else {
          // Missed some days: streak = streak - missed days
          newStreakCount = Math.max(0, student.streak_count - daysMissed);
        }
      }

      // Update the database
      const { error: updateError } = await supabase
        .from('students')
        .update({
          streak_count: newStreakCount,
          last_login: todayStr,
        })
        .eq('id', student.id);

      if (updateError) {
        throw new AppError(`Failed to update streak: ${updateError.message}`, 400);
      }

      return {
        success: true,
        message: daysMissed === 0 
          ? 'Streak updated successfully!' 
          : daysMissed > 5 
            ? 'Streak reset due to inactivity' 
            : `Streak updated! ${daysMissed} day(s) missed.`,
        data: {
          streak_count: newStreakCount,
          last_login: todayStr,
          days_missed: daysMissed,
        },
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to update streak', 500);
    }
  }

  /**
   * Get student streak information
   */
  static async getStreak(userId: string): Promise<{ streak_count: number; last_login: string | null }> {
    try {
      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('streak_count, last_login')
        .eq('user_id', userId)
        .single();

      if (studentError || !student) {
        throw new AppError('Student profile not found', 404);
      }

      return {
        streak_count: student.streak_count,
        last_login: student.last_login,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to get streak', 500);
    }
  }

  /**
   * Get student dashboard data
   */
  static async getDashboard(userId: string): Promise<DashboardResponse> {
    try {
      // Get student record
      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (studentError || !student) {
        throw new AppError('Student profile not found', 404);
      }

      const studentId = student.id;

      // Get all enrolled courses with course details
      const { data: enrollments, error: enrollmentError } = await supabase
        .from('course_enrollments')
        .select(`
          course_id,
          enrolled_at,
          courses (
            id,
            title,
            description,
            thumbnail_url
          )
        `)
        .eq('student_id', studentId)
        .order('enrolled_at', { ascending: false });

      if (enrollmentError) {
        throw new AppError(`Failed to fetch enrollments: ${enrollmentError.message}`, 500);
      }

      const enrolledCourses = enrollments || [];
      const totalCoursesEnrolled = enrolledCourses.length;

      // Get all video progress for this student
      const { data: allVideoProgress, error: progressError } = await supabase
        .from('video_progress')
        .select('video_id, completed, completed_at')
        .eq('student_id', studentId);

      if (progressError) {
        throw new AppError(`Failed to fetch video progress: ${progressError.message}`, 500);
      }

      const videoProgress = allVideoProgress || [];
      const totalVideosWatched = videoProgress.filter(vp => vp.completed).length;

      // Process each enrolled course to get progress
      const courseProgressPromises = enrolledCourses.map(async (enrollment: any) => {
        const course = enrollment.courses;
        if (!course) return null;

        // Get total videos for this course
        const { count: totalVideos } = await supabase
          .from('videos')
          .select('id', { count: 'exact', head: true })
          .eq('course_id', course.id);

        // Get watched videos count for this course
        const { data: courseVideos } = await supabase
          .from('videos')
          .select('id')
          .eq('course_id', course.id);

        const courseVideoIds = courseVideos?.map(v => v.id) || [];
        const watchedVideos = videoProgress.filter(
          vp => vp.completed && courseVideoIds.includes(vp.video_id)
        );
        
        // Get most recent video completion time for this course (for sorting)
        const recentCompletion = watchedVideos
          .filter(vp => vp.completed_at)
          .map(vp => new Date(vp.completed_at!).getTime())
          .sort((a, b) => b - a)[0];
        
        const mostRecentActivity = recentCompletion 
          ? new Date(recentCompletion).toISOString() 
          : enrollment.enrolled_at;

        return {
          title: course.title,
          summary: course.description || '',
          thumbnail_url: course.thumbnail_url || null,
          total_videos: totalVideos || 0,
          total_watched_videos: watchedVideos.length,
          course_id: course.id,
          updated_at: mostRecentActivity,
        };
      });

      const courseProgressArray = await Promise.all(courseProgressPromises);
      const courseProgress = courseProgressArray
        .filter(cp => cp !== null)
        .sort((a: any, b: any) => 
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        )
        .slice(0, 5) // Limit to 5 most recent
        .map(({ updated_at, ...rest }) => rest);

      // Find completed courses (courses where all videos are watched)
      const completedCoursesPromises = enrolledCourses.map(async (enrollment: any) => {
        const course = enrollment.courses;
        if (!course) return null;

        const { count: totalVideos } = await supabase
          .from('videos')
          .select('id', { count: 'exact', head: true })
          .eq('course_id', course.id);

        if (!totalVideos || totalVideos === 0) return null;

        const { data: courseVideos } = await supabase
          .from('videos')
          .select('id')
          .eq('course_id', course.id);

        const courseVideoIds = courseVideos?.map(v => v.id) || [];
        const watchedVideos = videoProgress.filter(
          vp => vp.completed && courseVideoIds.includes(vp.video_id)
        );

        if (watchedVideos.length === totalVideos) {
          return {
            id: course.id,
            title: course.title,
          };
        }
        return null;
      });

      const completedCoursesArray = await Promise.all(completedCoursesPromises);
      const completedCourses = completedCoursesArray.filter(cc => cc !== null);

      // Get recent enrolled courses (last 5, sorted by enrolled_at)
      const recentEnrolledCourses = enrolledCourses
        .slice(0, 5)
        .map((enrollment: any) => ({
          id: enrollment.courses?.id || '',
          title: enrollment.courses?.title || '',
          timestamp: enrollment.enrolled_at || '',
        }))
        .filter(rec => rec.id && rec.title);

      // Get recent watched videos (videos with progress but not completed)
      // Get video progress entries with video details to access timestamps
      const watchedProgress = videoProgress
        .filter(vp => !vp.completed);

      const watchedVideoIds = watchedProgress.map(vp => vp.video_id);
      
      // Fetch video details including created_at as fallback timestamp
      const { data: recentWatchedVideosData } = await supabase
        .from('videos')
        .select('id, title, created_at')
        .in('id', watchedVideoIds.slice(0, 5));

      // Create a map to match videos with progress (if we had timestamps)
      const recentWatchedVideos = (recentWatchedVideosData || []).map(v => ({
        id: v.id,
        title: v.title,
        timestamp: v.created_at || new Date().toISOString(), // Use video created_at as fallback
      }));

      // Get recent completed videos (last 5, sorted by completed_at)
      const recentCompletedProgress = videoProgress
        .filter(vp => vp.completed && vp.completed_at)
        .sort((a, b) => {
          const dateA = a.completed_at ? new Date(a.completed_at).getTime() : 0;
          const dateB = b.completed_at ? new Date(b.completed_at).getTime() : 0;
          return dateB - dateA;
        })
        .slice(0, 5);

      const recentCompletedVideoIds = recentCompletedProgress.map(vp => vp.video_id);
      const { data: recentCompletedVideosData } = await supabase
        .from('videos')
        .select('id, title')
        .in('id', recentCompletedVideoIds);

      // Preserve the order by mapping in the same order as recentCompletedVideoIds
      const videoMap = new Map((recentCompletedVideosData || []).map(v => [v.id, v]));
      const progressMap = new Map(recentCompletedProgress.map(vp => [vp.video_id, vp]));
      
      const recentCompletedVideos = recentCompletedVideoIds
        .map(id => {
          const video = videoMap.get(id);
          const progress = progressMap.get(id);
          if (!video) return null;
          return {
            id: video.id,
            title: video.title,
            timestamp: progress?.completed_at || new Date().toISOString(),
          };
        })
        .filter(v => v !== null);

      const dashboard: StudentDashboard = {
        total_courses_enrolled: totalCoursesEnrolled,
        completed_courses_count: completedCourses.length,
        completed_courses: completedCourses as { id: string; title: string }[],
        total_videos_watched: totalVideosWatched,
        course_progress: courseProgress as any,
        recent_enrolled_courses: recentEnrolledCourses,
        recent_watched_videos: recentWatchedVideos,
        recent_completed_videos: recentCompletedVideos,
      };

      return {
        success: true,
        message: 'Dashboard data retrieved successfully',
        data: dashboard,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to get dashboard data', 500);
    }
  }

  /**
   * Create video progress (start watching a video)
   * Sets completed to false
   */
  static async createVideoProgress(videoId: string, userId: string): Promise<VideoProgressResponse> {
    try {
      // Get student record
      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (studentError || !student) {
        throw new AppError('Student profile not found', 404);
      }

      // Verify video exists
      const { data: video, error: videoError } = await supabase
        .from('videos')
        .select('id, course_id')
        .eq('id', videoId)
        .single();

      if (videoError || !video) {
        throw new AppError('Video not found', 404);
      }

      // Check if student is enrolled in the course
      const { data: enrollment, error: enrollmentError } = await supabase
        .from('course_enrollments')
        .select('id')
        .eq('course_id', video.course_id)
        .eq('student_id', student.id)
        .single();

      if (enrollmentError || !enrollment) {
        throw new AppError('You are not enrolled in this course', 403);
      }

      // Check if progress already exists
      const { data: existingProgress } = await supabase
        .from('video_progress')
        .select('*')
        .eq('video_id', videoId)
        .eq('student_id', student.id)
        .single();

      if (existingProgress) {
        return {
          success: false,
          message: 'already watch',
        };
      }

      // Create new video progress
      const { data: progress, error: progressError } = await supabase
        .from('video_progress')
        .insert([{
          id: crypto.randomUUID(),
          video_id: videoId,
          student_id: student.id,
          completed: false,
          completed_at: null,
        }])
        .select()
        .single();

      if (progressError) {
        throw new AppError(`Failed to create video progress: ${progressError.message}`, 400);
      }

      return {
        success: true,
        message: 'Video progress created successfully',
        data: progress,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to create video progress', 500);
    }
  }

  /**
   * Mark video as completed
   * Updates completed to true and sets completed_at timestamp
   */
  static async completeVideo(videoId: string, userId: string): Promise<VideoProgressResponse> {
    try {
      // Get student record
      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (studentError || !student) {
        throw new AppError('Student profile not found', 404);
      }

      // Verify video exists
      const { data: video, error: videoError } = await supabase
        .from('videos')
        .select('id, course_id')
        .eq('id', videoId)
        .single();

      if (videoError || !video) {
        throw new AppError('Video not found', 404);
      }

      // Check if student is enrolled in the course
      const { data: enrollment, error: enrollmentError } = await supabase
        .from('course_enrollments')
        .select('id')
        .eq('course_id', video.course_id)
        .eq('student_id', student.id)
        .single();

      if (enrollmentError || !enrollment) {
        throw new AppError('You are not enrolled in this course', 403);
      }

      // Check if progress exists
      const { data: existingProgress } = await supabase
        .from('video_progress')
        .select('*')
        .eq('video_id', videoId)
        .eq('student_id', student.id)
        .single();

      if (!existingProgress) {
        // Create progress first if it doesn't exist
        const { data: newProgress, error: createError } = await supabase
          .from('video_progress')
          .insert([{
            id: crypto.randomUUID(),
            video_id: videoId,
            student_id: student.id,
            completed: true,
            completed_at: new Date().toISOString(),
          }])
          .select()
          .single();

        if (createError) {
          throw new AppError(`Failed to create video progress: ${createError.message}`, 400);
        }

        return {
          success: true,
          message: 'Video marked as completed',
          data: newProgress,
        };
      }

      // Update existing progress
      const { data: progress, error: updateError } = await supabase
        .from('video_progress')
        .update({
          completed: true,
          completed_at: new Date().toISOString(),
        })
        .eq('video_id', videoId)
        .eq('student_id', student.id)
        .select()
        .single();

      if (updateError) {
        throw new AppError(`Failed to update video progress: ${updateError.message}`, 400);
      }

      return {
        success: true,
        message: 'Video marked as completed',
        data: progress,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to complete video', 500);
    }
  }
}

