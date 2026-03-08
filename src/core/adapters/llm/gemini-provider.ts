/**
 * GeminiProvider — 공유 빌더/파서 사용
 *
 * 공유 패키지가 처리:
 * - systemInstruction 분리 (system → user 병합 대신)
 * - assistant → model 역할 변환
 * - 안전한 optional chaining 파싱
 */

import {
  BaseProvider,
  type GenerateRequest,
  type GenerateResponse,
} from './base-provider';
import {
  buildGeminiBody,
  parseGeminiResponse,
  getGeminiGenerateUrl,
} from 'obsidian-llm-shared';

export class GeminiProvider extends BaseProvider {
  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    if (!this.apiKey) {
      return {
        success: false,
        error: { message: 'Gemini API 키가 설정되지 않았습니다.', code: 'NO_API_KEY' },
      };
    }

    try {
      const body = buildGeminiBody(request.messages, this.modelId, {
        maxTokens: request.maxTokens,
        temperature: request.temperature,
      });

      const url = getGeminiGenerateUrl(this.modelId, this.apiKey);

      const json = await this.httpRequest(url, {}, body);

      const result = parseGeminiResponse(json);
      if (!result.success) {
        return { success: false, error: { message: result.error ?? 'Parse error', code: 'PARSE_ERROR' } };
      }

      return { success: true, content: result.text };
    } catch (error) {
      return { success: false, error: this.normalizeError(error) };
    }
  }
}
