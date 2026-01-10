/**
 * SerendipityScore Value Object
 * 창발성 점수를 계산하고 관리하는 값 객체
 *
 * 핵심 알고리즘:
 * BaseScore = (Similarity × 0.4) + (DomainDistance × 0.6)
 * SerendipityScore = BaseScore × NoveltyPenalty × SpecificityPenalty
 */

export interface SerendipityScoreParams {
  /** 임베딩 유사도 (0-1) */
  similarity: number;

  /** 도메인 간 거리 (0-1, 멀수록 높음) */
  domainDistance: number;

  /** 이미 연결된 노트인지 여부 */
  isAlreadyLinked: boolean;

  /** 일반적 용어 개수 */
  genericTermsCount: number;
}

export class SerendipityScore {
  /** 점수 값 (0-1, 높을수록 창발적) */
  readonly value: number;

  private constructor(value: number) {
    this.value = Math.max(0, Math.min(1, value));
  }

  /**
   * 창발성 점수 계산
   *
   * Formula:
   * BaseScore = (Similarity × 0.4) + (DomainDistance × 0.6)
   * SerendipityScore = BaseScore × NoveltyPenalty × SpecificityPenalty
   *
   * - DomainDistance: 도메인 간 거리 (0-1, 멀수록 높음)
   * - Similarity: 임베딩 유사도 (0-1)
   * - NoveltyPenalty: 이미 연결된 노트는 감점 (0.5-1.0)
   * - SpecificityPenalty: 너무 일반적인 연결은 감점 (0.3-1.0)
   */
  static calculate(params: SerendipityScoreParams): SerendipityScore {
    const { similarity, domainDistance, isAlreadyLinked, genericTermsCount } = params;

    // Base score: 유사도와 도메인 거리의 가중 합
    // 도메인이 멀수록 (0.6 가중치), 유사도가 높을수록 (0.4 가중치) 창발성 높음
    const baseScore = (similarity * 0.4) + (domainDistance * 0.6);

    // Novelty penalty: 이미 연결되어 있으면 50% 감점
    const noveltyPenalty = isAlreadyLinked ? 0.5 : 1.0;

    // Specificity penalty: 일반적 용어가 많으면 감점 (최소 30%)
    const specificityPenalty = Math.max(0.3, 1 - (genericTermsCount * 0.15));

    const finalScore = baseScore * noveltyPenalty * specificityPenalty;

    return new SerendipityScore(finalScore);
  }

  /**
   * 직접 값으로 생성 (테스트용)
   */
  static fromValue(value: number): SerendipityScore {
    return new SerendipityScore(value);
  }

  /**
   * 높은 창발성 여부 (>= 0.7)
   */
  isHighSerendipity(): boolean {
    return this.value >= 0.7;
  }

  /**
   * 중간 창발성 여부 (0.4 <= x < 0.7)
   */
  isMediumSerendipity(): boolean {
    return this.value >= 0.4 && this.value < 0.7;
  }

  /**
   * 낮은 창발성 여부 (< 0.4)
   */
  isLowSerendipity(): boolean {
    return this.value < 0.4;
  }

  /**
   * 창발성 레벨 반환
   */
  getLevel(): 'high' | 'medium' | 'low' {
    if (this.isHighSerendipity()) return 'high';
    if (this.isMediumSerendipity()) return 'medium';
    return 'low';
  }

  /**
   * 퍼센트 형태로 반환
   */
  toPercent(): number {
    return Math.round(this.value * 100);
  }

  /**
   * 문자열 표현
   */
  toString(): string {
    return `${this.toPercent()}%`;
  }
}
