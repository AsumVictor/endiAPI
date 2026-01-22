import { supabase } from '../config/database.js';
import logger from '../utils/logger.js';
import { appendFile } from 'node:fs/promises';
import { webSocketService } from './websocket.js';
import * as NotificationHelper from './notification-helper.js';
import crypto from 'node:crypto';

export type QuestionType = 'MCQ' | 'FILLIN' | 'ESSAY' | 'CODE';
type DbQuestionType = 'MCQ' | 'Fill_in' | 'Essay' | 'Code' | 'FILLIN' | 'ESSAY' | 'CODE';

export interface GeneratedQuestionPayload {
  assignment_id?: string;
  order_index?: number;
  prompt_markdown?: string;
  content_json?: Record<string, unknown>;
  explanation?: string;
  answers?: string | string[];
  type?: string;
}

export interface JobResultMessageLike {
  jobId: string;
  job_type: string;
  payload: any;
  status: string;
}

function normalizeQuestionType(type: string | undefined | null): QuestionType {
  const t = (type || '').trim().toUpperCase().replace(/[^A-Z]/g, '');
  if (t === 'FILLIN') return 'FILLIN';
  if (t === 'ESSAY') return 'ESSAY';
  if (t === 'CODE') return 'CODE';
  return 'MCQ';
}

function toDbQuestionType(type: QuestionType): DbQuestionType {
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

function extractGeneratedQuestions(payload: any): GeneratedQuestionPayload[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as GeneratedQuestionPayload[];
  if (Array.isArray(payload.questions)) return payload.questions as GeneratedQuestionPayload[];
  if (payload.data) {
    if (Array.isArray(payload.data)) return payload.data as GeneratedQuestionPayload[];
    if (Array.isArray(payload.data.questions)) return payload.data.questions as GeneratedQuestionPayload[];
  }
  return [];
}

function extractAssignmentIdFromJobId(jobId: string): string | null {
  const match = jobId.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  return match ? match[0] : null;
}

export class QuestionGenerationResultService {
  static async process(result: JobResultMessageLike): Promise<void> {
    const runId = result.jobId;
    const rawPayload: any = result.payload as any;
    const questions = extractGeneratedQuestions(rawPayload);

    if (!runId) {
      logger.error('Question generation result missing jobId', { result });
      return;
    }

    // Derive assignmentId from payload first (most reliable), else parse UUID from runId
    const assignmentId =
      (questions[0]?.assignment_id as string | undefined) ||
      (rawPayload?.assignment_id as string | undefined) ||
      (rawPayload?.data?.assignment_id as string | undefined) ||
      extractAssignmentIdFromJobId(runId) ||
      '';

    if (!assignmentId) {
      logger.error('Question generation result missing assignment_id (cannot process)', {
        runId,
        job_type: result.job_type,
      });
      return;
    }

    // Always log full payload to inspect.log for debugging (one JSON per line)
    try {
      await appendFile(
        'logs/inspect.log',
        JSON.stringify({ runId, assignmentId, job_type: result.job_type, payload: rawPayload }) + '\n'
      );
    } catch (e) {
      logger.warn('Failed to append inspect.log for question generation payload', {
        assignmentId,
        runId,
        error: e instanceof Error ? e.message : e,
      });
    }

    if (!questions || questions.length === 0) {
      logger.warn('Question generation result payload contained no questions', {
        assignmentId,
        runId,
        status: result.status,
        payloadKeys: rawPayload && typeof rawPayload === 'object' ? Object.keys(rawPayload) : undefined,
      });
      return;
    }

    logger.info('Processing question generation result', {
      assignmentId,
      runId,
      questionCount: questions.length,
      status: result.status,
    });

    // Insert questions (idempotent by (assignment_id, order_index) check)
    let insertedCount = 0;
    for (const [i, q] of questions.entries()) {
      const orderIndex = typeof q?.order_index === 'number' ? q.order_index : i + 1;
      const promptMarkdown = q?.prompt_markdown || '';

      if (!promptMarkdown) {
        logger.warn('Skipping generated question with missing prompt_markdown', {
          assignmentId,
          orderIndex,
        });
        continue;
      }

      const apiType = normalizeQuestionType(q?.type);
      const dbType = toDbQuestionType(apiType);

      const mergedContentJson: Record<string, unknown> = {
        ...((q?.content_json as Record<string, unknown> | undefined) || {}),
      };

      const { data: existing, error: existingError } = await supabase
        .from('questions')
        .select('id')
        .eq('assignment_id', assignmentId)
        .eq('order_index', orderIndex)
        .limit(1);

      if (existingError) {
        logger.error('Failed to check for existing question', {
          assignmentId,
          orderIndex,
          error: existingError.message,
        });
        throw existingError;
      }

      if (existing && existing.length > 0) {
        logger.info('Question already exists, skipping insert', {
          assignmentId,
          orderIndex,
          existingQuestionId: (existing as any)[0]?.id,
        });
        continue;
      }

      const questionRow = {
        id: crypto.randomUUID(),
        assignment_id: assignmentId,
        type: dbType,
        prompt_markdown: promptMarkdown,
        content_json: mergedContentJson,
        explanation: q?.explanation ?? null,
        answers: q?.answers ?? null,
        points: 1,
        order_index: orderIndex,
        created_at: new Date().toISOString(),
      };

      const { error: insertError } = await supabase.from('questions').insert([questionRow]);

      if (insertError) {
        logger.error('Failed to insert generated question', {
          assignmentId,
          orderIndex,
          type: apiType,
          error: insertError.message,
        });
        throw insertError;
      }

      insertedCount++;
    }

    logger.info('Inserted generated questions', {
      assignmentId,
      runId,
      insertedCount,
      receivedCount: questions.length,
    });

    // If nothing new was inserted, treat this as a retry/duplicate and do NOT advance generated_types.
    if (insertedCount === 0) {
      logger.warn('No new questions inserted for generation result; skipping progress increment', {
        assignmentId,
        runId,
      });
      return;
    }

    // Update assignment generated_types (+1 per result message)
    const { data: assignment, error: assignmentError } = await supabase
      .from('assignments')
      .select('id, lecturer_id, course_id, title, total_types, generated_types, status')
      .eq('id', assignmentId)
      .single();

    if (assignmentError || !assignment) {
      logger.error('Assignment not found while processing question generation result', {
        assignmentId,
        error: assignmentError?.message,
      });
      return;
    }

    const totalTypes = (assignment as any).total_types ?? 0;
    const currentGenerated = (assignment as any).generated_types ?? 0;
    const nextGenerated = currentGenerated + 1;
    const shouldFinalize = totalTypes > 0 && nextGenerated >= totalTypes;

    const updateData: any = {
      generated_types: nextGenerated,
      updated_at: new Date().toISOString(),
    };
    if (shouldFinalize) {
      updateData.status = 'ready_for_review';
    }

    const { data: updatedAssignment, error: updateError } = await supabase
      .from('assignments')
      .update(updateData)
      .eq('id', assignmentId)
      .select('id, lecturer_id, course_id, title, total_types, generated_types, status')
      .single();

    if (updateError || !updatedAssignment) {
      logger.error('Failed to update assignment generation progress', {
        assignmentId,
        error: updateError?.message,
      });
      return;
    }

    logger.info('Updated assignment generation progress', {
      assignmentId,
      total_types: (updatedAssignment as any).total_types,
      generated_types: (updatedAssignment as any).generated_types,
      status: (updatedAssignment as any).status,
    });

    // If we just finished all types, notify lecturer
    if (shouldFinalize) {
      const lecturerId = (updatedAssignment as any).lecturer_id as string;

      const { data: lecturer, error: lecturerError } = await supabase
        .from('lecturers')
        .select('user_id')
        .eq('id', lecturerId)
        .single();

      if (lecturerError || !lecturer?.user_id) {
        logger.error('Failed to load lecturer user_id for assignment notification', {
          assignmentId,
          lecturerId,
          error: lecturerError?.message,
        });
        return;
      }

      const lecturerUserId = lecturer.user_id as string;
      const notification = (NotificationHelper as any).createAssignmentReadyForReviewNotification(assignmentId, {
        assignmentTitle: (updatedAssignment as any).title,
        courseId: (updatedAssignment as any).course_id,
      });

      webSocketService.notifyUser(lecturerUserId, notification, {
        userId: lecturerUserId,
        priority: 'high',
        category: 'assignment',
      });

      logger.info('Lecturer notified: assignment ready for review', {
        assignmentId,
        lecturerUserId,
      });
    }
  }
}

