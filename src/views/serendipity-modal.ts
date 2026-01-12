/**
 * SerendipityModal
 * 전체 볼트에서 가장 창발적인 연결을 찾는 모달
 * - Standard Mode: 임베딩 유사도 기반 (기존)
 * - Deep Mode: LLM-First 진정한 창발적 연결 발견
 * - 결과를 파일에 영구 저장하여 옵시디언 재시작 후에도 불러올 수 있음
 */

import { Modal, App, Notice, TFile, normalizePath } from 'obsidian';
import type { CrossDomainConnection } from '../core/domain/entities/cross-domain-connection';
import { getConnectionTypeLabel } from '../core/domain/entities/cross-domain-connection';
import type { DiscoverConnectionsUseCase } from '../core/application/use-cases/discover-connections';
import type { GenerateAnalogyUseCase } from '../core/application/use-cases/generate-analogy';
import type CrossDomainConnectorPlugin from '../main';

type SerendipityMode = 'standard' | 'deep';

export class SerendipityModal extends Modal {
  private resultsContainer: HTMLElement | null = null;
  private currentMode: SerendipityMode = 'standard';
  private modeToggleContainer: HTMLElement | null = null;

  constructor(
    app: App,
    private plugin: CrossDomainConnectorPlugin,
    private discoverUseCase: DiscoverConnectionsUseCase,
    private analogyUseCase: GenerateAnalogyUseCase | null
  ) {
    super(app);
  }

  /**
   * Cross-platform safe 파일 조회
   * iOS/Android에서 getAbstractFileByPath가 null을 반환할 수 있어
   * getMarkdownFiles()에서 폴백 검색
   */
  private getFileSafe(path: string): TFile | null {
    const normalizedPath = normalizePath(path);

    // 먼저 getAbstractFileByPath 시도
    const file = this.app.vault.getAbstractFileByPath(normalizedPath);
    if (file instanceof TFile) {
      return file;
    }

    // iOS/Android 폴백: getMarkdownFiles에서 찾기
    const allFiles = this.app.vault.getMarkdownFiles();
    return allFiles.find(f => f.path === normalizedPath) || null;
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

    // Mode Toggle
    this.renderModeToggle();

    // Load initial mode
    await this.loadMode(this.currentMode);
  }

  /**
   * 모드 토글 UI 렌더링
   */
  private renderModeToggle(): void {
    if (this.modeToggleContainer) {
      this.modeToggleContainer.remove();
    }

    this.modeToggleContainer = this.contentEl.createDiv({ cls: 'cdc-mode-toggle' });

    // Standard Mode 버튼
    const standardBtn = this.modeToggleContainer.createEl('button', {
      text: 'Standard',
      cls: `cdc-mode-btn ${this.currentMode === 'standard' ? 'cdc-mode-active' : ''}`,
    });
    standardBtn.onclick = () => this.switchMode('standard');

    // Deep Mode 버튼 (AI 필요)
    const deepBtn = this.modeToggleContainer.createEl('button', {
      text: 'Deep (LLM)',
      cls: `cdc-mode-btn ${this.currentMode === 'deep' ? 'cdc-mode-active' : ''}`,
    });

    const deepUseCase = this.plugin.getDeepSerendipityUseCase();
    if (!deepUseCase) {
      deepBtn.addClass('cdc-mode-disabled');
      deepBtn.title = 'AI API key required for Deep Mode';
    }

    deepBtn.onclick = async () => {
      if (!deepUseCase) {
        new Notice('Deep Mode requires AI API key configuration');
        return;
      }
      await this.switchMode('deep');
    };

    // 모드 설명
    const modeDesc = this.modeToggleContainer.createDiv({ cls: 'cdc-mode-description' });
    if (this.currentMode === 'standard') {
      modeDesc.setText('Embedding similarity-based discovery');
    } else {
      modeDesc.setText('LLM evaluates creative connections between distant domains');
    }
  }

  /**
   * 모드 전환
   */
  private async switchMode(mode: SerendipityMode): Promise<void> {
    if (this.currentMode === mode) return;

    this.currentMode = mode;
    this.renderModeToggle();

    // Clear results
    if (this.resultsContainer) {
      this.resultsContainer.remove();
      this.resultsContainer = null;
    }

    await this.loadMode(mode);
  }

  /**
   * 모드별 로드
   */
  private async loadMode(mode: SerendipityMode): Promise<void> {
    if (mode === 'standard') {
      await this.loadStandardMode();
    } else {
      await this.loadDeepMode();
    }
  }

  /**
   * Standard Mode 로드
   */
  private async loadStandardMode(): Promise<void> {
    const cache = await this.plugin.getSerendipityCache();

    if (cache && cache.connections.length > 0) {
      this.showStandardSelectionUI(cache);
    } else {
      await this.performStandardSearch();
    }
  }

  /**
   * Deep Mode 로드
   */
  private async loadDeepMode(): Promise<void> {
    const cache = await this.plugin.getDeepSerendipityCache();

    if (cache && cache.connections.length > 0) {
      this.showDeepSelectionUI(cache);
    } else {
      await this.performDeepSearch();
    }
  }

  /**
   * Standard Mode: 이전 결과 vs 새 검색 선택 UI
   */
  private showStandardSelectionUI(cache: { connections: CrossDomainConnection[]; timestamp: number }): void {
    const { contentEl } = this;

    const selectionContainer = contentEl.createDiv({ cls: 'cdc-selection-container' });

    const cacheDate = new Date(cache.timestamp);
    const timeAgo = this.getTimeAgo(cacheDate);

    selectionContainer.createEl('p', {
      text: `Previous results found (${cache.connections.length} connections, ${timeAgo})`,
      cls: 'cdc-cache-info',
    });

    const buttonContainer = selectionContainer.createDiv({ cls: 'cdc-selection-buttons' });

    const loadPreviousBtn = buttonContainer.createEl('button', {
      text: 'Load Previous Results',
      cls: 'cdc-btn cdc-btn-primary',
    });
    loadPreviousBtn.onclick = () => {
      selectionContainer.remove();
      this.renderStandardConnections(cache.connections);
      new Notice(`Loaded ${cache.connections.length} cached connections`);
    };

    const newSearchBtn = buttonContainer.createEl('button', {
      text: 'New Search',
      cls: 'cdc-btn cdc-btn-secondary',
    });
    newSearchBtn.onclick = async () => {
      selectionContainer.remove();
      await this.performStandardSearch();
    };

    const clearCacheBtn = buttonContainer.createEl('button', {
      text: 'Clear Cache',
      cls: 'cdc-btn cdc-btn-small',
    });
    clearCacheBtn.onclick = async () => {
      await this.plugin.clearSerendipityCache();
      selectionContainer.remove();
      await this.performStandardSearch();
      new Notice('Cache cleared');
    };
  }

  /**
   * Deep Mode: 이전 결과 vs 새 검색 선택 UI
   */
  private showDeepSelectionUI(cache: { connections: { sourceNote: { noteId: string; path: string; title: string; primaryDomain: string; tags: string[] }; targetNote: { noteId: string; path: string; title: string; primaryDomain: string; tags: string[] }; creativityScore: number; analogy: string; domainDistance: number; discoveredAt: string }[]; timestamp: number }): void {
    const { contentEl } = this;

    const selectionContainer = contentEl.createDiv({ cls: 'cdc-selection-container' });

    const cacheDate = new Date(cache.timestamp);
    const timeAgo = this.getTimeAgo(cacheDate);

    selectionContainer.createEl('p', {
      text: `Previous Deep results found (${cache.connections.length} connections, ${timeAgo})`,
      cls: 'cdc-cache-info',
    });

    const buttonContainer = selectionContainer.createDiv({ cls: 'cdc-selection-buttons' });

    const loadPreviousBtn = buttonContainer.createEl('button', {
      text: 'Load Previous Results',
      cls: 'cdc-btn cdc-btn-primary',
    });
    loadPreviousBtn.onclick = () => {
      selectionContainer.remove();
      this.renderDeepConnections(cache.connections);
      new Notice(`Loaded ${cache.connections.length} deep connections`);
    };

    const newSearchBtn = buttonContainer.createEl('button', {
      text: 'New Deep Search',
      cls: 'cdc-btn cdc-btn-secondary',
    });
    newSearchBtn.onclick = async () => {
      selectionContainer.remove();
      await this.performDeepSearch();
    };

    const clearCacheBtn = buttonContainer.createEl('button', {
      text: 'Clear Cache',
      cls: 'cdc-btn cdc-btn-small',
    });
    clearCacheBtn.onclick = async () => {
      await this.plugin.clearDeepSerendipityCache();
      selectionContainer.remove();
      await this.performDeepSearch();
      new Notice('Deep cache cleared');
    };
  }

  /**
   * Standard Mode: 검색 수행
   */
  private async performStandardSearch(): Promise<void> {
    const { contentEl } = this;

    const loadingEl = contentEl.createEl('p', {
      text: 'Analyzing vault... This may take a moment.',
      cls: 'cdc-loading',
    });

    try {
      const connections = await this.discoverUseCase.findTopSerendipitousConnections(10);
      loadingEl.remove();

      if (connections.length === 0) {
        contentEl.createEl('p', {
          text: 'No serendipitous connections found. Make sure you have embeddings generated.',
          cls: 'cdc-no-results',
        });
        return;
      }

      await this.plugin.setSerendipityCache({
        connections,
        timestamp: Date.now(),
      });

      contentEl.createEl('p', {
        text: `Found ${connections.length} serendipitous connections:`,
        cls: 'cdc-result-count',
      });

      this.renderStandardConnections(connections);
      new Notice(`Found ${connections.length} connections (saved to cache)`);
    } catch (error) {
      console.error('[CDC] Standard serendipity mode error:', error);
      loadingEl.remove();
      contentEl.createEl('p', {
        text: 'Failed to analyze vault. Check console for details.',
        cls: 'cdc-error',
      });
    }
  }

  /**
   * Deep Mode: 검색 수행
   */
  private async performDeepSearch(): Promise<void> {
    const { contentEl } = this;

    const deepUseCase = this.plugin.getDeepSerendipityUseCase();
    if (!deepUseCase) {
      contentEl.createEl('p', {
        text: 'Deep Mode requires AI API key configuration.',
        cls: 'cdc-error',
      });
      return;
    }

    const loadingEl = contentEl.createEl('p', {
      text: 'Deep analyzing vault with LLM... This may take several minutes.',
      cls: 'cdc-loading',
    });

    // Progress indicator
    const progressEl = contentEl.createEl('p', {
      text: 'Sampling cross-domain pairs and evaluating with LLM...',
      cls: 'cdc-progress',
    });

    try {
      const connections = await deepUseCase.execute();
      loadingEl.remove();
      progressEl.remove();

      if (connections.length === 0) {
        contentEl.createEl('p', {
          text: 'No deep connections found. Try adjusting settings or ensure you have diverse domains in your vault.',
          cls: 'cdc-no-results',
        });
        return;
      }

      // Convert to cache format
      const cacheItems = connections.map(conn => ({
        sourceNote: {
          noteId: conn.sourceNote.noteId,
          path: conn.sourceNote.path,
          title: conn.sourceNote.title,
          primaryDomain: conn.sourceNote.primaryDomain,
          tags: conn.sourceNote.tags,
        },
        targetNote: {
          noteId: conn.targetNote.noteId,
          path: conn.targetNote.path,
          title: conn.targetNote.title,
          primaryDomain: conn.targetNote.primaryDomain,
          tags: conn.targetNote.tags,
        },
        creativityScore: conn.creativityScore,
        analogy: conn.analogy,
        domainDistance: conn.domainDistance,
        discoveredAt: conn.discoveredAt.toISOString(),
      }));

      await this.plugin.setDeepSerendipityCache({
        connections: cacheItems,
        timestamp: Date.now(),
      });

      contentEl.createEl('p', {
        text: `Found ${connections.length} deep creative connections:`,
        cls: 'cdc-result-count',
      });

      this.renderDeepConnections(cacheItems);
      new Notice(`Found ${connections.length} deep connections (saved to cache)`);
    } catch (error) {
      console.error('[CDC] Deep serendipity mode error:', error);
      loadingEl.remove();
      progressEl.remove();
      contentEl.createEl('p', {
        text: 'Failed to perform deep analysis. Check console for details.',
        cls: 'cdc-error',
      });
    }
  }

  /**
   * Standard Mode: 연결 목록 렌더링
   */
  private renderStandardConnections(connections: CrossDomainConnection[]): void {
    if (this.resultsContainer) {
      this.resultsContainer.remove();
    }

    this.resultsContainer = this.contentEl.createDiv({ cls: 'cdc-serendipity-list' });

    connections.forEach((conn, index) => {
      const item = this.resultsContainer!.createDiv({ cls: 'cdc-serendipity-item' });

      item.createEl('span', {
        text: `#${index + 1}`,
        cls: 'cdc-rank',
      });

      const info = item.createDiv({ cls: 'cdc-serendipity-info' });

      const titles = info.createDiv({ cls: 'cdc-titles' });
      titles.createEl('strong', { text: conn.sourceNote.title });
      titles.createEl('span', { text: ' ↔ ', cls: 'cdc-arrow' });
      titles.createEl('strong', { text: conn.targetNote.title });

      info.createEl('span', {
        text: ` (${conn.serendipityScore.toString()})`,
        cls: `cdc-score cdc-score-${conn.serendipityScore.getLevel()}`,
      });

      info.createEl('p', {
        text: `${conn.sourceNote.primaryDomain} → ${conn.targetNote.primaryDomain}`,
        cls: 'cdc-domain-path',
      });

      info.createEl('span', {
        text: getConnectionTypeLabel(conn.connectionType),
        cls: 'cdc-connection-type',
      });

      const actions = item.createDiv({ cls: 'cdc-item-actions' });

      const openSourceBtn = actions.createEl('button', {
        text: 'Open Source',
        cls: 'cdc-btn cdc-btn-small',
      });
      openSourceBtn.onclick = () => {
        this.app.workspace.openLinkText(conn.sourceNote.path, '', false);
      };

      const openTargetBtn = actions.createEl('button', {
        text: 'Open Target',
        cls: 'cdc-btn cdc-btn-small',
      });
      openTargetBtn.onclick = () => {
        this.app.workspace.openLinkText(conn.targetNote.path, '', false);
      };

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

            info.createEl('p', {
              text: analogy,
              cls: 'cdc-analogy',
            });
            analogyBtn.remove();
            new Notice('Analogy generated');

            this.addCreateLinkButton(actions, conn);
          } catch (error) {
            analogyBtn.textContent = 'Fail';
            analogyBtn.disabled = false;
          }
        };
      }

      if (conn.analogy) {
        info.createEl('p', {
          text: conn.analogy,
          cls: 'cdc-analogy',
        });
        this.addCreateLinkButton(actions, conn);
      }
    });
  }

  /**
   * Deep Mode: 연결 목록 렌더링
   */
  private renderDeepConnections(connections: { sourceNote: { noteId: string; path: string; title: string; primaryDomain: string; tags: string[] }; targetNote: { noteId: string; path: string; title: string; primaryDomain: string; tags: string[] }; creativityScore: number; analogy: string; domainDistance: number; discoveredAt: string }[]): void {
    if (this.resultsContainer) {
      this.resultsContainer.remove();
    }

    this.resultsContainer = this.contentEl.createDiv({ cls: 'cdc-serendipity-list cdc-deep-list' });

    connections.forEach((conn, index) => {
      const item = this.resultsContainer!.createDiv({ cls: 'cdc-serendipity-item cdc-deep-item' });

      // Rank badge with creativity score
      const rankBadge = item.createDiv({ cls: 'cdc-rank-badge' });
      rankBadge.createEl('span', {
        text: `#${index + 1}`,
        cls: 'cdc-rank',
      });
      rankBadge.createEl('span', {
        text: `✨ ${(conn.creativityScore * 100).toFixed(0)}%`,
        cls: 'cdc-creativity-score',
      });

      const info = item.createDiv({ cls: 'cdc-serendipity-info' });

      // Titles
      const titles = info.createDiv({ cls: 'cdc-titles' });
      titles.createEl('strong', { text: conn.sourceNote.title });
      titles.createEl('span', { text: ' ↔ ', cls: 'cdc-arrow' });
      titles.createEl('strong', { text: conn.targetNote.title });

      // Domain path with distance indicator
      const domainInfo = info.createDiv({ cls: 'cdc-domain-info' });
      domainInfo.createEl('span', {
        text: `${conn.sourceNote.primaryDomain}`,
        cls: 'cdc-domain-badge',
      });
      domainInfo.createEl('span', { text: ' ⟷ ', cls: 'cdc-domain-arrow' });
      domainInfo.createEl('span', {
        text: `${conn.targetNote.primaryDomain}`,
        cls: 'cdc-domain-badge',
      });

      // Analogy (always present in Deep mode)
      if (conn.analogy && conn.analogy !== '연결 없음') {
        info.createEl('p', {
          text: `💡 ${conn.analogy}`,
          cls: 'cdc-analogy cdc-deep-analogy',
        });
      }

      // Actions
      const actions = item.createDiv({ cls: 'cdc-item-actions' });

      const openSourceBtn = actions.createEl('button', {
        text: 'Open Source',
        cls: 'cdc-btn cdc-btn-small',
      });
      openSourceBtn.onclick = () => {
        this.app.workspace.openLinkText(conn.sourceNote.path, '', false);
      };

      const openTargetBtn = actions.createEl('button', {
        text: 'Open Target',
        cls: 'cdc-btn cdc-btn-small',
      });
      openTargetBtn.onclick = () => {
        this.app.workspace.openLinkText(conn.targetNote.path, '', false);
      };

      // Create Link button (analogy is already generated in Deep mode)
      if (conn.analogy && conn.analogy !== '연결 없음') {
        this.addDeepCreateLinkButton(actions, conn);
      }
    });
  }

  /**
   * Standard Mode: '연결하기' 버튼 추가
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

        // Cross-platform safe 파일 찾기
        const sourceFile = this.getFileSafe(conn.sourceNote.path);
        if (!sourceFile) {
          new Notice('소스 노트를 찾을 수 없습니다.');
          linkBtn.textContent = 'Create Link';
          linkBtn.disabled = false;
          return;
        }

        const targetFile = this.getFileSafe(conn.targetNote.path);
        if (!targetFile) {
          new Notice('타겟 노트를 찾을 수 없습니다.');
          linkBtn.textContent = 'Create Link';
          linkBtn.disabled = false;
          return;
        }

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
   * Deep Mode: '연결하기' 버튼 추가
   */
  private addDeepCreateLinkButton(
    container: HTMLElement,
    conn: { sourceNote: { path: string }; targetNote: { path: string }; analogy: string }
  ): void {
    const linkBtn = container.createEl('button', {
      text: 'Create Link',
      cls: 'cdc-btn cdc-btn-small cdc-btn-primary',
    });
    linkBtn.onclick = async () => {
      linkBtn.disabled = true;
      linkBtn.textContent = '...';

      try {
        const linkService = this.plugin.getLinkCreationService();

        // Cross-platform safe 파일 찾기
        const sourceFile = this.getFileSafe(conn.sourceNote.path);
        if (!sourceFile) {
          new Notice('소스 노트를 찾을 수 없습니다.');
          linkBtn.textContent = 'Create Link';
          linkBtn.disabled = false;
          return;
        }

        const targetFile = this.getFileSafe(conn.targetNote.path);
        if (!targetFile) {
          new Notice('타겟 노트를 찾을 수 없습니다.');
          linkBtn.textContent = 'Create Link';
          linkBtn.disabled = false;
          return;
        }

        const result = await linkService.addBidirectionalLink(
          sourceFile,
          targetFile,
          conn.analogy
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
        console.error('[CDC] Deep link creation failed:', error);
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
    this.modeToggleContainer = null;
  }
}
