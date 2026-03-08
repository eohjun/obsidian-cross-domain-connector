/**
 * OpenAIProvider — 공유 빌더/파서 사용
 */

import {
  BaseProvider,
  type GenerateRequest,
  type GenerateResponse,
} from './base-provider';
import {
  buildOpenAIBody,
  parseOpenAIResponse,
} from 'obsidian-llm-shared';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

export class OpenAIProvider extends BaseProvider {
  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    if (!this.apiKey) {
      return {
        success: false,
        error: { message: 'OpenAI API 키가 설정되지 않았습니다.', code: 'NO_API_KEY' },
      };
    }

    try {
      const body = buildOpenAIBody(request.messages, this.modelId, {
        maxTokens: request.maxTokens,
        temperature: request.temperature,
      });

      const json = await this.httpRequest(
        OPENAI_API_URL,
        { Authorization: `Bearer ${this.apiKey}` },
        body
      );

      const result = parseOpenAIResponse(json);
      if (!result.success) {
        return { success: false, error: { message: result.error ?? 'Parse error', code: 'PARSE_ERROR' } };
      }

      return { success: true, content: result.text };
    } catch (error) {
      return { success: false, error: this.normalizeError(error) };
    }
  }
}
