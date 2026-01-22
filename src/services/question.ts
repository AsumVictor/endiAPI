// Question service
import { supabase } from '../config/database.js';
import { AppError } from '../utils/errors.js';
import type {
  CreateQuestionRequest,
  UpdateQuestionRequest,
  QuestionResponse,
} from '../models/assignment.js';

type ApiQuestionType = 'MCQ' | 'FILLIN' | 'ESSAY' | 'CODE';
type DbQuestionType = 'MCQ' | 'Fill_in' | 'Essay' | 'Code' | 'FILLIN' | 'ESSAY' | 'CODE';

function toDbQuestionType(type: ApiQuestionType): DbQuestionType {
  switch (type) {
    case 'FILLIN':
      return 'Fill_in';
    case 'ESSAY':
      return 'Essay';
    case 'CODE':
      return 'Code';
    case 'MCQ':
    default:
      return 'MCQ';
  }
}

function toApiQuestionType(type: string): ApiQuestionType {
  const normalized = (type || '').trim();
  if (normalized === 'Fill_in') return 'FILLIN';
  if (normalized === 'Essay') return 'ESSAY';
  if (normalized === 'Code') return 'CODE';
  if (normalized === 'MCQ') return 'MCQ';
  // Already-new values or unknowns fallback
  if (normalized === 'FILLIN') return 'FILLIN';
  if (normalized === 'ESSAY') return 'ESSAY';
  if (normalized === 'CODE') return 'CODE';
  return 'MCQ';
}

function mapQuestionRowToApi(question: any): any {
  if (!question) return question;
  return {
    ...question,
    type: toApiQuestionType(question.type),
  };
}

export class QuestionService {
  /**
   * Create a new question
   */
  static async createQuestion(data: CreateQuestionRequest, userId: string): Promise<QuestionResponse> {
    try {
      // Get lecturer record
      const { data: lecturer, error: lecturerError } = await supabase
        .from('lecturers')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (lecturerError || !lecturer) {
        throw new AppError('Lecturer profile not found', 404);
      }

      // Verify assignment exists and belongs to lecturer
      const { data: assignment, error: assignmentError } = await supabase
        .from('assignments')
        .select('lecturer_id')
        .eq('id', data.assignment_id)
        .single();

      if (assignmentError || !assignment) {
        throw new AppError('Assignment not found', 404);
      }

      if (assignment.lecturer_id !== lecturer.id) {
        throw new AppError('You can only add questions to your own assignments', 403);
      }

      const questionData = {
        id: crypto.randomUUID(),
        assignment_id: data.assignment_id,
        type: toDbQuestionType(data.type),
        prompt_markdown: data.prompt_markdown,
        content_json: data.content_json || null,
        points: data.points || 1,
        order_index: data.order_index,
        created_at: new Date().toISOString(),
      };

      const { data: question, error } = await supabase
        .from('questions')
        .insert([questionData])
        .select()
        .single();

      if (error) {
        throw new AppError(`Failed to create question: ${error.message}`, 400);
      }

      return {
        success: true,
        message: 'Question created successfully',
        data: mapQuestionRowToApi(question),
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to create question', 500);
    }
  }

  /**
   * Get question by ID
   */
  static async getQuestionById(questionId: string): Promise<QuestionResponse> {
    try {
      const { data: question, error } = await supabase
        .from('questions')
        .select('*')
        .eq('id', questionId)
        .single();

      if (error || !question) {
        throw new AppError('Question not found', 404);
      }

      return {
        success: true,
        message: 'Question retrieved successfully',
        data: mapQuestionRowToApi(question),
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to retrieve question', 500);
    }
  }

  /**
   * Get all questions for an assignment
   */
  static async getQuestionsByAssignment(assignmentId: string): Promise<QuestionResponse> {
    try {
      const { data: questions, error } = await supabase
        .from('questions')
        .select('*')
        .eq('assignment_id', assignmentId)
        .order('order_index', { ascending: true });

      if (error) {
        throw new AppError(`Failed to retrieve questions: ${error.message}`, 400);
      }

      return {
        success: true,
        message: 'Questions retrieved successfully',
        data: (questions || []).map(mapQuestionRowToApi),
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to retrieve questions', 500);
    }
  }

  /**
   * Update question
   */
  static async updateQuestion(questionId: string, data: UpdateQuestionRequest, userId: string): Promise<QuestionResponse> {
    try {
      // Get lecturer record
      const { data: lecturer, error: lecturerError } = await supabase
        .from('lecturers')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (lecturerError || !lecturer) {
        throw new AppError('Lecturer profile not found', 404);
      }

      // Verify question exists and belongs to lecturer's assignment
      const { data: question, error: questionError } = await supabase
        .from('questions')
        .select(`
          *,
          assignments!questions_assignment_id_fkey(lecturer_id)
        `)
        .eq('id', questionId)
        .single();

      if (questionError || !question) {
        throw new AppError('Question not found', 404);
      }

      const assignment = (question as any).assignments;
      if (assignment.lecturer_id !== lecturer.id) {
        throw new AppError('You can only update questions in your own assignments', 403);
      }

      const updateData: any = {};
      if (data.type !== undefined) updateData.type = toDbQuestionType(data.type);
      if (data.prompt_markdown !== undefined) updateData.prompt_markdown = data.prompt_markdown;
      if (data.content_json !== undefined) updateData.content_json = data.content_json;
      if (data.points !== undefined) updateData.points = data.points;
      if (data.order_index !== undefined) updateData.order_index = data.order_index;

      const { data: updatedQuestion, error } = await supabase
        .from('questions')
        .update(updateData)
        .eq('id', questionId)
        .select()
        .single();

      if (error) {
        throw new AppError(`Failed to update question: ${error.message}`, 400);
      }

      return {
        success: true,
        message: 'Question updated successfully',
        data: mapQuestionRowToApi(updatedQuestion),
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to update question', 500);
    }
  }

  /**
   * Delete question
   */
  static async deleteQuestion(questionId: string, userId: string): Promise<QuestionResponse> {
    try {
      // Get lecturer record
      const { data: lecturer, error: lecturerError } = await supabase
        .from('lecturers')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (lecturerError || !lecturer) {
        throw new AppError('Lecturer profile not found', 404);
      }

      // Verify question exists and belongs to lecturer's assignment
      const { data: question, error: questionError } = await supabase
        .from('questions')
        .select(`
          *,
          assignments!questions_assignment_id_fkey(lecturer_id)
        `)
        .eq('id', questionId)
        .single();

      if (questionError || !question) {
        throw new AppError('Question not found', 404);
      }

      const assignment = (question as any).assignments;
      if (assignment.lecturer_id !== lecturer.id) {
        throw new AppError('You can only delete questions from your own assignments', 403);
      }

      const { error } = await supabase
        .from('questions')
        .delete()
        .eq('id', questionId);

      if (error) {
        throw new AppError(`Failed to delete question: ${error.message}`, 400);
      }

      return {
        success: true,
        message: 'Question deleted successfully',
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to delete question', 500);
    }
  }
}
