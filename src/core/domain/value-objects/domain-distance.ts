/**
 * DomainDistance Value Object
 * 두 도메인 간의 거리를 계산하고 관리하는 값 객체
 */

export class DomainDistance {
  /** 거리 값 (0-1, 높을수록 먼 도메인) */
  readonly value: number;

  private constructor(value: number) {
    this.value = Math.max(0, Math.min(1, value));
  }

  /**
   * 두 도메인 간 거리 계산
   * @param domain1 첫 번째 도메인
   * @param domain2 두 번째 도메인
   * @param taxonomyMap 도메인 분류 체계 맵 (선택적)
   */
  static calculate(
    domain1: string,
    domain2: string,
    taxonomyMap?: Map<string, string>
  ): DomainDistance {
    // 같은 도메인이면 거리 0
    if (domain1 === domain2) {
      return new DomainDistance(0);
    }

    // 분류 체계가 있으면 상위 분류 비교
    if (taxonomyMap) {
      const parent1 = taxonomyMap.get(domain1);
      const parent2 = taxonomyMap.get(domain2);

      // 같은 상위 분류에 속하면 0.5
      if (parent1 && parent2 && parent1 === parent2) {
        return new DomainDistance(0.5);
      }
    }

    // 다른 도메인이면 기본 거리 1.0
    return new DomainDistance(1.0);
  }

  /**
   * 태그 집합 간 Jaccard Distance 계산
   * @param tags1 첫 번째 태그 집합
   * @param tags2 두 번째 태그 집합
   */
  static fromTagJaccard(tags1: string[], tags2: string[]): DomainDistance {
    if (tags1.length === 0 && tags2.length === 0) {
      return new DomainDistance(1.0); // 둘 다 태그 없으면 최대 거리
    }

    const set1 = new Set(tags1);
    const set2 = new Set(tags2);

    // 교집합 크기
    let intersection = 0;
    for (const tag of set1) {
      if (set2.has(tag)) {
        intersection++;
      }
    }

    // 합집합 크기
    const union = set1.size + set2.size - intersection;

    if (union === 0) {
      return new DomainDistance(1.0);
    }

    // Jaccard similarity = intersection / union
    // Jaccard distance = 1 - similarity
    const similarity = intersection / union;
    return new DomainDistance(1 - similarity);
  }

  /**
   * 폴더 경로 기반 거리 계산
   * @param path1 첫 번째 경로
   * @param path2 두 번째 경로
   */
  static fromFolderPath(path1: string, path2: string): DomainDistance {
    const parts1 = path1.split('/').filter(Boolean);
    const parts2 = path2.split('/').filter(Boolean);

    // 공통 접두사 길이 계산
    let commonLength = 0;
    const minLength = Math.min(parts1.length, parts2.length);

    for (let i = 0; i < minLength; i++) {
      if (parts1[i] === parts2[i]) {
        commonLength++;
      } else {
        break;
      }
    }

    // 최대 길이 대비 공통 길이 비율의 역
    const maxLength = Math.max(parts1.length, parts2.length);
    if (maxLength === 0) {
      return new DomainDistance(1.0);
    }

    const similarity = commonLength / maxLength;
    return new DomainDistance(1 - similarity);
  }

  /**
   * 직접 값으로 생성 (테스트용)
   */
  static fromValue(value: number): DomainDistance {
    return new DomainDistance(value);
  }

  /**
   * 먼 거리 여부 (>= 0.7)
   */
  isFarDomain(): boolean {
    return this.value >= 0.7;
  }

  /**
   * 중간 거리 여부 (0.3 <= x < 0.7)
   */
  isMediumDomain(): boolean {
    return this.value >= 0.3 && this.value < 0.7;
  }

  /**
   * 가까운 거리 여부 (< 0.3)
   */
  isNearDomain(): boolean {
    return this.value < 0.3;
  }

  /**
   * 문자열 표현
   */
  toString(): string {
    return this.value.toFixed(2);
  }
}
