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
  includeFolders: string[];     // 검색 대상 폴더 (빈 배열이면 전체)
  // Deep Serendipity (LLM-First) 설정
  deepMaxPairs: number;         // LLM에 보낼 최대 쌍 수 (기본 30)
  deepMinQuality: number;       // 최소 품질 점수 (기본 0.5)
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
    includeFolders: ['04_Zettelkasten'],  // 기본: Zettelkasten 폴더만 검색
    deepMaxPairs: 30,     // Deep 모드: LLM에 보낼 최대 쌍 수
    deepMinQuality: 0.5,  // Deep 모드: 최소 품질 점수
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
// Cache Types
// =============================================================================

import type { CrossDomainConnection } from './core/domain/entities/cross-domain-connection';
import { SerendipityScore } from './core/domain/value-objects/serendipity-score';
import { DomainDistance } from './core/domain/value-objects/domain-distance';

export interface SerendipityCache {
  connections: CrossDomainConnection[];
  timestamp: number;
}

// Deep Serendipity 결과 캐시 (LLM-First 모드용)
export interface DeepSerendipityCache {
  connections: DeepSerendipityCacheItem[];
  timestamp: number;
}

export interface DeepSerendipityCacheItem {
  sourceNote: {
    noteId: string;
    path: string;
    title: string;
    primaryDomain: string;
    tags: string[];
  };
  targetNote: {
    noteId: string;
    path: string;
    title: string;
    primaryDomain: string;
    tags: string[];
  };
  creativityScore: number;
  analogy: string;
  domainDistance: number;
  discoveredAt: string;
}

/**
 * JSON에서 로드한 plain object를 CrossDomainConnection으로 hydrate
 * 클래스 인스턴스(SerendipityScore, DomainDistance, Date)를 복원
 */
export function hydrateConnection(plain: Record<string, unknown>): CrossDomainConnection {
  const serendipityValue = (plain.serendipityScore as { value: number })?.value ?? 0;
  const domainDistanceValue = (plain.domainDistance as { value: number })?.value ?? 0;

  return {
    sourceNote: plain.sourceNote as CrossDomainConnection['sourceNote'],
    targetNote: plain.targetNote as CrossDomainConnection['targetNote'],
    serendipityScore: SerendipityScore.fromValue(serendipityValue),
    domainDistance: DomainDistance.fromValue(domainDistanceValue),
    similarity: plain.similarity as number,
    connectionType: plain.connectionType as CrossDomainConnection['connectionType'],
    analogy: plain.analogy as string | undefined,
    discoveredAt: new Date(plain.discoveredAt as string),
  };
}

/**
 * SerendipityCache를 hydrate
 */
export function hydrateSerendipityCache(plain: Record<string, unknown>): SerendipityCache {
  const connections = (plain.connections as Record<string, unknown>[]) || [];
  return {
    connections: connections.map(hydrateConnection),
    timestamp: plain.timestamp as number,
  };
}

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
