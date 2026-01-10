/**
 * CDC Plugin Types
 * 플러그인 설정 타입 및 기본값
 */

import type { AIProvider } from './core/application/services/ai-service';
import type { ClassificationMethod } from './core/domain/interfaces/domain-classifier';

// =============================================================================
// Settings Interface
// =============================================================================

export interface CDCSettings {
  // AI 설정
  ai: AISettings;

  // 발견 설정
  discovery: DiscoverySettings;

  // 고급 설정
  advanced: AdvancedSettings;
}

export interface AISettings {
  provider: AIProvider;
  apiKeys: Partial<Record<AIProvider, string>>;
  model: string;
}

export interface DiscoverySettings {
  minSimilarity: number;        // 최소 유사도 (기본 0.5)
  minSerendipityScore: number;  // 최소 창발성 점수 (기본 0.4)
  maxResults: number;           // 최대 결과 수 (기본 10)
  excludeFolders: string[];     // 제외 폴더
}

export interface AdvancedSettings {
  classificationMethod: ClassificationMethod;
  domainTagPrefixes: string[];  // 도메인 태그 접두사
  debugMode: boolean;
}

// =============================================================================
// Default Settings
// =============================================================================

export const DEFAULT_SETTINGS: CDCSettings = {
  ai: {
    provider: 'openai',
    apiKeys: {},
    model: 'gpt-4o-mini',
  },

  discovery: {
    minSimilarity: 0.5,
    minSerendipityScore: 0.4,
    maxResults: 10,
    excludeFolders: ['templates', 'attachments', '09_Embedded'],
  },

  advanced: {
    classificationMethod: 'tag',
    domainTagPrefixes: ['domain/', 'topic/'],
    debugMode: false,
  },
};

// =============================================================================
// Provider Models
// =============================================================================

export interface ModelOption {
  id: string;
  name: string;
  description?: string;
}

export const PROVIDER_MODELS: Record<AIProvider, ModelOption[]> = {
  claude: [
    { id: 'claude-opus-4-5-20251101', name: 'Claude Opus 4.5', description: 'Highest quality' },
    { id: 'claude-sonnet-4-5-20250514', name: 'Claude Sonnet 4.5', description: 'Balanced' },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', description: 'Fast' },
  ],
  openai: [
    { id: 'gpt-5.2', name: 'GPT-5.2', description: 'Latest flagship (Reasoning)' },
    { id: 'gpt-4o', name: 'GPT-4o', description: 'High quality' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast & economical' },
    { id: 'o3-mini', name: 'O3 Mini', description: 'Reasoning model' },
  ],
  gemini: [
    { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', description: 'Fast' },
    { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro', description: 'Highest quality' },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Stable' },
  ],
  grok: [
    { id: 'grok-4-1-fast', name: 'Grok 4.1 Fast', description: 'xAI latest' },
  ],
};

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * 설정 검증
 */
export function validateSettings(settings: CDCSettings): string[] {
  const errors: string[] = [];

  // 발견 설정 검증
  if (settings.discovery.minSimilarity < 0 || settings.discovery.minSimilarity > 1) {
    errors.push('Minimum similarity must be between 0 and 1.');
  }

  if (settings.discovery.minSerendipityScore < 0 || settings.discovery.minSerendipityScore > 1) {
    errors.push('Minimum serendipity score must be between 0 and 1.');
  }

  if (settings.discovery.maxResults < 1 || settings.discovery.maxResults > 100) {
    errors.push('Maximum results must be between 1 and 100.');
  }

  return errors;
}

/**
 * 설정 마이그레이션
 */
export function migrateSettings(oldSettings: Partial<CDCSettings>): CDCSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...oldSettings,
    ai: { ...DEFAULT_SETTINGS.ai, ...oldSettings.ai },
    discovery: { ...DEFAULT_SETTINGS.discovery, ...oldSettings.discovery },
    advanced: { ...DEFAULT_SETTINGS.advanced, ...oldSettings.advanced },
  };
}
