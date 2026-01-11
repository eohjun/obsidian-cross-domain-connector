/**
 * IConnectionAnalyzer Interface
 * 연결 분석기 인터페이스 (Port)
 */

import type { CrossDomainConnection } from '../entities/cross-domain-connection';

/**
 * 연결 분석기 인터페이스
 */
export interface IConnectionAnalyzer {
  /**
   * 소스 노트에서 크로스 도메인 연결 발견
   * @param sourceNoteId 소스 노트 ID
   * @returns 발견된 연결 목록
   */
  discoverConnections(sourceNoteId: string): Promise<CrossDomainConnection[]>;

  /**
   * 전체 볼트에서 가장 창발적인 연결 발견
   * @param limit 최대 결과 수
   * @returns 발견된 연결 목록
   */
  findTopSerendipitousConnections(
    limit: number
  ): Promise<CrossDomainConnection[]>;
}

/**
 * 링크 체커 함수 타입
 * 두 노트 경로 간에 링크가 있는지 확인
 */
export type LinkChecker = (path1: string, path2: string) => boolean;

/**
 * 연결 분석 옵션
 */
export interface ConnectionAnalysisOptions {
  /** 최소 유사도 임계값 */
  minSimilarity: number;

  /** 최소 창발성 점수 임계값 */
  minSerendipityScore: number;

  /** 최대 결과 수 */
  maxResults: number;

  /** 제외할 폴더 목록 */
  excludeFolders: string[];

  /** 검색 대상 폴더 목록 (빈 배열이면 전체) */
  includeFolders: string[];

  /** 링크 체커 함수 (이미 연결된 노트 제외용) */
  linkChecker?: LinkChecker;
}
