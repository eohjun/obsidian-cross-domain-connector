/**
 * VaultAdapter
 * Obsidian Vault 접근을 위한 어댑터
 */

import { normalizePath, Vault, TFile, CachedMetadata, MetadataCache } from 'obsidian';
import { generateNoteId } from '../../domain/utils/note-id';

export class VaultAdapter {
  private noteIdToPath: Map<string, string> = new Map();

  constructor(
    private vault: Vault,
    private metadataCache: MetadataCache
  ) {
    this.buildIndex();
  }

  /**
   * noteId → path 인덱스 구축
   */
  buildIndex(): void {
    this.noteIdToPath.clear();
    const mdFiles = this.vault.getMarkdownFiles();
    for (const file of mdFiles) {
      const noteId = generateNoteId(file.path);
      this.noteIdToPath.set(noteId, file.path);
    }
  }

  /**
   * noteId로 파일 경로 조회
   */
  getPathByNoteId(noteId: string): string | undefined {
    return this.noteIdToPath.get(noteId);
  }

  /**
   * noteId로 TFile 조회
   * Cross-platform safe: adapter 폴백 패턴 적용
   */
  async getFileByNoteId(noteId: string): Promise<TFile | null> {
    const path = this.noteIdToPath.get(noteId);
    if (!path) return null;
    return this.getFileByPathSafe(path);
  }

  /**
   * Cross-platform safe 파일 조회
   * iOS/Android에서 getAbstractFileByPath가 null을 반환할 수 있어
   * adapter.exists()로 폴백 확인 후 TFile 생성
   */
  async getFileByPathSafe(path: string): Promise<TFile | null> {
    const normalizedPath = normalizePath(path);

    // 먼저 getAbstractFileByPath 시도
    const file = this.vault.getAbstractFileByPath(normalizedPath);
    if (file instanceof TFile) {
      return file;
    }

    // iOS/Android 폴백: adapter.exists()로 확인
    const exists = await this.vault.adapter.exists(normalizedPath);
    if (!exists) {
      return null;
    }

    // 파일 존재하지만 getAbstractFileByPath 실패 시
    // Vault의 파일 목록에서 찾기
    const allFiles = this.vault.getMarkdownFiles();
    return allFiles.find(f => f.path === normalizedPath) || null;
  }

  /**
   * 파일의 메타데이터 조회
   */
  getMetadata(file: TFile): CachedMetadata | null {
    return this.metadataCache.getFileCache(file);
  }

  /**
   * 파일 내용 읽기
   */
  async readFile(file: TFile): Promise<string> {
    return this.vault.cachedRead(file);
  }

  /**
   * 모든 마크다운 파일 조회
   */
  getMarkdownFiles(): TFile[] {
    return this.vault.getMarkdownFiles();
  }

  /**
   * 경로로 파일 조회
   * @deprecated Use getFileByPathSafe() for cross-platform compatibility
   */
  getFileByPath(path: string): TFile | null {
    const normalizedPath = normalizePath(path);
    return this.vault.getAbstractFileByPath(normalizedPath) as TFile | null;
  }

  /**
   * 파일 존재 여부 확인
   */
  async exists(path: string): Promise<boolean> {
    const normalizedPath = normalizePath(path);
    return this.vault.adapter.exists(normalizedPath);
  }

  /**
   * 파일 내용 읽기 (경로 기반)
   */
  async readByPath(path: string): Promise<string | null> {
    const normalizedPath = normalizePath(path);
    try {
      return await this.vault.adapter.read(normalizedPath);
    } catch {
      return null;
    }
  }
}
