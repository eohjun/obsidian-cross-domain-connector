/**
 * CDCMainView
 * Cross-Domain Connector 메인 사이드바 뷰
 */

import { ItemView, WorkspaceLeaf, Notice, TFile, normalizePath } from 'obsidian';
import type { CrossDomainConnection } from '../core/domain/entities/cross-domain-connection';
import { getConnectionTypeLabel } from '../core/domain/entities/cross-domain-connection';
import { generateNoteId } from '../core/domain/utils/note-id';
import type { DiscoverConnectionsUseCase } from '../core/application/use-cases/discover-connections';
import type { GenerateAnalogyUseCase } from '../core/application/use-cases/generate-analogy';
import type CrossDomainConnectorPlugin from '../main';
import { SerendipityModal } from './serendipity-modal';

export const VIEW_TYPE_CDC = 'cross-domain-connector-view';

export class CDCMainView extends ItemView {
  private resultsContainer: HTMLElement | null = null;
  private statusEl: HTMLElement | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    private plugin: CrossDomainConnectorPlugin,
    private discoverUseCase: DiscoverConnectionsUseCase,
    private analogyUseCase: GenerateAnalogyUseCase | null
  ) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_CDC;
  }

  getDisplayText(): string {
    return 'Cross-Domain Connector';
  }

  getIcon(): string {
    return 'git-branch';
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
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass('cdc-container');

    // Header
    const header = container.createDiv({ cls: 'cdc-header' });
    header.createEl('h4', { text: 'Cross-Domain Connector' });

    // Buttons
    const buttonContainer = container.createDiv({ cls: 'cdc-button-container' });

    const discoverBtn = buttonContainer.createEl('button', {
      text: 'Discover Connections',
      cls: 'cdc-btn cdc-btn-primary',
    });
    discoverBtn.onclick = () => this.discoverConnections();

    const serendipityBtn = buttonContainer.createEl('button', {
      text: 'Serendipity Mode',
      cls: 'cdc-btn cdc-btn-secondary',
    });
    serendipityBtn.onclick = () => this.openSerendipityMode();

    // Status
    this.statusEl = container.createDiv({ cls: 'cdc-status' });
    this.statusEl.setText('Select a note and click "Discover Connections"');

    // Results container
    this.resultsContainer = container.createDiv({ cls: 'cdc-results' });
  }

  async onClose(): Promise<void> {
    // Cleanup
  }

  /**
   * 현재 노트에서 크로스 도메인 연결 발견
   */
  private async discoverConnections(): Promise<void> {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) {
      new Notice('No active note selected');
      return;
    }

    if (this.statusEl) {
      this.statusEl.setText('Discovering connections...');
    }

    try {
      const noteId = generateNoteId(activeFile.path);
      const connections = await this.discoverUseCase.execute(noteId);

      this.renderConnections(connections, activeFile.basename);

      if (connections.length === 0) {
        new Notice('No cross-domain connections found');
      } else {
        new Notice(`Found ${connections.length} connections`);
      }
    } catch (error) {
      console.error('[CDC] Error discovering connections:', error);
      new Notice('Failed to discover connections');
      if (this.statusEl) {
        this.statusEl.setText('Error: Failed to discover connections');
      }
    }
  }

  /**
   * 연결 결과 렌더링
   */
  private renderConnections(
    connections: CrossDomainConnection[],
    sourceTitle: string
  ): void {
    if (!this.resultsContainer) return;
    this.resultsContainer.empty();

    if (this.statusEl) {
      this.statusEl.setText(
        connections.length > 0
          ? `Found ${connections.length} connections from "${sourceTitle}"`
          : 'No connections found'
      );
    }

    if (connections.length === 0) {
      this.resultsContainer.createEl('p', {
        text: 'No cross-domain connections found for this note.',
        cls: 'cdc-no-results',
      });
      return;
    }

    connections.forEach((conn) => {
      const card = this.resultsContainer!.createDiv({ cls: 'cdc-connection-card' });

      // Header: Score + Title
      const cardHeader = card.createDiv({ cls: 'cdc-card-header' });

      const scoreBadge = cardHeader.createEl('span', {
        text: conn.serendipityScore.toString(),
        cls: `cdc-score cdc-score-${conn.serendipityScore.getLevel()}`,
      });

      cardHeader.createEl('h5', {
        text: conn.targetNote.title,
        cls: 'cdc-card-title',
      });

      // Domain path
      card.createEl('p', {
        text: `${conn.sourceNote.primaryDomain} → ${conn.targetNote.primaryDomain}`,
        cls: 'cdc-domain-path',
      });

      // Connection type
      card.createEl('span', {
        text: getConnectionTypeLabel(conn.connectionType),
        cls: 'cdc-connection-type',
      });

      // Similarity info
      card.createEl('p', {
        text: `Similarity: ${(conn.similarity * 100).toFixed(1)}%`,
        cls: 'cdc-similarity',
      });

      // Actions
      const actions = card.createDiv({ cls: 'cdc-card-actions' });

      // Generate Analogy button (if AI service available)
      if (this.analogyUseCase && !conn.analogy) {
        const analogyBtn = actions.createEl('button', {
          text: 'Generate Analogy',
          cls: 'cdc-btn cdc-btn-small',
        });
        analogyBtn.onclick = async () => {
          analogyBtn.disabled = true;
          analogyBtn.textContent = 'Generating...';

          try {
            const analogy = await this.analogyUseCase!.execute(conn);
            conn.analogy = analogy;

            // Show analogy
            card.createEl('p', {
              text: analogy,
              cls: 'cdc-analogy',
            });
            analogyBtn.remove();

            // Analogy 생성 후 '연결하기' 버튼 추가
            this.addCreateLinkButton(actions, conn);
          } catch (error) {
            console.error('[CDC] Analogy generation failed:', error);
            analogyBtn.textContent = 'Failed';
            analogyBtn.disabled = false;
          }
        };
      }

      // 이미 analogy가 있으면 연결하기 버튼 추가
      if (conn.analogy) {
        this.addCreateLinkButton(actions, conn);
      }

      // Open note button
      const openBtn = actions.createEl('button', {
        text: 'Open Note',
        cls: 'cdc-btn cdc-btn-small cdc-btn-secondary',
      });
      openBtn.onclick = () => {
        this.app.workspace.openLinkText(conn.targetNote.path, '', false);
      };
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
   * Serendipity 모드 열기
   */
  private async openSerendipityMode(): Promise<void> {
    const modal = new SerendipityModal(
      this.app,
      this.plugin,
      this.discoverUseCase,
      this.analogyUseCase
    );
    modal.open();
  }
}
