/**
 * GrokProvider
 * xAI Grok API 프로바이더
 */

import {
  BaseProvider,
  GenerateRequest,
  GenerateResponse,
} from './base-provider';

const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';

export class GrokProvider extends BaseProvider {
  /**
   * Grok API로 텍스트 생성
   */
  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    if (!this.apiKey) {
      return {
        success: false,
        error: {
          message: 'Grok API 키가 설정되지 않았습니다.',
          code: 'NO_API_KEY',
        },
      };
    }

    try {
      const requestBody: Record<string, unknown> = {
        model: this.modelId,
        messages: request.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        max_tokens: request.maxTokens ?? 4096,
      };

      // Temperature 설정
      if (request.temperature !== undefined) {
        requestBody.temperature = request.temperature;
      }

      const response = (await this.httpRequest(
        GROK_API_URL,
        {
          Authorization: `Bearer ${this.apiKey}`,
        },
        requestBody
      )) as {
        choices?: Array<{ message: { content: string } }>;
        error?: { message: string };
      };

      // 응답 파싱
      if (response.choices && response.choices.length > 0) {
        const content = response.choices[0].message.content;
        return {
          success: true,
          content,
        };
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
}
