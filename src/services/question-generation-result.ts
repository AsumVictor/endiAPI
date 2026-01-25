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

/**
 * Find the next available order_index by checking the database
 * This handles concurrent replicas processing different batches
 */
async function findNextAvailableOrderIndex(
  assignmentId: string,
  isCodeQuestion: boolean,
  startFrom: number,
  usedInBatch: Set<number>
): Promise<number> {
  let candidate = startFrom + 1;
  const maxAttempts = 1000; // Safety limit
  let attempts = 0;

  while (attempts < maxAttempts) {
    // Skip if already used in this batch
    if (usedInBatch.has(candidate)) {
      candidate++;
      attempts++;
      continue;
    }

    // Check if this order_index exists in database
    let checkQuery = supabase
      .from('questions')
      .select('id')
      .eq('assignment_id', assignmentId)
      .eq('order_index', candidate);

    if (isCodeQuestion) {
      checkQuery = checkQuery.eq('type', 'Code');
    } else {
      checkQuery = checkQuery.in('type', ['MCQ', 'Fill_in', 'Essay']);
    }

    const { data: existing, error } = await checkQuery.limit(1);

    if (error) {
      logger.error('Error checking order_index availability', {
        assignmentId,
        candidate,
        error: error.message,
      });
      // On error, increment and try next (safer than reusing)
      candidate++;
      attempts++;
      continue;
    }

    if (!existing || existing.length === 0) {
      // Available!
      return candidate;
    }

    // Conflict found, try next
    candidate++;
    attempts++;
  }

  // Fallback: if we exhausted attempts, return the candidate anyway
  // (shouldn't happen in practice, but better than infinite loop)
  logger.warn('Exceeded max attempts finding available order_index, using candidate', {
    assignmentId,
    candidate,
    isCodeQuestion,
  });
  return candidate;
}

export class QuestionGenerationResultService {
  static async process(result: JobResultMessageLike): Promise<void> {
    try {
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

    // Get the maximum order_index for this assignment
    // IMPORTANT: MCQ, FILLIN, ESSAY share the same sequence (1..n) - they're "non-code" questions
    // CODE questions have their own separate sequence (1..n)
    const { data: existingQuestions, error: maxOrderError } = await supabase
      .from('questions')
      .select('type, order_index')
      .eq('assignment_id', assignmentId);

    if (maxOrderError) {
      logger.warn('Failed to fetch existing questions for order_index calculation', {
        assignmentId,
        error: maxOrderError.message,
      });
    }

    // Calculate max order_index for non-code questions (MCQ, FILLIN, ESSAY share sequence)
    // and for code questions (CODE has separate sequence)
    let maxOrderIndexNonCode = 0; // For MCQ, FILLIN, ESSAY
    let maxOrderIndexCode = 0;    // For CODE
    
    if (existingQuestions && existingQuestions.length > 0) {
      for (const q of existingQuestions) {
        const dbType = q.type as DbQuestionType;
        const orderIndex = (q as any).order_index || 0;
        
        if (dbType === 'Code') {
          // CODE questions have their own sequence
          if (orderIndex > maxOrderIndexCode) {
            maxOrderIndexCode = orderIndex;
          }
        } else {
          // MCQ, Fill_in, Essay share the same sequence
          if (orderIndex > maxOrderIndexNonCode) {
            maxOrderIndexNonCode = orderIndex;
          }
        }
      }
    }

    logger.debug('Starting order_index calculation', {
      assignmentId,
      maxOrderIndexNonCode, // For MCQ, FILLIN, ESSAY
      maxOrderIndexCode,    // For CODE
      questionCount: questions.length,
    });

    // Insert questions (idempotent by prompt_markdown content check, not just order_index)
    let insertedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    // Track used order_indices in this batch
    // Non-code questions (MCQ, FILLIN, ESSAY) share the same set
    // Code questions have their own set
    const usedOrderIndicesNonCode = new Set<number>();
    const usedOrderIndicesCode = new Set<number>();
    
    for (const [i, q] of questions.entries()) {
      const promptMarkdown = q?.prompt_markdown || '';

      if (!promptMarkdown) {
        logger.warn('Skipping generated question with missing prompt_markdown', {
          assignmentId,
          index: i,
          questionType: q?.type,
        });
        skippedCount++;
        continue;
      }

      const apiType = normalizeQuestionType(q?.type);
      const dbType = toDbQuestionType(apiType);
      const isCodeQuestion = dbType === 'Code';

      // Get max order_index and used indices for this question category
      // NOTE: maxOrderIndex is just a starting point - we must check DB for each assignment
      // to handle concurrent replicas processing different batches
      const maxOrderIndex = isCodeQuestion ? maxOrderIndexCode : maxOrderIndexNonCode;
      const usedOrderIndices = isCodeQuestion ? usedOrderIndicesCode : usedOrderIndicesNonCode;

      // Determine order_index: use provided if valid and unique, otherwise assign sequentially
      // CRITICAL: For concurrent safety, we check the database for each assignment
      let orderIndex: number | null = null;
      const providedOrderIndex = typeof q?.order_index === 'number' ? q.order_index : null;
      
      if (providedOrderIndex !== null && providedOrderIndex > 0) {
        // Check if this order_index conflicts with what we've already assigned in this batch
        const conflictsInBatch = usedOrderIndices.has(providedOrderIndex);
        
        if (!conflictsInBatch) {
          // Check database to see if this order_index is available (handles concurrent replicas)
          let checkQuery = supabase
            .from('questions')
            .select('id')
            .eq('assignment_id', assignmentId)
            .eq('order_index', providedOrderIndex);
          
          if (isCodeQuestion) {
            checkQuery = checkQuery.eq('type', 'Code');
          } else {
            checkQuery = checkQuery.in('type', ['MCQ', 'Fill_in', 'Essay']);
          }
          
          const { data: existingCheck, error: checkError } = await checkQuery.limit(1);
          
          if (checkError) {
            logger.error('Failed to check order_index availability in DB', {
              assignmentId,
              orderIndex: providedOrderIndex,
              type: dbType,
              error: checkError.message,
            });
            // Fall through to auto-assign
            orderIndex = null;
          } else if (existingCheck && existingCheck.length > 0) {
            // Conflict in DB - will fall through to auto-assign
            logger.debug('Provided order_index conflicts with existing question in DB', {
              assignmentId,
              providedOrderIndex,
              type: dbType,
            });
            orderIndex = null;
          } else {
            // Available - use provided order_index
            orderIndex = providedOrderIndex;
          }
        } else {
          // Conflict in batch - will auto-assign
          orderIndex = null;
        }
      }
      
      // If we didn't set orderIndex above (due to conflict or no provided), assign next available
      if (!orderIndex) {
        // Find next available order_index by checking database
        orderIndex = await findNextAvailableOrderIndex(
          assignmentId,
          isCodeQuestion,
          maxOrderIndex,
          usedOrderIndices
        );
        if (providedOrderIndex) {
          logger.debug('Order index conflict detected, using next available from DB', {
            assignmentId,
            type: dbType,
            category: isCodeQuestion ? 'code' : 'non-code',
            providedOrderIndex,
            assignedOrderIndex: orderIndex,
            maxOrderIndex,
            index: i,
          });
        }
      }

      // Mark this order_index as used in this batch
      usedOrderIndices.add(orderIndex);
      
      // Update the max for this category (for next questions in batch)
      if (isCodeQuestion) {
        if (orderIndex > maxOrderIndexCode) {
          maxOrderIndexCode = orderIndex;
        }
      } else {
        if (orderIndex > maxOrderIndexNonCode) {
          maxOrderIndexNonCode = orderIndex;
        }
      }

      logger.debug('Processing question for insert', {
        assignmentId,
        orderIndex,
        providedOrderIndex,
        apiType,
        dbType,
        hasContentJson: !!q?.content_json,
        hasAnswers: !!q?.answers,
        hasExplanation: !!q?.explanation,
        index: i,
      });

      const mergedContentJson: Record<string, unknown> = {
        ...((q?.content_json as Record<string, unknown> | undefined) || {}),
      };

      // Check for duplicate by prompt_markdown content (more reliable than just order_index)
      // This prevents inserting the same question multiple times even if order_index differs
      const { data: existingByContent, error: existingByContentError } = await supabase
        .from('questions')
        .select('id, type, order_index')
        .eq('assignment_id', assignmentId)
        .eq('prompt_markdown', promptMarkdown)
        .limit(1);

      if (existingByContentError) {
        logger.error('Failed to check for existing question by content', {
          assignmentId,
          orderIndex,
          type: dbType,
          error: existingByContentError.message,
        });
        errorCount++;
        continue;
      }

      if (existingByContent && existingByContent.length > 0) {
        logger.info('Question with same prompt_markdown already exists, skipping insert', {
          assignmentId,
          orderIndex,
          providedOrderIndex,
          type: dbType,
          existingQuestionId: (existingByContent as any)[0]?.id,
          existingOrderIndex: (existingByContent as any)[0]?.order_index,
        });
        skippedCount++;
        continue;
      }

      // Check if this order_index already exists
      // For non-code questions (MCQ, FILLIN, ESSAY): check if ANY non-code question has this order_index
      // For code questions (CODE): check if ANY code question has this order_index
      let existingByOrderQuery = supabase
        .from('questions')
        .select('id, type')
        .eq('assignment_id', assignmentId)
        .eq('order_index', orderIndex);

      if (isCodeQuestion) {
        // CODE questions: check only CODE type
        existingByOrderQuery = existingByOrderQuery.eq('type', 'Code');
      } else {
        // Non-code questions: check MCQ, Fill_in, and Essay (they share the same sequence)
        existingByOrderQuery = existingByOrderQuery.in('type', ['MCQ', 'Fill_in', 'Essay']);
      }

      const { data: existingByOrder, error: existingByOrderError } = await existingByOrderQuery.limit(1);

      if (existingByOrderError) {
        logger.error('Failed to check for existing question by order_index', {
          assignmentId,
          orderIndex,
          type: dbType,
          category: isCodeQuestion ? 'code' : 'non-code',
          error: existingByOrderError.message,
        });
        errorCount++;
        continue;
      }

      if (existingByOrder && existingByOrder.length > 0) {
        logger.info('Question with same order_index already exists in shared sequence, skipping insert', {
          assignmentId,
          orderIndex,
          type: dbType,
          category: isCodeQuestion ? 'code' : 'non-code',
          existingQuestionId: (existingByOrder as any)[0]?.id,
          existingQuestionType: (existingByOrder as any)[0]?.type,
        });
        skippedCount++;
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

      logger.debug('Attempting to insert question', {
        assignmentId,
        orderIndex,
        type: dbType,
        questionRowKeys: Object.keys(questionRow),
        contentJsonKeys: Object.keys(mergedContentJson),
        answersType: Array.isArray(q?.answers) ? 'array' : typeof q?.answers,
      });

      const { error: insertError, data: insertedData } = await supabase
        .from('questions')
        .insert([questionRow])
        .select('id');

      if (insertError) {
        logger.error('Failed to insert generated question', {
          assignmentId,
          orderIndex,
          type: apiType,
          dbType,
          error: insertError.message,
          errorCode: insertError.code,
          errorDetails: insertError.details,
          errorHint: insertError.hint,
          questionRow: JSON.stringify(questionRow, null, 2),
        });
        errorCount++;
        // Continue processing other questions instead of throwing
        continue;
      }

      if (insertedData && insertedData.length > 0) {
        logger.info('Successfully inserted question', {
          assignmentId,
          orderIndex,
          questionId: insertedData[0]?.id,
          type: dbType,
        });
        insertedCount++;
      } else {
        logger.warn('Insert returned no data but no error', {
          assignmentId,
          orderIndex,
          type: dbType,
        });
        errorCount++;
      }
    }

    logger.info('Question insertion summary', {
      assignmentId,
      runId,
      insertedCount,
      skippedCount,
      errorCount,
      receivedCount: questions.length,
    });

    if (errorCount > 0) {
      logger.error('Some questions failed to insert', {
        assignmentId,
        runId,
        errorCount,
        totalQuestions: questions.length,
      });
    }

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
    } catch (error) {
      logger.error('Error in QuestionGenerationResultService.process', {
        runId: result.jobId,
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        payload: result.payload,
      });
      // Re-throw to let consumer handle retry logic
      throw error;
    }
  }
}

