/**
 * IDomainClassifier Interface
 * 도메인 분류기 인터페이스 (Port)
 */

import type { NoteDomain } from '../entities/note-domain';

/**
 * 도메인 분류기 인터페이스
 */
export interface IDomainClassifier {
  /**
   * 노트의 도메인을 분류
   * @param noteId 노트 ID
   * @param embedding 임베딩 벡터 (선택적)
   * @returns 분류된 NoteDomain
   */
  classifyNote(noteId: string, embedding?: number[]): Promise<NoteDomain>;

  /**
   * 태그에서 도메인 추론
   * @param tags 태그 목록
   * @returns 추론된 도메인 또는 null
   */
  inferDomainFromTags(tags: string[]): string | null;

  /**
   * 경로에서 도메인 추론
   * @param path 파일 경로
   * @returns 추론된 도메인
   */
  inferDomainFromPath(path: string): string;
}

/**
 * 분류 방법 타입
 */
export type ClassificationMethod = 'tag' | 'folder' | 'cluster';
