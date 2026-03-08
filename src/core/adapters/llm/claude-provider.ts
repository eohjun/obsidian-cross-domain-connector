/**
 * ClaudeProvider — 공유 빌더/파서 사용
 *
 * 공유 패키지가 처리:
 * - Extended thinking (Opus 4.6 adaptive / Sonnet 4.6 enabled)
 * - System 메시지 분리, thinking 블록 필터링
 */

import {
  BaseProvider,
  type GenerateRequest,
  type GenerateResponse,
} from './base-provider';
import {
  buildAnthropicBody,
  parseAnthropicResponse,
} from 'obsidian-llm-shared';

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

export class ClaudeProvider extends BaseProvider {
  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    if (!this.apiKey) {
      return {
        success: false,
        error: { message: 'Claude API 키가 설정되지 않았습니다.', code: 'NO_API_KEY' },
      };
    }

    try {
      const body = buildAnthropicBody(request.messages, this.modelId, {
        maxTokens: request.maxTokens,
        temperature: request.temperature,
      });

      const json = await this.httpRequest(
        CLAUDE_API_URL,
        {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body
      );

      const result = parseAnthropicResponse(json);
      if (!result.success) {
        return { success: false, error: { message: result.error ?? 'Parse error', code: 'PARSE_ERROR' } };
      }

      return { success: true, content: result.text };
    } catch (error) {
      return { success: false, error: this.normalizeError(error) };
    }
  }
}
