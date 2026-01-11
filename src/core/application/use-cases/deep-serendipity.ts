/**
 * DeepSerendipityUseCase
 * LLM-First 창발적 연결 발견
 *
 * 기존 접근: 임베딩 유사도 → LLM 유추 생성
 * 새 접근: 도메인 거리만으로 후보 선정 → LLM이 연결 가능성 판단 → 품질 점수화
 *
 * 이 방식은 진정한 "창발적" 연결을 찾음:
 * - 표면적으로 유사하지 않은 노트들 사이에서
 * - LLM이 발견하는 깊은 구조적/개념적 연결
 */

import type { NoteDomain } from '../../domain/entities/note-domain';
import type { AIService } from '../services/ai-service';
import type { DomainClassificationService } from '../services/domain-classification-service';
import type { VaultEmbeddingsReader } from '../../adapters/embeddings/vault-embeddings-reader';

/**
 * Deep Serendipity 결과
 */
export interface DeepSerendipityConnection {
  sourceNote: NoteDomain;
  targetNote: NoteDomain;
  /** LLM이 평가한 연결 품질 (0-1) */
  creativityScore: number;
  /** LLM이 생성한 창의적 연결 설명 */
  analogy: string;
  /** 도메인 간 거리 */
  domainDistance: number;
  /** 발견 시각 */
  discoveredAt: Date;
}

/**
 * LLM 평가 결과
 */
interface LLMEvaluationResult {
  connectionPossible: boolean;
  qualityScore: number;
  analogy: string;
}

export class DeepSerendipityUseCase {
  constructor(
    private embeddingsReader: VaultEmbeddingsReader,
    private classificationService: DomainClassificationService,
    private aiService: AIService,
    private options: {
      maxPairsToEvaluate: number;  // LLM에 보낼 최대 쌍 수 (비용 제어)
      minQualityScore: number;     // 최소 품질 점수
      maxResults: number;          // 최대 결과 수
      includeFolders: string[];
      excludeFolders: string[];
    }
  ) {}

  /**
   * Deep Serendipity 모드 실행
   */
  async execute(): Promise<DeepSerendipityConnection[]> {
    console.log('[CDC Deep] === Starting Deep Serendipity Discovery ===');

    // 1. 모든 노트의 도메인 분류 가져오기
    const allEmbeddings = await this.embeddingsReader.getAllEmbeddings();
    console.log(`[CDC Deep] Total embeddings: ${allEmbeddings.size}`);

    // 2. 노트를 도메인별로 그룹화
    const domainGroups = await this.groupNotesByDomain(allEmbeddings);
    console.log(`[CDC Deep] Domains found: ${domainGroups.size}`);

    // 3. 서로 다른 도메인의 노트 쌍 샘플링 (도메인 거리 최대화)
    const candidatePairs = this.sampleCrossDomainPairs(domainGroups);
    console.log(`[CDC Deep] Candidate pairs sampled: ${candidatePairs.length}`);

    if (candidatePairs.length === 0) {
      console.warn('[CDC Deep] No candidate pairs found');
      return [];
    }

    // 4. LLM으로 각 쌍 평가
    const evaluatedConnections = await this.evaluatePairsWithLLM(candidatePairs);
    console.log(`[CDC Deep] Connections with positive evaluation: ${evaluatedConnections.length}`);

    // 5. 품질 점수로 정렬 후 상위 N개 반환
    return evaluatedConnections
      .filter(conn => conn.creativityScore >= this.options.minQualityScore)
      .sort((a, b) => b.creativityScore - a.creativityScore)
      .slice(0, this.options.maxResults);
  }

  /**
   * 노트를 도메인별로 그룹화
   */
  private async groupNotesByDomain(
    embeddings: Map<string, { embedding: number[] }>
  ): Promise<Map<string, NoteDomain[]>> {
    const domainGroups = new Map<string, NoteDomain[]>();

    for (const [noteId] of embeddings) {
      try {
        const path = this.classificationService.getPathByNoteId(noteId);
        if (!path) continue;

        // 폴더 필터링
        if (!this.isIncludedPath(path) || this.isExcludedPath(path)) continue;

        // 도메인 분류
        const embedding = embeddings.get(noteId)?.embedding;
        if (!embedding) continue;

        const noteDomain = await this.classificationService.classifyNote(noteId, embedding);

        const domain = noteDomain.primaryDomain;
        if (!domainGroups.has(domain)) {
          domainGroups.set(domain, []);
        }
        domainGroups.get(domain)!.push(noteDomain);
      } catch {
        // 분류 실패 시 스킵
        continue;
      }
    }

    return domainGroups;
  }

  /**
   * 서로 다른 도메인의 노트 쌍 샘플링
   * 도메인 거리가 먼 쌍을 우선 선택
   */
  private sampleCrossDomainPairs(
    domainGroups: Map<string, NoteDomain[]>
  ): Array<{ source: NoteDomain; target: NoteDomain; domainDistance: number }> {
    const pairs: Array<{ source: NoteDomain; target: NoteDomain; domainDistance: number }> = [];
    const domains = Array.from(domainGroups.keys());

    if (domains.length < 2) {
      console.warn('[CDC Deep] Not enough domains for cross-domain discovery');
      return [];
    }

    // 모든 도메인 쌍 조합 생성
    for (let i = 0; i < domains.length; i++) {
      for (let j = i + 1; j < domains.length; j++) {
        const domain1 = domains[i];
        const domain2 = domains[j];
        const notes1 = domainGroups.get(domain1)!;
        const notes2 = domainGroups.get(domain2)!;

        // 도메인 거리 계산 (단순화: 도메인명이 다르면 1.0)
        // 추후 태그 기반 Jaccard 거리 사용 가능
        const domainDistance = 1.0;

        // 각 도메인에서 랜덤하게 노트 선택
        const sampledNotes1 = this.sampleArray(notes1, 3);
        const sampledNotes2 = this.sampleArray(notes2, 3);

        for (const note1 of sampledNotes1) {
          for (const note2 of sampledNotes2) {
            pairs.push({
              source: note1,
              target: note2,
              domainDistance,
            });
          }
        }
      }
    }

    // 도메인 거리로 정렬 후 상위 N개 선택
    const shuffled = pairs.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, this.options.maxPairsToEvaluate);
  }

  /**
   * LLM으로 각 쌍 평가
   */
  private async evaluatePairsWithLLM(
    pairs: Array<{ source: NoteDomain; target: NoteDomain; domainDistance: number }>
  ): Promise<DeepSerendipityConnection[]> {
    const results: DeepSerendipityConnection[] = [];

    for (const pair of pairs) {
      try {
        const evaluation = await this.evaluateSinglePair(pair.source, pair.target);

        if (evaluation.connectionPossible && evaluation.qualityScore > 0) {
          results.push({
            sourceNote: pair.source,
            targetNote: pair.target,
            creativityScore: evaluation.qualityScore,
            analogy: evaluation.analogy,
            domainDistance: pair.domainDistance,
            discoveredAt: new Date(),
          });
        }
      } catch (error) {
        console.error('[CDC Deep] LLM evaluation failed:', error);
        // 실패 시 스킵
      }
    }

    return results;
  }

  /**
   * 단일 쌍 LLM 평가
   */
  private async evaluateSinglePair(
    source: NoteDomain,
    target: NoteDomain
  ): Promise<LLMEvaluationResult> {
    const prompt = this.buildEvaluationPrompt(source, target);
    const systemPrompt = this.buildSystemPrompt();

    const response = await this.aiService.simpleGenerate(prompt, systemPrompt);

    if (!response.success || !response.content) {
      return { connectionPossible: false, qualityScore: 0, analogy: '' };
    }

    return this.parseEvaluationResponse(response.content);
  }

  /**
   * 평가 프롬프트 구성
   */
  private buildEvaluationPrompt(source: NoteDomain, target: NoteDomain): string {
    return `다음 두 노트 사이에 창의적이고 의미 있는 연결이 가능한지 평가해주세요.

## 노트 A
- 제목: ${source.title}
- 도메인: ${source.primaryDomain}
- 태그: ${source.tags.join(', ') || '없음'}

## 노트 B
- 제목: ${target.title}
- 도메인: ${target.primaryDomain}
- 태그: ${target.tags.join(', ') || '없음'}

## 평가 기준
1. 표면적으로 관련 없어 보이지만 깊은 구조적/개념적 유사성이 있는가?
2. 한 분야의 통찰이 다른 분야에 적용될 수 있는가?
3. 두 개념을 연결하면 새로운 아이디어가 도출될 수 있는가?

## 응답 형식 (반드시 이 형식을 지켜주세요)
CONNECTION_POSSIBLE: [YES/NO]
QUALITY_SCORE: [0.0-1.0 사이 숫자, 소수점 첫째 자리까지]
ANALOGY: [2-3문장으로 창의적 연결 설명. 연결이 없으면 "연결 없음"]

예시:
CONNECTION_POSSIBLE: YES
QUALITY_SCORE: 0.8
ANALOGY: 진화론의 '적자생존' 원리가 스타트업 생태계에서도 동일하게 작동합니다. 환경에 적응하지 못한 종이 도태되듯, 시장 변화에 대응하지 못한 기업도 사라집니다.`;
  }

  /**
   * 시스템 프롬프트
   */
  private buildSystemPrompt(): string {
    return `당신은 창의적 연결 발견 전문가입니다.
서로 다른 분야의 개념들 사이에서 숨겨진 구조적 유사성과 깊은 통찰을 발견하는 역할을 합니다.

중요:
- 피상적인 연결(단순 키워드 유사)은 낮은 점수를 부여하세요.
- 진정으로 창의적인 연결(구조적 유추, 패턴 인식, 도메인 간 통찰 이전)에 높은 점수를 부여하세요.
- 연결이 억지스럽거나 의미가 없다면 CONNECTION_POSSIBLE: NO로 답하세요.
- 반드시 지정된 응답 형식을 따르세요.`;
  }

  /**
   * LLM 응답 파싱
   */
  private parseEvaluationResponse(content: string): LLMEvaluationResult {
    const lines = content.split('\n');
    let connectionPossible = false;
    let qualityScore = 0;
    let analogy = '';

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('CONNECTION_POSSIBLE:')) {
        connectionPossible = trimmed.includes('YES');
      } else if (trimmed.startsWith('QUALITY_SCORE:')) {
        const match = trimmed.match(/[\d.]+/);
        if (match) {
          qualityScore = Math.min(1.0, Math.max(0, parseFloat(match[0])));
        }
      } else if (trimmed.startsWith('ANALOGY:')) {
        analogy = trimmed.replace('ANALOGY:', '').trim();
      }
    }

    // ANALOGY가 여러 줄에 걸쳐 있을 수 있음
    if (!analogy) {
      const analogyIndex = content.indexOf('ANALOGY:');
      if (analogyIndex !== -1) {
        analogy = content.slice(analogyIndex + 8).trim();
      }
    }

    return { connectionPossible, qualityScore, analogy };
  }

  /**
   * 배열에서 랜덤 샘플링
   */
  private sampleArray<T>(array: T[], size: number): T[] {
    if (array.length <= size) return [...array];
    const shuffled = [...array].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, size);
  }

  /**
   * 포함 대상 경로인지 확인
   */
  private isIncludedPath(path: string): boolean {
    if (!this.options.includeFolders || this.options.includeFolders.length === 0) {
      return true;
    }
    const pathLower = path.toLowerCase();
    return this.options.includeFolders.some((folder) =>
      pathLower.startsWith(folder.toLowerCase() + '/')
    );
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
}
