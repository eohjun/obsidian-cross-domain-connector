/**
 * BaseProvider
 * LLM 프로바이더 공통 기능 추상 클래스
 *
 * CRITICAL: HTTP 요청은 반드시 Obsidian의 requestUrl 사용
 */

import { requestUrl } from 'obsidian';

export type MessageRole = 'system' | 'user' | 'assistant';

export interface Message {
  role: MessageRole;
  content: string;
}

export interface GenerateRequest {
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
}

export interface GenerateResponse {
  success: boolean;
  content?: string;
  error?: {
    message: string;
    code: string;
  };
}

export abstract class BaseProvider {
  constructor(
    protected apiKey: string,
    protected modelId: string
  ) {}

  /**
   * 텍스트 생성 (추상 메서드)
   */
  abstract generate(request: GenerateRequest): Promise<GenerateResponse>;

  /**
   * HTTP 요청 헬퍼
   * CRITICAL: Obsidian의 requestUrl 사용 (fetch 금지)
   */
  protected async httpRequest(
    url: string,
    headers: Record<string, string>,
    body: unknown
  ): Promise<unknown> {
    const response = await requestUrl({
      url,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(body),
    });

    return response.json;
  }

  /**
   * 에러 정규화
   * HTTP 코드별 사용자 친화적 메시지 반환
   */
  protected normalizeError(error: unknown): { message: string; code: string } {
    console.error('[CDC] API Error:', error);

    if (error instanceof Error) {
      const message = error.message;

      // Rate limit
      if (message.includes('429') || message.includes('rate')) {
        return {
          message: 'API 요청 한도 초과. 잠시 후 다시 시도해주세요.',
          code: 'RATE_LIMIT',
        };
      }

      // Auth error
      if (message.includes('401') || message.includes('403')) {
        return {
          message: 'API 키가 유효하지 않습니다. 설정에서 확인해주세요.',
          code: 'AUTH_ERROR',
        };
      }

      // Timeout
      if (message.includes('timeout') || message.includes('ETIMEDOUT')) {
        return {
          message: '요청 시간이 초과되었습니다. 네트워크를 확인해주세요.',
          code: 'TIMEOUT',
        };
      }

      // Model not found
      if (message.includes('404') || message.includes('model')) {
        return {
          message: '선택한 모델을 찾을 수 없습니다.',
          code: 'MODEL_NOT_FOUND',
        };
      }

      return { message: message, code: 'UNKNOWN' };
    }

    return { message: '알 수 없는 오류가 발생했습니다.', code: 'UNKNOWN' };
  }
}
