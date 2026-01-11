/**
 * VaultEmbeddingsReader
 * Vault Embeddings 플러그인의 임베딩 데이터를 읽는 어댑터
 *
 * CRITICAL: Cross-platform 호환성
 * - normalizePath() 사용
 * - adapter.read() 폴백 패턴
 */

import { normalizePath, Vault } from 'obsidian';
import { toSafeFileId } from '../../domain/utils/note-id';

const EMBEDDING_FOLDER = '09_Embedded';
const BATCH_SIZE = 50;

/**
 * 임베딩 인덱스 구조
 */
export interface EmbeddingIndex {
  version: string;
  notes: Record<
    string,
    {
      path: string;
      updatedAt: string;
    }
  >;
}

/**
 * 노트 임베딩 구조
 */
export interface NoteEmbedding {
  noteId: string;
  embedding: number[];
  model: string;
  updatedAt: string;
}

export class VaultEmbeddingsReader {
  constructor(private vault: Vault) {}

  /**
   * 단일 노트의 임베딩 가져오기
   */
  async getEmbedding(noteId: string): Promise<NoteEmbedding | null> {
    const safeId = toSafeFileId(noteId);
    const embeddingPath = normalizePath(
      `${EMBEDDING_FOLDER}/embeddings/${safeId}.json`
    );

    try {
      // Cross-platform: adapter 폴백 패턴
      const file = this.vault.getAbstractFileByPath(embeddingPath);
      if (!file) {
        const exists = await this.vault.adapter.exists(embeddingPath);
        if (!exists) {
          return null;
        }
      }

      // adapter.read()는 항상 동작
      const content = await this.vault.adapter.read(embeddingPath);
      const data = JSON.parse(content);

      return {
        noteId: data.noteId || noteId,
        embedding: data.vector || data.embedding,  // Vault Embeddings uses 'vector'
        model: data.model || 'unknown',
        updatedAt: data.updatedAt || new Date().toISOString(),
      };
    } catch (error) {
      console.error(`[CDC] Failed to read embedding for ${noteId}:`, error);
      return null;
    }
  }

  /**
   * 모든 임베딩 가져오기
   */
  async getAllEmbeddings(): Promise<Map<string, NoteEmbedding>> {
    const result = new Map<string, NoteEmbedding>();

    // 인덱스 읽기
    const index = await this.readIndex();
    if (!index) {
      console.warn('[CDC] No embedding index found');
      return result;
    }

    const noteIds = Object.keys(index.notes);
    console.log(`[CDC] Found ${noteIds.length} notes in embedding index`);

    // 배치로 임베딩 읽기 (성능 최적화)
    for (let i = 0; i < noteIds.length; i += BATCH_SIZE) {
      const batch = noteIds.slice(i, i + BATCH_SIZE);
      const embeddings = await Promise.all(
        batch.map((noteId) => this.getEmbedding(noteId))
      );

      embeddings.forEach((emb, idx) => {
        if (emb) {
          result.set(batch[idx], emb);
        }
      });
    }

    console.log(`[CDC] Loaded ${result.size} embeddings`);
    return result;
  }

  /**
   * 임베딩 인덱스 읽기
   */
  async readIndex(): Promise<EmbeddingIndex | null> {
    const indexPath = normalizePath(`${EMBEDDING_FOLDER}/index.json`);

    try {
      // Cross-platform: adapter 폴백 패턴
      const file = this.vault.getAbstractFileByPath(indexPath);
      if (!file) {
        const exists = await this.vault.adapter.exists(indexPath);
        if (!exists) {
          return null;
        }
      }

      const content = await this.vault.adapter.read(indexPath);
      return JSON.parse(content) as EmbeddingIndex;
    } catch (error) {
      console.error('[CDC] Failed to read embedding index:', error);
      return null;
    }
  }

  /**
   * 임베딩 폴더 존재 여부 확인
   */
  async hasEmbeddingFolder(): Promise<boolean> {
    const folderPath = normalizePath(EMBEDDING_FOLDER);
    try {
      return await this.vault.adapter.exists(folderPath);
    } catch {
      return false;
    }
  }

  /**
   * 임베딩 개수 조회
   */
  async getEmbeddingCount(): Promise<number> {
    const index = await this.readIndex();
    if (!index) return 0;
    return Object.keys(index.notes).length;
  }
}
