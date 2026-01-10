/**
 * CrossDomainConnection Entity
 * 서로 다른 도메인의 노트 간 연결을 나타내는 엔티티
 */

import type { NoteDomain } from './note-domain';
import type { SerendipityScore } from '../value-objects/serendipity-score';
import type { DomainDistance } from '../value-objects/domain-distance';

/**
 * 연결 유형
 */
export type ConnectionType =
  | 'unexpected_similarity'   // 다른 도메인인데 유사
  | 'bridging_concept'        // 두 도메인을 연결하는 개념
  | 'analogical'              // 구조적 유사성
  | 'contrasting';            // 대조적 관점

/**
 * CrossDomainConnection 인터페이스
 */
export interface CrossDomainConnection {
  /** 소스 노트 */
  sourceNote: NoteDomain;

  /** 타겟 노트 */
  targetNote: NoteDomain;

  /** 창발성 점수 */
  serendipityScore: SerendipityScore;

  /** 도메인 거리 */
  domainDistance: DomainDistance;

  /** 임베딩 유사도 (0-1) */
  similarity: number;

  /** 연결 유형 */
  connectionType: ConnectionType;

  /** LLM 생성 유추 (선택적) */
  analogy?: string;

  /** 발견 시각 */
  discoveredAt: Date;
}

/**
 * ConnectionType을 사람이 읽기 쉬운 형태로 변환
 */
export function getConnectionTypeLabel(type: ConnectionType): string {
  const labels: Record<ConnectionType, string> = {
    unexpected_similarity: '예상치 못한 유사성',
    bridging_concept: '연결 개념',
    analogical: '유추적 연결',
    contrasting: '대조적 관점',
  };
  return labels[type];
}

/**
 * 유사도와 도메인 거리를 기반으로 연결 유형 추론
 */
export function inferConnectionType(
  similarity: number,
  domainDistanceValue: number
): ConnectionType {
  if (similarity > 0.8 && domainDistanceValue > 0.8) {
    return 'unexpected_similarity';
  }
  if (similarity > 0.6 && domainDistanceValue > 0.5) {
    return 'bridging_concept';
  }
  if (similarity < 0.5 && domainDistanceValue > 0.7) {
    return 'contrasting';
  }
  return 'analogical';
}
