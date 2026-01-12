/**
 * DomainClassificationService
 * 노트의 도메인을 분류하는 서비스
 */

import { normalizePath, TFile, type Vault, type CachedMetadata } from 'obsidian';
import type { NoteDomain } from '../../domain/entities/note-domain';
import type {
  IDomainClassifier,
  ClassificationMethod,
} from '../../domain/interfaces/domain-classifier';
import { createNoteDomain } from '../../domain/entities/note-domain';
import { generateNoteId } from '../../domain/utils/note-id';

export interface DomainClassificationSettings {
  method: ClassificationMethod;
  domainTagPrefixes: string[]; // 예: ['domain/', 'topic/']
}

export class DomainClassificationService implements IDomainClassifier {
  private noteIdToPath: Map<string, string> = new Map();

  constructor(
    private vault: Vault,
    private getMetadata: (file: TFile) => CachedMetadata | null,
    private settings: DomainClassificationSettings
  ) {
    this.buildNoteIdIndex();
  }

  /**
   * noteId → path 인덱스 구축
   */
  private buildNoteIdIndex(): void {
    this.noteIdToPath.clear();
    const mdFiles = this.vault.getMarkdownFiles();
    for (const file of mdFiles) {
      const noteId = generateNoteId(file.path);
      this.noteIdToPath.set(noteId, file.path);
    }
  }

  /**
   * 인덱스 갱신
   */
  refreshIndex(): void {
    this.buildNoteIdIndex();
  }

  /**
   * noteId로 파일 경로 조회
   */
  getPathByNoteId(noteId: string): string | undefined {
    return this.noteIdToPath.get(noteId);
  }

  /**
   * noteId로 TFile 조회
   * Cross-platform safe: normalizePath + 인덱스 폴백
   */
  getFileByNoteId(noteId: string): TFile | null {
    const path = this.noteIdToPath.get(noteId);
    if (!path) return null;

    const normalizedPath = normalizePath(path);

    // 먼저 getAbstractFileByPath 시도
    const file = this.vault.getAbstractFileByPath(normalizedPath);
    if (file instanceof TFile) {
      return file;
    }

    // iOS/Android 폴백: 파일 목록에서 직접 찾기
    const allFiles = this.vault.getMarkdownFiles();
    return allFiles.find(f => f.path === normalizedPath) || null;
  }

  /**
   * 노트의 도메인을 분류
   */
  async classifyNote(noteId: string, embedding?: number[]): Promise<NoteDomain> {
    const file = this.getFileByNoteId(noteId);
    if (!file) {
      throw new Error(`Note not found: ${noteId}`);
    }

    const metadata = this.getMetadata(file);
    const tags = this.extractTags(metadata);

    // 분류 방법에 따라 도메인 추론
    let primaryDomain: string;

    switch (this.settings.method) {
      case 'tag':
        primaryDomain =
          this.inferDomainFromTags(tags) ||
          this.inferDomainFromPath(file.path);
        break;
      case 'folder':
        primaryDomain = this.inferDomainFromPath(file.path);
        break;
      case 'cluster':
        // 클러스터 기반: 각 노트를 고유 도메인으로 처리
        // 이렇게 하면 "같은 도메인 스킵" 로직을 통과하고,
        // 실제 도메인 거리는 태그 Jaccard로 계산됨
        // 의미적으로 유사(임베딩)하면서 태그가 다른 연결이 발견됨
        primaryDomain = `cluster_${noteId}`;
        break;
      default:
        primaryDomain = 'uncategorized';
    }

    return createNoteDomain({
      noteId,
      path: file.path,
      title: file.basename,
      primaryDomain,
      secondaryDomains: this.extractSecondaryDomains(tags, primaryDomain),
      tags,
      embedding,
    });
  }

  /**
   * 태그에서 도메인 추론
   */
  inferDomainFromTags(tags: string[]): string | null {
    for (const prefix of this.settings.domainTagPrefixes) {
      const domainTag = tags.find((t) => t.startsWith(prefix));
      if (domainTag) {
        // 예: "domain/철학" → "철학"
        return domainTag.slice(prefix.length);
      }
    }
    return null;
  }

  /**
   * 폴더 경로에서 도메인 추론
   */
  inferDomainFromPath(path: string): string {
    // 예: "03_Resources/철학/소크라테스.md" → "철학"
    const parts = path.split('/');
    if (parts.length >= 2) {
      // 첫 번째 레벨 폴더가 번호 접두사가 있으면 스킵
      // 예: "03_Resources" → 두 번째 레벨 사용
      const firstFolder = parts[0];
      if (/^\d+_/.test(firstFolder) && parts.length >= 3) {
        return parts[1];
      }
      return firstFolder;
    }
    return 'root';
  }

  /**
   * 메타데이터에서 태그 추출
   */
  private extractTags(metadata: CachedMetadata | null): string[] {
    if (!metadata?.tags) return [];
    return metadata.tags.map((t) => t.tag.replace(/^#/, ''));
  }

  /**
   * 부 도메인 추출
   */
  private extractSecondaryDomains(
    tags: string[],
    primaryDomain: string
  ): string[] {
    const domains: string[] = [];

    for (const prefix of this.settings.domainTagPrefixes) {
      const domainTags = tags.filter((t) => t.startsWith(prefix));
      for (const tag of domainTags) {
        const domain = tag.slice(prefix.length);
        if (domain !== primaryDomain && !domains.includes(domain)) {
          domains.push(domain);
        }
      }
    }

    return domains;
  }
}
