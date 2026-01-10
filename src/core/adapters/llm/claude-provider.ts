/**
 * ClaudeProvider
 * Claude (Anthropic) API 프로바이더
 */

import {
  BaseProvider,
  GenerateRequest,
  GenerateResponse,
  Message,
} from './base-provider';

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

export class ClaudeProvider extends BaseProvider {
  /**
   * Claude API로 텍스트 생성
   */
  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    if (!this.apiKey) {
      return {
        success: false,
        error: {
          message: 'Claude API 키가 설정되지 않았습니다.',
          code: 'NO_API_KEY',
        },
      };
    }

    try {
      // 메시지 변환 (system은 별도 파라미터)
      const { systemPrompt, messages } = this.convertMessages(request.messages);

      const requestBody: Record<string, unknown> = {
        model: this.modelId,
        messages,
        max_tokens: request.maxTokens ?? 4096,
      };

      // System prompt가 있으면 추가
      if (systemPrompt) {
        requestBody.system = systemPrompt;
      }

      // Temperature (Claude는 모든 모델 지원)
      if (request.temperature !== undefined) {
        requestBody.temperature = request.temperature;
      }

      const response = (await this.httpRequest(
        CLAUDE_API_URL,
        {
          'x-api-key': this.apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        requestBody
      )) as {
        content?: Array<{ type: string; text: string }>;
        error?: { message: string };
      };

      // 응답 파싱
      if (response.content && response.content.length > 0) {
        const textContent = response.content.find((c) => c.type === 'text');
        if (textContent) {
          return {
            success: true,
            content: textContent.text,
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
   * 메시지 변환 (system 분리)
   */
  private convertMessages(
    messages: Message[]
  ): { systemPrompt: string | null; messages: Array<{ role: string; content: string }> } {
    let systemPrompt: string | null = null;
    const convertedMessages: Array<{ role: string; content: string }> = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemPrompt = msg.content;
      } else {
        convertedMessages.push({
          role: msg.role,
          content: msg.content,
        });
      }
    }

    return { systemPrompt, messages: convertedMessages };
  }
}
