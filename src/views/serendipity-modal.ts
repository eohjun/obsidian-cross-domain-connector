/**
 * SerendipityModal
 * 전체 볼트에서 가장 창발적인 연결을 찾는 모달
 * - 결과를 파일에 영구 저장하여 옵시디언 재시작 후에도 불러올 수 있음
 */

import { Modal, App, Notice, TFile } from 'obsidian';
import type { CrossDomainConnection } from '../core/domain/entities/cross-domain-connection';
import { getConnectionTypeLabel } from '../core/domain/entities/cross-domain-connection';
import type { DiscoverConnectionsUseCase } from '../core/application/use-cases/discover-connections';
import type { GenerateAnalogyUseCase } from '../core/application/use-cases/generate-analogy';
import type CrossDomainConnectorPlugin from '../main';

export class SerendipityModal extends Modal {
  private resultsContainer: HTMLElement | null = null;

  constructor(
    app: App,
    private plugin: CrossDomainConnectorPlugin,
    private discoverUseCase: DiscoverConnectionsUseCase,
    private analogyUseCase: GenerateAnalogyUseCase | null
  ) {
    super(app);
  }

  async onOpen(): Promise<void> {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('cdc-serendipity-modal');

    // Header
    contentEl.createEl('h2', { text: 'Serendipity Mode' });
    contentEl.createEl('p', {
      text: 'Discover the most serendipitous connections across your entire vault.',
      cls: 'cdc-description',
    });

    // 캐시된 결과 확인
    const cache = await this.plugin.getSerendipityCache();

    if (cache && cache.connections.length > 0) {
      // 캐시가 있으면 선택 UI 표시
      this.showSelectionUI(cache);
    } else {
      // 캐시가 없으면 바로 검색 시작
      await this.performSearch();
    }
  }

  /**
   * 이전 결과 vs 새 검색 선택 UI
   */
  private showSelectionUI(cache: { connections: CrossDomainConnection[]; timestamp: number }): void {
    const { contentEl } = this;

    const selectionContainer = contentEl.createDiv({ cls: 'cdc-selection-container' });

    // 이전 결과 정보
    const cacheDate = new Date(cache.timestamp);
    const timeAgo = this.getTimeAgo(cacheDate);

    selectionContainer.createEl('p', {
      text: `Previous results found (${cache.connections.length} connections, ${timeAgo})`,
      cls: 'cdc-cache-info',
    });

    // 버튼 컨테이너
    const buttonContainer = selectionContainer.createDiv({ cls: 'cdc-selection-buttons' });

    // 이전 결과 불러오기 버튼
    const loadPreviousBtn = buttonContainer.createEl('button', {
      text: 'Load Previous Results',
      cls: 'cdc-btn cdc-btn-primary',
    });
    loadPreviousBtn.onclick = () => {
      selectionContainer.remove();
      this.renderConnections(cache.connections);
      new Notice(`Loaded ${cache.connections.length} cached connections`);
    };

    // 새로 검색 버튼
    const newSearchBtn = buttonContainer.createEl('button', {
      text: 'New Search',
      cls: 'cdc-btn cdc-btn-secondary',
    });
    newSearchBtn.onclick = async () => {
      selectionContainer.remove();
      await this.performSearch();
    };

    // 캐시 삭제 버튼
    const clearCacheBtn = buttonContainer.createEl('button', {
      text: 'Clear Cache',
      cls: 'cdc-btn cdc-btn-small',
    });
    clearCacheBtn.onclick = async () => {
      await this.plugin.clearSerendipityCache();
      selectionContainer.remove();
      await this.performSearch();
      new Notice('Cache cleared');
    };
  }

  /**
   * 검색 수행
   */
  private async performSearch(): Promise<void> {
    const { contentEl } = this;

    // Loading indicator
    const loadingEl = contentEl.createEl('p', {
      text: 'Analyzing vault... This may take a moment.',
      cls: 'cdc-loading',
    });

    try {
      // 전체 볼트에서 가장 창발적인 연결 찾기
      const connections = await this.discoverUseCase.findTopSerendipitousConnections(10);
      loadingEl.remove();

      if (connections.length === 0) {
        contentEl.createEl('p', {
          text: 'No serendipitous connections found. Make sure you have embeddings generated.',
          cls: 'cdc-no-results',
        });
        return;
      }

      // 결과를 캐시에 저장
      await this.plugin.setSerendipityCache({
        connections,
        timestamp: Date.now(),
      });

      contentEl.createEl('p', {
        text: `Found ${connections.length} serendipitous connections:`,
        cls: 'cdc-result-count',
      });

      this.renderConnections(connections);
      new Notice(`Found ${connections.length} connections (saved to cache)`);
    } catch (error) {
      console.error('[CDC] Serendipity mode error:', error);
      loadingEl.remove();
      contentEl.createEl('p', {
        text: 'Failed to analyze vault. Check console for details.',
        cls: 'cdc-error',
      });
    }
  }

  /**
   * 연결 목록 렌더링
   */
  private renderConnections(connections: CrossDomainConnection[]): void {
    // 기존 결과 컨테이너 제거
    if (this.resultsContainer) {
      this.resultsContainer.remove();
    }

    this.resultsContainer = this.contentEl.createDiv({ cls: 'cdc-serendipity-list' });

    connections.forEach((conn, index) => {
      const item = this.resultsContainer!.createDiv({ cls: 'cdc-serendipity-item' });

      // Rank badge
      item.createEl('span', {
        text: `#${index + 1}`,
        cls: 'cdc-rank',
      });

      // Connection info
      const info = item.createDiv({ cls: 'cdc-serendipity-info' });

      // Titles
      const titles = info.createDiv({ cls: 'cdc-titles' });
      titles.createEl('strong', { text: conn.sourceNote.title });
      titles.createEl('span', { text: ' ↔ ', cls: 'cdc-arrow' });
      titles.createEl('strong', { text: conn.targetNote.title });

      // Score
      info.createEl('span', {
        text: ` (${conn.serendipityScore.toString()})`,
        cls: `cdc-score cdc-score-${conn.serendipityScore.getLevel()}`,
      });

      // Domain path
      info.createEl('p', {
        text: `${conn.sourceNote.primaryDomain} → ${conn.targetNote.primaryDomain}`,
        cls: 'cdc-domain-path',
      });

      // Connection type
      info.createEl('span', {
        text: getConnectionTypeLabel(conn.connectionType),
        cls: 'cdc-connection-type',
      });

      // Actions
      const actions = item.createDiv({ cls: 'cdc-item-actions' });

      // Open source (모달 닫지 않음)
      const openSourceBtn = actions.createEl('button', {
        text: 'Open Source',
        cls: 'cdc-btn cdc-btn-small',
      });
      openSourceBtn.onclick = () => {
        this.app.workspace.openLinkText(conn.sourceNote.path, '', false);
        // 모달을 닫지 않고 노트만 열기
      };

      // Open target (모달 닫지 않음)
      const openTargetBtn = actions.createEl('button', {
        text: 'Open Target',
        cls: 'cdc-btn cdc-btn-small',
      });
      openTargetBtn.onclick = () => {
        this.app.workspace.openLinkText(conn.targetNote.path, '', false);
        // 모달을 닫지 않고 노트만 열기
      };

      // Generate analogy (if available)
      if (this.analogyUseCase && !conn.analogy) {
        const analogyBtn = actions.createEl('button', {
          text: 'Analogy',
          cls: 'cdc-btn cdc-btn-small cdc-btn-secondary',
        });
        analogyBtn.onclick = async () => {
          analogyBtn.disabled = true;
          analogyBtn.textContent = '...';

          try {
            const analogy = await this.analogyUseCase!.execute(conn);
            conn.analogy = analogy;

            // Show analogy below
            info.createEl('p', {
              text: analogy,
              cls: 'cdc-analogy',
            });
            analogyBtn.remove();
            new Notice('Analogy generated');

            // Analogy 생성 후 '연결하기' 버튼 추가
            this.addCreateLinkButton(actions, conn);
          } catch (error) {
            analogyBtn.textContent = 'Fail';
            analogyBtn.disabled = false;
          }
        };
      }

      // Show existing analogy and '연결하기' button
      if (conn.analogy) {
        info.createEl('p', {
          text: conn.analogy,
          cls: 'cdc-analogy',
        });
        // 이미 analogy가 있으면 연결하기 버튼 추가
        this.addCreateLinkButton(actions, conn);
      }
    });
  }

  /**
   * '연결하기' 버튼 추가
   */
  private addCreateLinkButton(
    container: HTMLElement,
    conn: CrossDomainConnection
  ): void {
    if (!conn.analogy) return;

    const linkBtn = container.createEl('button', {
      text: 'Create Link',
      cls: 'cdc-btn cdc-btn-small cdc-btn-primary',
    });
    linkBtn.onclick = async () => {
      linkBtn.disabled = true;
      linkBtn.textContent = '...';

      try {
        const linkService = this.plugin.getLinkCreationService();

        // 소스 노트 파일 찾기
        const sourceFile = this.app.vault.getAbstractFileByPath(
          conn.sourceNote.path
        );
        if (!sourceFile || !(sourceFile instanceof TFile)) {
          new Notice('소스 노트를 찾을 수 없습니다.');
          linkBtn.textContent = 'Create Link';
          linkBtn.disabled = false;
          return;
        }

        // 타겟 노트 파일 찾기
        const targetFile = this.app.vault.getAbstractFileByPath(
          conn.targetNote.path
        );
        if (!targetFile || !(targetFile instanceof TFile)) {
          new Notice('타겟 노트를 찾을 수 없습니다.');
          linkBtn.textContent = 'Create Link';
          linkBtn.disabled = false;
          return;
        }

        // 양방향 링크 생성
        const result = await linkService.addBidirectionalLink(
          sourceFile,
          targetFile,
          conn.analogy!
        );

        if (result.success) {
          new Notice(result.message);
          linkBtn.textContent = '✓ Linked';
          linkBtn.disabled = true;
          linkBtn.addClass('cdc-btn-success');
        } else {
          new Notice(result.message);
          linkBtn.textContent = 'Create Link';
          linkBtn.disabled = false;
        }
      } catch (error) {
        console.error('[CDC] Link creation failed:', error);
        new Notice('연결 생성에 실패했습니다.');
        linkBtn.textContent = 'Create Link';
        linkBtn.disabled = false;
      }
    };
  }

  /**
   * 상대 시간 문자열 생성
   */
  private getTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

    return date.toLocaleDateString();
  }

  onClose(): void {
    this.contentEl.empty();
    this.resultsContainer = null;
  }
}
