/**
 * LinkCreationService
 * 노트 간 연결(링크)을 생성하는 서비스
 * 영구 노트의 '연결된 노트' 섹션에 링크 추가
 */

import type { Vault, TFile } from 'obsidian';

/**
 * 연결 정보
 */
export interface LinkInfo {
  /** 타겟 노트 제목 */
  targetTitle: string;
  /** 연결 이유 (analogy) */
  reason: string;
}

/**
 * 연결 생성 결과
 */
export interface LinkCreationResult {
  success: boolean;
  message: string;
}

export class LinkCreationService {
  constructor(private vault: Vault) {}

  /**
   * 소스 노트의 '연결된 노트' 섹션에 새 링크 추가
   * @param sourceFile 소스 노트 파일
   * @param linkInfo 연결 정보
   * @returns 생성 결과
   */
  async addLinkToNote(
    sourceFile: TFile,
    linkInfo: LinkInfo
  ): Promise<LinkCreationResult> {
    try {
      const content = await this.vault.read(sourceFile);

      // '연결된 노트' 섹션 찾기 (PKM Note Recommender와 동일한 형식: ### 🔗 연결된 노트)
      const CONNECTED_NOTES_HEADING = '### 🔗 연결된 노트';
      const sectionIndex = content.indexOf(CONNECTED_NOTES_HEADING);

      if (sectionIndex === -1) {
        return {
          success: false,
          message: '노트에 "### 🔗 연결된 노트" 섹션을 찾을 수 없습니다.',
        };
      }

      // 새 링크 형식: [[노트제목]]• 연결 직관 — 연결 이유
      const newLink = `- [[${linkInfo.targetTitle}]]• 연결 직관 — ${linkInfo.reason}`;

      // 이미 동일한 링크가 있는지 확인
      if (content.includes(`[[${linkInfo.targetTitle}]]`)) {
        return {
          success: false,
          message: `"${linkInfo.targetTitle}" 링크가 이미 존재합니다.`,
        };
      }

      // 섹션 범위 찾기
      const afterHeading = sectionIndex + CONNECTED_NOTES_HEADING.length;
      const remainingContent = content.substring(afterHeading);

      // 다음 섹션 경계 찾기 (## 또는 ### 헤딩)
      const nextSectionMatch = remainingContent.match(/\n(#{2,3}\s)/);
      const sectionEndOffset = nextSectionMatch
        ? afterHeading + nextSectionMatch.index!
        : content.length;

      // 섹션 내 콘텐츠
      const sectionContent = content.substring(afterHeading, sectionEndOffset);

      // 마지막 링크 라인 찾기
      const linkLines = sectionContent.match(/^- \[\[.+\]\].*$/gm);

      let newContent: string;
      if (linkLines && linkLines.length > 0) {
        // 마지막 링크 다음에 추가
        const lastLink = linkLines[linkLines.length - 1];
        const lastLinkIndex = content.lastIndexOf(lastLink, sectionEndOffset);
        const insertPosition = lastLinkIndex + lastLink.length;

        // 빈 줄 없이 바로 다음 줄에 추가
        const afterInsert = content.substring(insertPosition);
        newContent =
          content.substring(0, insertPosition) +
          '\n' +
          newLink +
          afterInsert.replace(/^\n/, '');
      } else {
        // 링크가 없으면 헤딩 다음에 추가
        newContent =
          content.substring(0, afterHeading) +
          '\n\n' +
          newLink +
          content.substring(afterHeading).replace(/^\n+/, '\n');
      }

      await this.vault.modify(sourceFile, newContent);

      return {
        success: true,
        message: `"${linkInfo.targetTitle}" 연결이 추가되었습니다.`,
      };
    } catch (error) {
      console.error('[CDC] Link creation failed:', error);
      return {
        success: false,
        message: '연결 생성에 실패했습니다.',
      };
    }
  }

  /**
   * 양방향 링크 생성
   * @param sourceFile 소스 노트 파일
   * @param targetFile 타겟 노트 파일
   * @param reason 연결 이유 (analogy)
   * @returns 생성 결과
   */
  async addBidirectionalLink(
    sourceFile: TFile,
    targetFile: TFile,
    reason: string
  ): Promise<LinkCreationResult> {
    // 소스 → 타겟 링크 추가
    const sourceResult = await this.addLinkToNote(sourceFile, {
      targetTitle: targetFile.basename,
      reason,
    });

    if (!sourceResult.success) {
      return sourceResult;
    }

    // 타겟 → 소스 링크 추가
    const targetResult = await this.addLinkToNote(targetFile, {
      targetTitle: sourceFile.basename,
      reason,
    });

    if (!targetResult.success) {
      return {
        success: true, // 소스는 성공
        message: `소스 노트에 연결 추가됨. 타겟 노트: ${targetResult.message}`,
      };
    }

    return {
      success: true,
      message: '양방향 연결이 추가되었습니다.',
    };
  }
}
