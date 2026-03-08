/**
 * GrokProvider — 공유 빌더/파서 사용
 *
 * 공유 패키지가 처리:
 * - Reasoning 모델 감지 (grok-4-1-fast)
 * - max_completion_tokens vs max_tokens 분기
 * - Reasoning 모델 temperature 차단
 */

import {
  BaseProvider,
  type GenerateRequest,
  type GenerateResponse,
} from './base-provider';
import {
  buildGrokBody,
  parseGrokResponse,
} from 'obsidian-llm-shared';

const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';

export class GrokProvider extends BaseProvider {
  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    if (!this.apiKey) {
      return {
        success: false,
        error: { message: 'Grok API 키가 설정되지 않았습니다.', code: 'NO_API_KEY' },
      };
    }

    try {
      const body = buildGrokBody(request.messages, this.modelId, {
        maxTokens: request.maxTokens,
        temperature: request.temperature,
      });

      const json = await this.httpRequest(
        GROK_API_URL,
        { Authorization: `Bearer ${this.apiKey}` },
        body
      );

      const result = parseGrokResponse(json);
      if (!result.success) {
        return { success: false, error: { message: result.error ?? 'Parse error', code: 'PARSE_ERROR' } };
      }

      return { success: true, content: result.text };
    } catch (error) {
      return { success: false, error: this.normalizeError(error) };
    }
  }
}
