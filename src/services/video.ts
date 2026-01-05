// Video service
import { supabase } from '../config/database.ts';
import { AppError } from '../utils/errors.ts';
import logger from '../utils/logger.ts';
import type {
  VideoProgress,
  CreateVideoRequest,
  UpdateVideoRequest,
  VideoResponse,
  VideoProgressResponse,
  VideoWithProgress,
  VideoWithStats,
  CourseVideoCompletions
} from '../models/video.ts';

export class VideoService {
  /**
   * Create a new video
   */
  static async createVideo(courseId: string, data: CreateVideoRequest, userId: string): Promise<VideoResponse> {
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
      const { data: course, error: courseError } = await supabase
        .from('courses')
        .select('lecturer_id')
        .eq('id', courseId)
        .single();

      if (courseError || !course) {
        throw new AppError('Course not found', 404);
      }

      if (course.lecturer_id !== lecturer.id) {
        throw new AppError('You can only add videos to your own courses', 403);
      }

      const videoData = {
        id: crypto.randomUUID(),
        course_id: courseId,
        title: data.title,
        description: data.description,
        camera_video_url: data.camera_video_url,
        thumbnail_url: data.thumbnail_url ?? null,
        snapshot_url: data.snapshot_url ?? null,
        event_url: data.event_url ?? null,
        transcript_url: data.transcript_url ?? null,
        level: data.level,
        ispublic: data.ispublic || false,
        created_at: new Date().toISOString(),
      };

      const { data: video, error } = await supabase
        .from('videos')
        .insert([videoData])
        .select()
        .single();

      if (error) {
        throw new AppError(`Failed to create video: ${error.message}`, 400);
      }

      return {
        success: true,
        message: 'Video created successfully and sent for transcription',
        data: { id: video.id },
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to create video', 500);
    }
  }

  /**
   * Get videos by course ID
   */
  static async getVideosByCourse(courseId: string, userId: string): Promise<VideoResponse> {
    try {
      // Check if user is enrolled in the course or owns it
      const isAuthorized = await this.checkCourseAccess(courseId, userId);
      if (!isAuthorized) {
        throw new AppError('You are not authorized to view videos in this course', 403);
      }

      // Get student ID if user is a student
      let studentId: string | null = null;
      if (isAuthorized.isStudent) {
        studentId = isAuthorized.studentId || null;
      }

      const { data: videos, error } = await supabase
        .from('videos')
        .select('*')
        .eq('course_id', courseId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new AppError(`Failed to fetch videos: ${error.message}`, 400);
      }

      // Get progress for each video if user is a student
      const videosWithProgress: VideoWithProgress[] = [];
      
      for (const video of videos || []) {
        let progress: VideoProgress | null = null;
        
        if (studentId) {
          const { data: progressData } = await supabase
            .from('video_progress')
            .select('*')
            .eq('video_id', video.id)
            .eq('student_id', studentId)
            .single();
          
          progress = progressData;
        }

        videosWithProgress.push({
          ...video,
          is_completed: progress?.completed || false,
          completed_at: progress?.completed_at || null,
          progress_id: progress?.id || null,
        });
      }

      return {
        success: true,
        message: 'Videos retrieved successfully',
        data: videosWithProgress,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to retrieve videos', 500);
    }
  }

  /**
   * Get video by ID
   */
  static async getVideoById(videoId: string, _userId: string): Promise<VideoResponse> {
    try {
      // Get video with lecturer info
      const { data: video, error } = await supabase
        .from('videos')
        .select(`
          *,
          courses!videos_course_id_fkey(
            id,
            title,
            lecturers!courses_lecturer_id_fkey(
              id,
              first_name,
              last_name,
              avatar_url
            )
          )
        `)
        .eq('id', videoId)
        .single();

      if (error || !video) {
        throw new AppError('Video not found', 404);
      }

      // Only return public videos
      if (!video.ispublic) {
        throw new AppError('Video not found', 404);
      }

      // check if user has enrolled in the course
      const courseId = video.course_id;

      // First, get the student record for this user
      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', _userId)
        .single();

      if (studentError || !student) {
        throw new AppError('Student profile not found', 404);
      }

      // Check if student is enrolled in the course
      const { error: enrolledError } = await supabase
        .from('course_enrollments')
        .select('id')
        .eq('course_id', courseId)
        .eq('student_id', student.id)
        .single();

      if (enrolledError) {
        throw new AppError('You are not authorized to view this video! Please enroll', 403);
      }

      // Extract course and lecturer info
      const course = video.courses;
      const lecturer = course?.lecturers;
      
      const lecturerData = lecturer ? {
        id: lecturer.id,
        first_name: lecturer.first_name,
        last_name: lecturer.last_name,
        avatar_url: lecturer.avatar_url || null,
      } : null;

      const courseData = course ? {
        id: course.id,
        name: course.title,
      } : null;

      // Remove nested course info and add lecturer and course data
      const { courses, ...videoData } = video;
      const responseData = {
        ...videoData,
        lecturer: lecturerData,
        course: courseData,
      };

      return {
        success: true,
        message: 'Video retrieved successfully',
        data: responseData,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to retrieve video', 500);
    }
  }

  /**
   * Update video
   */
  static async updateVideo(videoId: string, data: UpdateVideoRequest, userId: string): Promise<VideoResponse> {
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

      // Get video with course info to verify ownership
      const { data: video, error: videoError } = await supabase
        .from('videos')
        .select(`
          *,
          courses!videos_course_id_fkey(lecturer_id)
        `)
        .eq('id', videoId)
        .single();

      if (videoError || !video) {
        throw new AppError('Video not found', 404);
      }

      if (video.courses.lecturer_id !== lecturer.id) {
        throw new AppError('You can only update videos in your own courses', 403);
      }

      const updateData: any = {};
      if (data.title !== undefined) updateData.title = data.title;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.camera_video_url !== undefined) updateData.camera_video_url = data.camera_video_url;
      if (data.thumbnail_url !== undefined) updateData.thumbnail_url = data.thumbnail_url;
      if (data.snapshot_url !== undefined) updateData.snapshot_url = data.snapshot_url;
      if (data.event_url !== undefined) updateData.event_url = data.event_url;
      if (data.transcript_url !== undefined) updateData.transcript_url = data.transcript_url;
      if (data.level !== undefined) updateData.level = data.level;
      if (data.ispublic !== undefined) updateData.ispublic = data.ispublic;

      const { data: updatedVideo, error } = await supabase
        .from('videos')
        .update(updateData)
        .eq('id', videoId)
        .select()
        .single();

      if (error) {
        throw new AppError(`Failed to update video: ${error.message}`, 400);
      }

      return {
        success: true,
        message: 'Video updated successfully',
        data: updatedVideo,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to update video', 500);
    }
  }

  /**
   * Update video's camera_video_url directly (used by Kafka consumer, bypasses lecturer validation)
   */
  static async updateCameraVideoUrl(videoId: string, cloudUrl: string): Promise<void> {
    try {
      // First verify the video exists
      const { data: video, error: videoError } = await supabase
        .from('videos')
        .select('id')
        .eq('id', videoId)
        .single();

      if (videoError || !video) {
        logger.error('Video not found when updating camera_video_url', {
          videoId,
          error: videoError,
        });
        throw new AppError(`Video not found: ${videoId}`, 404);
      }

      // Update the camera_video_url
      const { error: updateError } = await supabase
        .from('videos')
        .update({
          camera_video_url: cloudUrl,
        })
        .eq('id', videoId);

      if (updateError) {
        logger.error('Failed to update camera_video_url', {
          videoId,
          cloudUrl,
          error: updateError,
        });
        throw new AppError(`Failed to update camera_video_url: ${updateError.message}`, 500);
      }

      logger.info('Successfully updated camera_video_url', {
        videoId,
        cloudUrl,
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error updating camera_video_url', {
        videoId,
        cloudUrl,
        error,
      });
      throw new AppError('Failed to update camera_video_url', 500);
    }
  }

  /**
   * Delete video
   */
  static async deleteVideo(videoId: string, userId: string): Promise<VideoResponse> {
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

      // Get video with course info to verify ownership
      const { data: video, error: videoError } = await supabase
        .from('videos')
        .select(`
          *,
          courses!videos_course_id_fkey(lecturer_id)
        `)
        .eq('id', videoId)
        .single();

      if (videoError || !video) {
        throw new AppError('Video not found', 404);
      }

      if (video.courses.lecturer_id !== lecturer.id) {
        throw new AppError('You can only delete videos from your own courses', 403);
      }

      // Delete video (cascade will handle video_progress)
      const { error } = await supabase
        .from('videos')
        .delete()
        .eq('id', videoId);

      if (error) {
        throw new AppError(`Failed to delete video: ${error.message}`, 400);
      }

      return {
        success: true,
        message: 'Video deleted successfully',
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to delete video', 500);
    }
  }

  /**
   * Mark video as completed by student
   */
  static async markVideoCompleted(videoId: string, userId: string): Promise<VideoProgressResponse> {
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

      // Check if student is enrolled in the course
      const { data: video, error: videoError } = await supabase
        .from('videos')
        .select(`
          course_id,
          courses!videos_course_id_fkey(id)
        `)
        .eq('id', videoId)
        .single();

      if (videoError || !video) {
        throw new AppError('Video not found', 404);
      }

      const isEnrolled = await this.checkStudentEnrollment(video.course_id, student.id);
      if (!isEnrolled) {
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
        // Update existing progress
        const { data: progress, error } = await supabase
          .from('video_progress')
          .update({
            completed: true,
            completed_at: new Date().toISOString(),
          })
          .eq('id', existingProgress.id)
          .select()
          .single();

        if (error) {
          throw new AppError(`Failed to update progress: ${error.message}`, 400);
        }

        return {
          success: true,
          message: 'Video marked as completed',
          data: progress,
        };
      } else {
        // Create new progress record
        const progressData = {
          id: crypto.randomUUID(),
          video_id: videoId,
          student_id: student.id,
          completed: true,
          completed_at: new Date().toISOString(),
        };

        const { data: progress, error } = await supabase
          .from('video_progress')
          .insert([progressData])
          .select()
          .single();

        if (error) {
          throw new AppError(`Failed to create progress: ${error.message}`, 400);
        }

        return {
          success: true,
          message: 'Video marked as completed',
          data: progress,
        };
      }
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to mark video as completed', 500);
    }
  }

  /**
   * Get completed videos for a student
   */
  static async getStudentCompletedVideos(userId: string): Promise<VideoResponse> {
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

      const { data: progressRecords, error } = await supabase
        .from('video_progress')
        .select(`
          *,
          videos!video_progress_video_id_fkey(
            id,
            title,
            description,
            thumbnail_url,
            camera_video_url,
            level,
            course_id,
            courses!videos_course_id_fkey(
              title,
              lecturers!courses_lecturer_id_fkey(first_name, last_name)
            )
          )
        `)
        .eq('student_id', student.id)
        .eq('completed', true)
        .order('completed_at', { ascending: false });

      if (error) {
        throw new AppError(`Failed to fetch completed videos: ${error.message}`, 400);
      }

      return {
        success: true,
        message: 'Completed videos retrieved successfully',
        data: progressRecords,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to retrieve completed videos', 500);
    }
  }

  /**
   * Get video completion statistics for a course
   */
  static async getCourseVideoCompletions(courseId: string, userId: string): Promise<VideoResponse> {
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
      const { data: course, error: courseError } = await supabase
        .from('courses')
        .select('lecturer_id')
        .eq('id', courseId)
        .single();

      if (courseError || !course) {
        throw new AppError('Course not found', 404);
      }

      if (course.lecturer_id !== lecturer.id) {
        throw new AppError('You can only view statistics for your own courses', 403);
      }

      // Get all videos in the course
      const { data: videos, error: videosError } = await supabase
        .from('videos')
        .select('*')
        .eq('course_id', courseId);

      if (videosError) {
        throw new AppError(`Failed to fetch videos: ${videosError.message}`, 400);
      }

      // Get completion statistics for each video
      const videosWithStats: VideoWithStats[] = [];
      let totalCompletions = 0;

      for (const video of videos || []) {
        // Get total students enrolled in the course
        const { count: totalStudents } = await supabase
          .from('course_enrollments')
          .select('*', { count: 'exact', head: true })
          .eq('course_id', courseId);

        // Get completion count for this video
        const { count: completedCount } = await supabase
          .from('video_progress')
          .select('*', { count: 'exact', head: true })
          .eq('video_id', video.id)
          .eq('completed', true);

        const completionRate = totalStudents && totalStudents > 0 
          ? (completedCount || 0) / totalStudents 
          : 0;

        totalCompletions += completedCount || 0;

        videosWithStats.push({
          ...video,
          total_students: totalStudents || 0,
          completed_count: completedCount || 0,
          completion_rate: completionRate,
        });
      }

      const averageCompletionRate = videosWithStats.length > 0 
        ? videosWithStats.reduce((sum, video) => sum + video.completion_rate, 0) / videosWithStats.length 
        : 0;

      const completions: CourseVideoCompletions = {
        course_id: courseId,
        videos: videosWithStats,
        total_videos: videosWithStats.length,
        total_completions: totalCompletions,
        average_completion_rate: averageCompletionRate,
      };

      return {
        success: true,
        message: 'Video completion statistics retrieved successfully',
        data: completions,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to retrieve video completion statistics', 500);
    }
  }

  /**
   * Get student's video progress for a specific course
   */
  static async getStudentVideoProgress(courseId: string, studentId: string, userId: string): Promise<VideoResponse> {
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
      const { data: course, error: courseError } = await supabase
        .from('courses')
        .select('lecturer_id')
        .eq('id', courseId)
        .single();

      if (courseError || !course) {
        throw new AppError('Course not found', 404);
      }

      if (course.lecturer_id !== lecturer.id) {
        throw new AppError('You can only view student progress for your own courses', 403);
      }

      // Get all videos in the course with progress for the specific student
      const { data: videos, error: videosError } = await supabase
        .from('videos')
        .select('*')
        .eq('course_id', courseId);

      if (videosError) {
        throw new AppError(`Failed to fetch videos: ${videosError.message}`, 400);
      }

      const videosWithProgress: VideoWithProgress[] = [];

      for (const video of videos || []) {
        const { data: progress } = await supabase
          .from('video_progress')
          .select('*')
          .eq('video_id', video.id)
          .eq('student_id', studentId)
          .single();

        videosWithProgress.push({
          ...video,
          is_completed: progress?.completed || false,
          completed_at: progress?.completed_at || null,
          progress_id: progress?.id || null,
        });
      }

      return {
        success: true,
        message: 'Student video progress retrieved successfully',
        data: videosWithProgress,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to retrieve student video progress', 500);
    }
  }

  /**
   * Helper method to check course access
   */
  private static async checkCourseAccess(courseId: string, userId: string): Promise<{ isStudent: boolean; studentId?: string } | null> {
    // Check if user is a student enrolled in the course
    const { data: student } = await supabase
      .from('students')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (student) {
      const isEnrolled = await this.checkStudentEnrollment(courseId, student.id);
      if (isEnrolled) {
        return { isStudent: true, studentId: student.id };
      }
    }

    // Check if user is a lecturer who owns the course
    const { data: lecturer } = await supabase
      .from('lecturers')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (lecturer) {
      const { data: course } = await supabase
        .from('courses')
        .select('lecturer_id')
        .eq('id', courseId)
        .single();

      if (course && course.lecturer_id === lecturer.id) {
        return { isStudent: false };
      }
    }

    return null;
  }

  /**
   * Helper method to check student enrollment
   */
  private static async checkStudentEnrollment(courseId: string, studentId: string): Promise<boolean> {
    const { data: enrollment } = await supabase
      .from('course_enrollments')
      .select('id')
      .eq('course_id', courseId)
      .eq('student_id', studentId)
      .single();

    return !!enrollment;
  }

  /**
   * Get all videos by lecturer ID
   */
  static async getVideosByLecturer(userId: string): Promise<VideoResponse> {
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

      // Get all courses by this lecturer
      const { data: courses, error: coursesError } = await supabase
        .from('courses')
        .select('id')
        .eq('lecturer_id', lecturer.id);

      if (coursesError) {
        throw new AppError(`Failed to fetch courses: ${coursesError.message}`, 400);
      }

      if (!courses || courses.length === 0) {
        return {
          success: true,
          message: 'No videos found',
          data: [],
        };
      }

      // Get all videos for these courses
      const courseIds = courses.map(c => c.id);
      const { data: videos, error: videosError } = await supabase
        .from('videos')
        .select(`
          *,
          courses!videos_course_id_fkey(
            id,
            title
          )
        `)
        .in('course_id', courseIds)
        .order('created_at', { ascending: false });

      if (videosError) {
        throw new AppError(`Failed to fetch videos: ${videosError.message}`, 400);
      }

      return {
        success: true,
        message: 'Videos retrieved successfully',
        data: videos || [],
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to retrieve videos', 500);
    }
  }

  /**
   * Get video by ID for lecturer (without enrollment check)
   */
  static async getVideoByIdForLecturer(videoId: string, userId: string): Promise<VideoResponse> {
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

      // Get video with course info
      const { data: video, error: videoError } = await supabase
        .from('videos')
        .select(`
          *,
          courses!videos_course_id_fkey(
            id,
            title,
            lecturer_id
          )
        `)
        .eq('id', videoId)
        .single();

      if (videoError || !video) {
        throw new AppError('Video not found', 404);
      }

      // Verify the lecturer owns this video's course
      if (video.courses.lecturer_id !== lecturer.id) {
        throw new AppError('You can only view videos from your own courses', 403);
      }

      return {
        success: true,
        message: 'Video retrieved successfully',
        data: video,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to retrieve video', 500);
    }
  }

  /**
   * Update transcription URL manually (same logic as Kafka consumer)
   */
  static async updateTranscriptionUrl(videoId: string, transcriptionData: any, userId: string): Promise<VideoResponse> {
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

      // Get video with course info to verify ownership
      const { data: video, error: videoError } = await supabase
        .from('videos')
        .select(`
          *,
          courses!videos_course_id_fkey(lecturer_id)
        `)
        .eq('id', videoId)
        .single();

      if (videoError || !video) {
        throw new AppError('Video not found', 404);
      }

      if (video.courses.lecturer_id !== lecturer.id) {
        throw new AppError('You can only update transcription for videos in your own courses', 403);
      }

      // Same logic as Kafka consumer: delete existing caption, upload new one, get public URL
      const captionFileName = `${videoId}.json`;
      const storagePath = `videos/${captionFileName}`;

      logger.info('Updating transcription URL manually', { videoId, storagePath });

      // 1. Check if caption file exists in storage
      const { data: existingFiles } = await supabase
        .storage
        .from('captions')
        .list('videos', {
          search: captionFileName,
        });

      // 2. Delete existing file if found
      if (existingFiles && existingFiles.length > 0) {
        logger.info('Deleting existing caption file', { videoId, storagePath });
        const { error: deleteError } = await supabase
          .storage
          .from('captions')
          .remove([storagePath]);

        if (deleteError) {
          logger.warn('Failed to delete existing caption file', {
            videoId,
            error: deleteError,
          });
        } else {
          logger.info('Existing caption file deleted', { videoId });
        }
      }

      // 3. Upload new caption JSON to Supabase Storage
      const captionJson = JSON.stringify(transcriptionData, null, 2);
      const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from('captions')
        .upload(storagePath, captionJson, {
          contentType: 'application/json',
          upsert: true,
        });

      if (uploadError) {
        logger.error('Failed to upload caption to storage', {
          videoId,
          error: uploadError,
        });
        throw new AppError(`Failed to upload caption: ${uploadError.message}`, 500);
      }

      logger.info('Caption uploaded to storage', { videoId, path: uploadData.path });

      // 4. Get public URL
      const { data: publicUrlData } = supabase
        .storage
        .from('captions')
        .getPublicUrl(storagePath);

      const captionPublicUrl = publicUrlData.publicUrl;
      logger.info('Caption public URL generated', { videoId, url: captionPublicUrl });

      // 5. Update video record with caption URL
      const { data: updatedVideo, error: updateError } = await supabase
        .from('videos')
        .update({
          transcript_url: captionPublicUrl,
        })
        .eq('id', videoId)
        .select()
        .single();

      if (updateError) {
        logger.error('Failed to update video with caption URL', {
          videoId,
          error: updateError,
        });
        throw new AppError(`Failed to update video: ${updateError.message}`, 500);
      }

      logger.info('Transcription URL updated successfully', {
        videoId,
        captionUrl: captionPublicUrl,
      });

      return {
        success: true,
        message: 'Transcription URL updated successfully',
        data: updatedVideo,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Failed to update transcription URL', { error });
      throw new AppError('Failed to update transcription URL', 500);
    }
  }
}
