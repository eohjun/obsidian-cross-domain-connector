/**
 * Note ID Utilities
 * Vault Embeddings 호환 hash 기반 ID 생성
 */

/**
 * 간단한 해시 함수
 * Vault Embeddings 플러그인과 동일한 알고리즘 사용
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * 파일 경로에서 노트 ID 생성
 * @param path 파일 경로 (예: "03_Resources/철학/소크라테스.md")
 * @returns hash 기반 ID (예: "a1b2c3d4")
 */
export function generateNoteId(path: string): string {
  const pathWithoutExt = path.replace(/\.md$/, '');
  return simpleHash(pathWithoutExt);
}

/**
 * 노트 ID를 파일 시스템 안전한 형태로 변환
 * @param noteId 노트 ID
 * @returns 안전한 파일명용 ID
 */
export function toSafeFileId(noteId: string): string {
  return noteId.replace(/[^a-zA-Z0-9-_]/g, '_');
}
