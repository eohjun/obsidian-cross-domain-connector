/**
 * DiscoverConnectionsUseCase
 * 소스 노트에서 크로스 도메인 연결을 발견하는 유스케이스
 */

import type { Vault } from 'obsidian';
import type {
  CrossDomainConnection,
  ConnectionType,
} from '../../domain/entities/cross-domain-connection';
import type { NoteDomain } from '../../domain/entities/note-domain';
import type { ConnectionAnalysisOptions } from '../../domain/interfaces/connection-analyzer';
import { inferConnectionType } from '../../domain/entities/cross-domain-connection';
import { SerendipityScore } from '../../domain/value-objects/serendipity-score';
import { DomainDistance } from '../../domain/value-objects/domain-distance';
import type { DomainClassificationService } from '../services/domain-classification-service';
import type { VaultEmbeddingsReader } from '../../adapters/embeddings/vault-embeddings-reader';

/**
 * 일반적 용어 목록 (창발성 감점 대상)
 */
const GENERIC_TERMS = [
  'note',
  'idea',
  'concept',
  'thought',
  '노트',
  '아이디어',
  '개념',
  '생각',
  'summary',
  'overview',
  '요약',
  '개요',
];

export class DiscoverConnectionsUseCase {
  constructor(
    private vault: Vault,
    private embeddingsReader: VaultEmbeddingsReader,
    private classificationService: DomainClassificationService,
    private options: ConnectionAnalysisOptions
  ) {}

  /**
   * 소스 노트에서 크로스 도메인 연결 발견
   */
  async execute(sourceNoteId: string): Promise<CrossDomainConnection[]> {
    console.log(`[CDC] === Starting discovery for source: ${sourceNoteId} ===`);

    // 1. 소스 노트 임베딩 가져오기
    const sourceEmbedding = await this.embeddingsReader.getEmbedding(sourceNoteId);
    if (!sourceEmbedding) {
      console.warn(`[CDC] No embedding found for source note: ${sourceNoteId}`);
      return [];
    }
    console.log(`[CDC] Source embedding loaded, dimensions: ${sourceEmbedding.embedding.length}`);

    // 2. 소스 노트 도메인 분류
    const sourceNoteDomain = await this.classificationService.classifyNote(
      sourceNoteId,
      sourceEmbedding.embedding
    );
    console.log(`[CDC] Source domain: ${sourceNoteDomain.primaryDomain}, tags: ${sourceNoteDomain.tags.join(', ')}`);

    // 3. 모든 임베딩 가져오기
    const allEmbeddings = await this.embeddingsReader.getAllEmbeddings();
    console.log(`[CDC] Total embeddings loaded: ${allEmbeddings.size}`);
    const candidates: CrossDomainConnection[] = [];

    // Debug counters
    let skipSelf = 0, skipExcluded = 0, skipSameDomain = 0;
    let skipLowSimilarity = 0, skipLowSerendipity = 0, classifyErrors = 0;

    // 4. 각 노트와 비교
    for (const [targetNoteId, targetEmbedding] of allEmbeddings) {
      // 자기 자신 스킵
      if (targetNoteId === sourceNoteId) {
        skipSelf++;
        continue;
      }

      // 제외 폴더 체크
      const targetPath = this.classificationService.getPathByNoteId(targetNoteId);
      if (targetPath && this.isExcludedPath(targetPath)) {
        skipExcluded++;
        continue;
      }

      try {
        // 5. 타겟 노트 도메인 분류
        const targetNoteDomain = await this.classificationService.classifyNote(
          targetNoteId,
          targetEmbedding.embedding
        );

        // 6. 같은 도메인이면 스킵 (Cross-Domain만 찾음)
        if (sourceNoteDomain.primaryDomain === targetNoteDomain.primaryDomain) {
          skipSameDomain++;
          continue;
        }

        // 7. 코사인 유사도 계산
        const similarity = this.cosineSimilarity(
          sourceEmbedding.embedding,
          targetEmbedding.embedding
        );

        // 8. 유사도 임계값 필터링
        if (similarity < this.options.minSimilarity) {
          skipLowSimilarity++;
          continue;
        }

        // 9. 도메인 거리 계산
        const domainDistance = DomainDistance.fromTagJaccard(
          sourceNoteDomain.tags,
          targetNoteDomain.tags
        );

        // 10. 창발성 점수 계산
        const serendipityScore = SerendipityScore.calculate({
          similarity,
          domainDistance: domainDistance.value,
          isAlreadyLinked: this.isAlreadyLinked(sourceNoteId, targetNoteId),
          genericTermsCount: this.countGenericTerms(targetNoteDomain),
        });

        // 11. 창발성 임계값 필터링
        if (serendipityScore.value < this.options.minSerendipityScore) {
          skipLowSerendipity++;
          continue;
        }

        // 12. 연결 추가
        candidates.push({
          sourceNote: sourceNoteDomain,
          targetNote: targetNoteDomain,
          serendipityScore,
          domainDistance,
          similarity,
          connectionType: inferConnectionType(similarity, domainDistance.value),
          discoveredAt: new Date(),
        });
      } catch (error) {
        // 분류 실패한 노트는 스킵
        classifyErrors++;
        continue;
      }
    }

    // Debug summary
    console.log(`[CDC] === Discovery Summary ===`);
    console.log(`[CDC] Skip self: ${skipSelf}`);
    console.log(`[CDC] Skip excluded: ${skipExcluded}`);
    console.log(`[CDC] Skip same domain: ${skipSameDomain}`);
    console.log(`[CDC] Skip low similarity: ${skipLowSimilarity}`);
    console.log(`[CDC] Skip low serendipity: ${skipLowSerendipity}`);
    console.log(`[CDC] Classify errors: ${classifyErrors}`);
    console.log(`[CDC] Candidates found: ${candidates.length}`);

    // 13. 창발성 점수로 정렬 후 상위 N개 반환
    return candidates
      .sort((a, b) => b.serendipityScore.value - a.serendipityScore.value)
      .slice(0, this.options.maxResults);
  }

  /**
   * 전체 볼트에서 가장 창발적인 연결 발견
   */
  async findTopSerendipitousConnections(
    limit: number = 10
  ): Promise<CrossDomainConnection[]> {
    const allConnections: CrossDomainConnection[] = [];
    const processedPairs = new Set<string>();

    const allEmbeddings = await this.embeddingsReader.getAllEmbeddings();
    const noteIds = Array.from(allEmbeddings.keys());

    // 샘플링으로 성능 최적화 (최대 100개 노트)
    const sampledNoteIds = noteIds.length > 100
      ? this.sampleArray(noteIds, 100)
      : noteIds;

    for (const sourceNoteId of sampledNoteIds) {
      const connections = await this.execute(sourceNoteId);

      for (const conn of connections) {
        // 중복 페어 체크 (A-B와 B-A는 같은 연결)
        const pairKey = [conn.sourceNote.noteId, conn.targetNote.noteId]
          .sort()
          .join('-');
        if (processedPairs.has(pairKey)) continue;
        processedPairs.add(pairKey);

        allConnections.push(conn);
      }
    }

    // 창발성 점수로 정렬 후 상위 N개 반환
    return allConnections
      .sort((a, b) => b.serendipityScore.value - a.serendipityScore.value)
      .slice(0, limit);
  }

  /**
   * 코사인 유사도 계산
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) return 0;

    return dotProduct / denominator;
  }

  /**
   * 이미 연결된 노트인지 확인
   * TODO: 실제 링크 분석 구현
   */
  private isAlreadyLinked(noteId1: string, noteId2: string): boolean {
    // 현재는 간단히 false 반환
    // 추후 vault 링크 분석으로 구현 가능
    return false;
  }

  /**
   * 일반적 용어 개수 계산
   */
  private countGenericTerms(note: NoteDomain): number {
    const titleLower = note.title.toLowerCase();
    let count = 0;

    for (const term of GENERIC_TERMS) {
      if (titleLower.includes(term.toLowerCase())) {
        count++;
      }
    }

    // 태그에서도 체크
    for (const tag of note.tags) {
      const tagLower = tag.toLowerCase();
      for (const term of GENERIC_TERMS) {
        if (tagLower.includes(term.toLowerCase())) {
          count++;
        }
      }
    }

    return count;
  }

  /**
   * 제외 경로인지 확인
   */
  private isExcludedPath(path: string): boolean {
    const pathLower = path.toLowerCase();
    return this.options.excludeFolders.some((folder) =>
      pathLower.startsWith(folder.toLowerCase() + '/')
    );
  }

  /**
   * 배열에서 랜덤 샘플링
   */
  private sampleArray<T>(array: T[], size: number): T[] {
    const shuffled = [...array].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, size);
  }
}
