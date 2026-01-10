/**
 * NoteDomain Entity
 * 노트의 도메인 정보를 포함하는 핵심 엔티티
 */

export interface NoteDomain {
  /** Hash-based ID (Vault Embeddings 호환) */
  noteId: string;

  /** 파일 경로 */
  path: string;

  /** 노트 제목 */
  title: string;

  /** 주 도메인 (예: "철학", "프로그래밍") */
  primaryDomain: string;

  /** 부 도메인 목록 */
  secondaryDomains: string[];

  /** 태그 목록 */
  tags: string[];

  /** 임베딩 벡터 (선택적) */
  embedding?: number[];
}

/**
 * NoteDomain 생성 헬퍼
 */
export function createNoteDomain(params: {
  noteId: string;
  path: string;
  title: string;
  primaryDomain: string;
  secondaryDomains?: string[];
  tags?: string[];
  embedding?: number[];
}): NoteDomain {
  return {
    noteId: params.noteId,
    path: params.path,
    title: params.title,
    primaryDomain: params.primaryDomain,
    secondaryDomains: params.secondaryDomains ?? [],
    tags: params.tags ?? [],
    embedding: params.embedding,
  };
}
