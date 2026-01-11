/**
 * AIService
 * LLM 프로바이더를 통합 관리하는 싱글톤 서비스
 */

import type { BaseProvider } from '../../adapters/llm/base-provider';
import { ClaudeProvider } from '../../adapters/llm/claude-provider';
import { OpenAIProvider } from '../../adapters/llm/openai-provider';
import { GeminiProvider } from '../../adapters/llm/gemini-provider';
import { GrokProvider } from '../../adapters/llm/grok-provider';
import { isReasoningModel } from '../../domain/constants/model-configs';

export type AIProvider = 'claude' | 'openai' | 'gemini' | 'grok';

export interface AISettings {
  provider: AIProvider;
  apiKeys: Partial<Record<AIProvider, string>>;
  model: string;
}

export interface AIResponse {
  success: boolean;
  content?: string;
  error?: {
    message: string;
    code: string;
  };
}

export interface GenerateOptions {
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

// 싱글톤 인스턴스
let aiServiceInstance: AIService | null = null;

/**
 * AI 서비스 초기화
 */
export function initializeAIService(settings: AISettings): AIService {
  aiServiceInstance = new AIService(settings);
  return aiServiceInstance;
}

/**
 * AI 서비스 인스턴스 조회
 */
export function getAIService(): AIService | null {
  return aiServiceInstance;
}

/**
 * AI 서비스 설정 업데이트
 */
export function updateAIServiceSettings(settings: AISettings): void {
  if (aiServiceInstance) {
    aiServiceInstance.updateSettings(settings);
  }
}

/**
 * AI 서비스 초기화 (테스트용)
 */
export function resetAIService(): void {
  aiServiceInstance = null;
}

export class AIService {
  private provider: BaseProvider;
  private settings: AISettings;

  constructor(settings: AISettings) {
    this.settings = settings;
    this.provider = this.createProvider();
  }

  /**
   * 설정 업데이트
   */
  updateSettings(settings: AISettings): void {
    this.settings = settings;
    this.provider = this.createProvider();
  }

  /**
   * 프로바이더 생성
   */
  private createProvider(): BaseProvider {
    const apiKey = this.settings.apiKeys[this.settings.provider] || '';

    switch (this.settings.provider) {
      case 'claude':
        return new ClaudeProvider(apiKey, this.settings.model);
      case 'openai':
        return new OpenAIProvider(apiKey, this.settings.model);
      case 'gemini':
        return new GeminiProvider(apiKey, this.settings.model);
      case 'grok':
        return new GrokProvider(apiKey, this.settings.model);
      default:
        throw new Error(`Unknown provider: ${this.settings.provider}`);
    }
  }

  /**
   * 간단한 텍스트 생성
   */
  async simpleGenerate(
    prompt: string,
    systemPrompt?: string
  ): Promise<AIResponse> {
    // CRITICAL: Reasoning 모델은 temperature 미지원
    const isReasoning = isReasoningModel(this.settings.model);

    return this.provider.generate({
      messages: [
        ...(systemPrompt
          ? [{ role: 'system' as const, content: systemPrompt }]
          : []),
        { role: 'user' as const, content: prompt },
      ],
      temperature: isReasoning ? undefined : 0.7,
      maxTokens: 4096,
    });
  }

  /**
   * 옵션을 포함한 텍스트 생성
   */
  async generate(
    prompt: string,
    options?: GenerateOptions
  ): Promise<AIResponse> {
    // CRITICAL: Reasoning 모델은 temperature 미지원
    const isReasoning = isReasoningModel(this.settings.model);
    const temperature = isReasoning
      ? undefined
      : options?.temperature ?? 0.7;

    return this.provider.generate({
      messages: [
        ...(options?.systemPrompt
          ? [{ role: 'system' as const, content: options.systemPrompt }]
          : []),
        { role: 'user' as const, content: prompt },
      ],
      temperature,
      maxTokens: options?.maxTokens ?? 4096,
    });
  }

  /**
   * 현재 프로바이더 확인
   */
  getCurrentProvider(): AIProvider {
    return this.settings.provider;
  }

  /**
   * 현재 모델 확인
   */
  getCurrentModel(): string {
    return this.settings.model;
  }

  /**
   * API 키 설정 여부 확인
   */
  hasApiKey(): boolean {
    return !!this.settings.apiKeys[this.settings.provider];
  }

  /**
   * API 키 유효성 테스트
   * 간단한 API 호출로 키가 유효한지 확인
   */
  async testApiKey(): Promise<AIResponse> {
    try {
      const result = await this.provider.generate({
        messages: [{ role: 'user', content: 'Hello' }],
        maxTokens: 10,
      });
      return result;
    } catch (error) {
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          code: 'TEST_FAILED',
        },
      };
    }
  }
}

/**
 * API 키 테스트 (설정 화면용)
 * 임시 프로바이더를 생성해서 테스트
 */
export async function testApiKey(
  provider: AIProvider,
  apiKey: string,
  model: string
): Promise<AIResponse> {
  if (!apiKey) {
    return {
      success: false,
      error: {
        message: 'API key is empty',
        code: 'EMPTY_KEY',
      },
    };
  }

  let testProvider: BaseProvider;

  try {
    switch (provider) {
      case 'claude':
        testProvider = new ClaudeProvider(apiKey, model);
        break;
      case 'openai':
        testProvider = new OpenAIProvider(apiKey, model);
        break;
      case 'gemini':
        testProvider = new GeminiProvider(apiKey, model);
        break;
      case 'grok':
        testProvider = new GrokProvider(apiKey, model);
        break;
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }

    const result = await testProvider.generate({
      messages: [{ role: 'user', content: 'Say "OK" if you can read this.' }],
      maxTokens: 10,
    });

    return result;
  } catch (error) {
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'TEST_FAILED',
      },
    };
  }
}
