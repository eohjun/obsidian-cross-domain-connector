/**
 * OpenAIProvider
 * OpenAI API 프로바이더
 *
 * CRITICAL: Reasoning 모델 (o1, o3, gpt-5.x)은 temperature 미지원!
 */

import {
  BaseProvider,
  GenerateRequest,
  GenerateResponse,
} from './base-provider';
import { isReasoningModel } from '../../domain/constants/model-configs';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

export class OpenAIProvider extends BaseProvider {
  /**
   * OpenAI API로 텍스트 생성
   */
  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    if (!this.apiKey) {
      return {
        success: false,
        error: {
          message: 'OpenAI API 키가 설정되지 않았습니다.',
          code: 'NO_API_KEY',
        },
      };
    }

    try {
      // CRITICAL: Reasoning 모델 체크
      const isReasoning = isReasoningModel(this.modelId);

      const requestBody: Record<string, unknown> = {
        model: this.modelId,
        messages: request.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      };

      // CRITICAL: Reasoning 모델은 temperature 미지원!
      if (isReasoning) {
        // max_completion_tokens 사용 (max_tokens 아님)
        requestBody.max_completion_tokens = request.maxTokens ?? 4096;
        // temperature 설정 안함!
      } else {
        // 일반 모델은 max_tokens와 temperature 사용
        requestBody.max_tokens = request.maxTokens ?? 4096;
        if (request.temperature !== undefined) {
          requestBody.temperature = request.temperature;
        }
      }

      const response = (await this.httpRequest(
        OPENAI_API_URL,
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
