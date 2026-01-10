/**
 * GenerateAnalogyUseCase
 * 크로스 도메인 연결에 대한 유추(Analogy)를 생성하는 유스케이스
 */

import type { CrossDomainConnection } from '../../domain/entities/cross-domain-connection';
import { getConnectionTypeLabel } from '../../domain/entities/cross-domain-connection';
import type { AIService, AIResponse } from '../services/ai-service';

export class GenerateAnalogyUseCase {
  constructor(private aiService: AIService) {}

  /**
   * 연결에 대한 유추 생성
   */
  async execute(connection: CrossDomainConnection): Promise<string> {
    const prompt = this.buildPrompt(connection);
    const systemPrompt = this.buildSystemPrompt();

    const response = await this.aiService.simpleGenerate(prompt, systemPrompt);

    if (response.success && response.content) {
      return response.content.trim();
    }

    return this.getFallbackAnalogy(connection);
  }

  /**
   * 여러 연결에 대한 유추 일괄 생성
   */
  async executeBatch(
    connections: CrossDomainConnection[]
  ): Promise<Map<string, string>> {
    const results = new Map<string, string>();

    // 순차 처리 (API rate limit 고려)
    for (const connection of connections) {
      const key = `${connection.sourceNote.noteId}-${connection.targetNote.noteId}`;
      try {
        const analogy = await this.execute(connection);
        results.set(key, analogy);
      } catch (error) {
        console.error('[CDC] Analogy generation failed:', error);
        results.set(key, this.getFallbackAnalogy(connection));
      }
    }

    return results;
  }

  /**
   * 프롬프트 구성
   */
  private buildPrompt(connection: CrossDomainConnection): string {
    const connectionTypeLabel = getConnectionTypeLabel(connection.connectionType);

    return `두 노트 간의 창발적 연결을 분석하고 유추(analogy)를 생성해주세요.

## 소스 노트
- 제목: ${connection.sourceNote.title}
- 도메인: ${connection.sourceNote.primaryDomain}
- 태그: ${connection.sourceNote.tags.join(', ') || '없음'}

## 타겟 노트
- 제목: ${connection.targetNote.title}
- 도메인: ${connection.targetNote.primaryDomain}
- 태그: ${connection.targetNote.tags.join(', ') || '없음'}

## 연결 정보
- 유사도: ${(connection.similarity * 100).toFixed(1)}%
- 도메인 거리: ${connection.domainDistance.value.toFixed(2)}
- 연결 유형: ${connectionTypeLabel}
- 창발성 점수: ${connection.serendipityScore.toPercent()}%

## 요청
이 두 노트가 왜 연결될 수 있는지, 어떤 구조적/개념적 유사성이 있는지 2-3문장으로 설명해주세요.
가능하다면 두 도메인을 연결하는 핵심 통찰이나 유추를 제시해주세요.`;
  }

  /**
   * 시스템 프롬프트 구성
   */
  private buildSystemPrompt(): string {
    return `당신은 지식 통합 전문가입니다. 서로 다른 분야의 개념들 사이에서 숨겨진 연결고리를 발견하고,
창의적인 유추(analogy)를 통해 새로운 통찰을 제시하는 역할을 합니다.

응답 시 주의사항:
- 간결하고 명확하게 2-3문장으로 답변
- 피상적인 연결이 아닌 구조적/개념적 유사성에 집중
- 두 도메인 모두에 관심 있는 독자가 이해할 수 있는 언어 사용
- 가능하면 구체적인 예시나 비유 포함`;
  }

  /**
   * LLM 실패 시 폴백 유추
   */
  private getFallbackAnalogy(connection: CrossDomainConnection): string {
    const sourceTitle = connection.sourceNote.title;
    const targetTitle = connection.targetNote.title;
    const sourceDomain = connection.sourceNote.primaryDomain;
    const targetDomain = connection.targetNote.primaryDomain;

    switch (connection.connectionType) {
      case 'unexpected_similarity':
        return `'${sourceTitle}'(${sourceDomain})과 '${targetTitle}'(${targetDomain})은 다른 분야임에도 높은 개념적 유사성을 보입니다.`;
      case 'bridging_concept':
        return `'${sourceTitle}'와 '${targetTitle}'은 ${sourceDomain}과 ${targetDomain}을 연결하는 교량 개념일 수 있습니다.`;
      case 'analogical':
        return `'${sourceTitle}'의 구조가 '${targetTitle}'에서 유추적으로 적용될 수 있습니다.`;
      case 'contrasting':
        return `'${sourceTitle}'와 '${targetTitle}'은 대조적 관점을 제공하여 상호 이해를 깊게 합니다.`;
      default:
        return `'${sourceTitle}'와 '${targetTitle}' 사이에 흥미로운 연결이 발견되었습니다.`;
    }
  }
}
