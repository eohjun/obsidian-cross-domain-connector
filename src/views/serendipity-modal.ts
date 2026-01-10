/**
 * SerendipityModal
 * 전체 볼트에서 가장 창발적인 연결을 찾는 모달
 */

import { Modal, App, Notice } from 'obsidian';
import type { CrossDomainConnection } from '../core/domain/entities/cross-domain-connection';
import { getConnectionTypeLabel } from '../core/domain/entities/cross-domain-connection';
import type { DiscoverConnectionsUseCase } from '../core/application/use-cases/discover-connections';
import type { GenerateAnalogyUseCase } from '../core/application/use-cases/generate-analogy';

export class SerendipityModal extends Modal {
  constructor(
    app: App,
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

      contentEl.createEl('p', {
        text: `Found ${connections.length} serendipitous connections:`,
        cls: 'cdc-result-count',
      });

      this.renderConnections(connections);
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
    const listEl = this.contentEl.createDiv({ cls: 'cdc-serendipity-list' });

    connections.forEach((conn, index) => {
      const item = listEl.createDiv({ cls: 'cdc-serendipity-item' });

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

      // Open source
      const openSourceBtn = actions.createEl('button', {
        text: 'Open Source',
        cls: 'cdc-btn cdc-btn-small',
      });
      openSourceBtn.onclick = () => {
        this.app.workspace.openLinkText(conn.sourceNote.path, '', false);
        this.close();
      };

      // Open target
      const openTargetBtn = actions.createEl('button', {
        text: 'Open Target',
        cls: 'cdc-btn cdc-btn-small',
      });
      openTargetBtn.onclick = () => {
        this.app.workspace.openLinkText(conn.targetNote.path, '', false);
        this.close();
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
          } catch (error) {
            analogyBtn.textContent = 'Fail';
            analogyBtn.disabled = false;
          }
        };
      }

      // Show existing analogy
      if (conn.analogy) {
        info.createEl('p', {
          text: conn.analogy,
          cls: 'cdc-analogy',
        });
      }
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
