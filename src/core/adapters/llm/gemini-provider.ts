/**
 * GeminiProvider
 * Google Gemini API 프로바이더
 */

import {
  BaseProvider,
  GenerateRequest,
  GenerateResponse,
  Message,
} from './base-provider';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export class GeminiProvider extends BaseProvider {
  /**
   * Gemini API로 텍스트 생성
   */
  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    if (!this.apiKey) {
      return {
        success: false,
        error: {
          message: 'Gemini API 키가 설정되지 않았습니다.',
          code: 'NO_API_KEY',
        },
      };
    }

    try {
      const url = `${GEMINI_API_BASE}/${this.modelId}:generateContent?key=${this.apiKey}`;

      // 메시지 변환
      const contents = this.convertMessages(request.messages);

      const requestBody: Record<string, unknown> = {
        contents,
        generationConfig: {
          maxOutputTokens: request.maxTokens ?? 4096,
        },
      };

      // Temperature 설정
      if (request.temperature !== undefined) {
        (requestBody.generationConfig as Record<string, unknown>).temperature =
          request.temperature;
      }

      const response = (await this.httpRequest(url, {}, requestBody)) as {
        candidates?: Array<{
          content: { parts: Array<{ text: string }> };
        }>;
        error?: { message: string };
      };

      // 응답 파싱
      if (response.candidates && response.candidates.length > 0) {
        const parts = response.candidates[0].content.parts;
        if (parts && parts.length > 0) {
          return {
            success: true,
            content: parts.map((p) => p.text).join(''),
          };
        }
      }

      if (response.error) {
        return {
          success: false,
          error: {
            message: response.error.message,
            code: 'API_ERROR',
          },
        };
      }

      return {
        success: false,
        error: {
          message: '응답을 파싱할 수 없습니다.',
          code: 'PARSE_ERROR',
        },
      };
    } catch (error) {
      return {
        success: false,
        error: this.normalizeError(error),
      };
    }
  }

  /**
   * 메시지 변환 (Gemini 형식)
   */
  private convertMessages(
    messages: Message[]
  ): Array<{ role: string; parts: Array<{ text: string }> }> {
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    // System 메시지는 첫 번째 user 메시지에 포함
    let systemContent = '';

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemContent = msg.content;
      } else if (msg.role === 'user') {
        const text = systemContent
          ? `${systemContent}\n\n${msg.content}`
          : msg.content;
        contents.push({
          role: 'user',
          parts: [{ text }],
        });
        systemContent = ''; // 첫 user 메시지에만 추가
      } else if (msg.role === 'assistant') {
        contents.push({
          role: 'model',
          parts: [{ text: msg.content }],
        });
      }
    }

    return contents;
  }
}
