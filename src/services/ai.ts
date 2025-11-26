// AI service to communicate with external AI server
import config from '../config/index.ts';
import { AppError } from '../utils/errors.ts';
import logger from '../utils/logger.ts';

export interface FileInfo {
  id: string;
  name: string;
  path: string;
  folder: string;
  code: string;
  language: string;
}

export interface FileSystem {
  files: Record<string, FileInfo>;
  folders: string[];
  activeFileId?: string;
}

export interface ExplainRequest {
  file_system?: FileSystem;
  question: string;
  user_id: string;
  code_snippet?: string;
}

export interface ExplainResponse {
  answer: string;
}

export interface InteractionRequest {
  user_id: string;
  question: string;
}

export interface InteractionResponse {
  answer: string;
}

export interface AssessmentRequest {
  user_id: string;
  assessment: string;
  difficulty: 'beginner' | 'intermediate' | 'pro';
}

export interface AssessmentResponse {
  answer: string;
}

export interface AssessmentTopicRequest {
  questions_prompt: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'very_hard';
}

export interface Question {
  ID: string;
  question_prompt: string;
  options: Record<string, string>; // Keys are option letters (A-Z), values are option text
}

export interface AnswerOption {
  isCorrect: boolean;
  explanation: string;
}

export interface ScoringScheme {
  ID: string;
  answers: Record<string, AnswerOption>; // Keys are option letters (A-Z), values are answer details
}

export interface AssessmentTopicResponse {
  success: boolean;
  difficulty: string;
  question_count: number;
  questions: Question[];
  answers: Record<string, string>; // Question ID -> Answer letter (e.g., "1": "A")
  schemes: ScoringScheme[];
}

export interface AssessmentPdfRequest {
  pdf_text: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'very_hard';
}

export interface AssessmentPdfResponse {
  success: boolean;
  difficulty: string;
  question_count: number;
  questions: Question[];
  answers: Record<string, string>; // Question ID -> Answer letter (e.g., "1": "A")
  schemes: ScoringScheme[];
}

export class AIService {
  private static baseUrl: string;
  private static timeout: number;

  static initialize(): void {
    this.baseUrl = config.ai.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.timeout = config.ai.timeout;
    logger.info(`AI Service initialized with base URL: ${this.baseUrl}, timeout: ${this.timeout}ms`);
  }

  /**
   * Make a request to the AI server
   */
  private static async makeRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    body?: any
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const options: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      };

      if (body && (method === 'POST' || method === 'PUT')) {
        options.body = JSON.stringify(body);
      }

      logger.info(`Making ${method} request to AI server: ${url}`);
      if (body && (method === 'POST' || method === 'PUT')) {
        logger.debug(`Request body: ${JSON.stringify(body, null, 2)}`);
      }

      const response = await fetch(url, options);
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`AI server error: ${response.status} ${response.statusText} - ${errorText}`);
        
        // Try to parse error as JSON for better error messages
        let errorMessage = `AI server request failed: ${response.status} ${response.statusText}`;
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.error || errorJson.message || errorJson.detail) {
            const detailedError = errorJson.error || errorJson.message || errorJson.detail;
            errorMessage = `${errorMessage}. ${detailedError}`;
          }
        } catch {
          // If not JSON, use the text as is
          if (errorText && errorText.trim()) {
            errorMessage = `${errorMessage}. ${errorText}`;
          }
        }
        
        throw new AppError(errorMessage, response.status);
      }

      const data = await response.json();
      return data as T;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new AppError('AI server request timeout', 504);
        }
        logger.error(`AI server request error: ${error.message}`);
        throw new AppError(`Failed to communicate with AI server: ${error.message}`, 500);
      }
      
      throw new AppError('Unknown error communicating with AI server', 500);
    }
  }

  /**
   * Explain code or answer questions about code
   */
  static async explain(data: ExplainRequest): Promise<ExplainResponse> {
    return this.makeRequest<ExplainResponse>('/api/v1/explain', 'POST', data);
  }

  /**
   * General interaction/question answering
   */
  static async interaction(data: InteractionRequest): Promise<InteractionResponse> {
    return this.makeRequest<InteractionResponse>('/api/v1/interaction', 'POST', data);
  }

  /**
   * Generate assessment based on user input
   */
  static async assessment(data: AssessmentRequest): Promise<AssessmentResponse> {
    return this.makeRequest<AssessmentResponse>('/api/v1/assessment', 'POST', data);
  }

  /**
   * Generate assessment questions from a topic
   */
  static async assessmentTopic(data: AssessmentTopicRequest): Promise<AssessmentTopicResponse> {
    return this.makeRequest<AssessmentTopicResponse>('/api/v1/assessment/topic', 'POST', data);
  }

  /**
   * Generate assessment questions from PDF text
   */
  static async assessmentPdf(data: AssessmentPdfRequest): Promise<AssessmentPdfResponse> {
    return this.makeRequest<AssessmentPdfResponse>('/api/v1/assessment/pdf', 'POST', data);
  }
}

// Initialize on module load
AIService.initialize();

