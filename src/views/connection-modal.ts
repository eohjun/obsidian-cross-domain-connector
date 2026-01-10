/**
 * ConnectionModal
 * 단일 연결에 대한 상세 정보를 표시하는 모달
 */

import { Modal, App } from 'obsidian';
import type { CrossDomainConnection } from '../core/domain/entities/cross-domain-connection';
import { getConnectionTypeLabel } from '../core/domain/entities/cross-domain-connection';
import type { GenerateAnalogyUseCase } from '../core/application/use-cases/generate-analogy';

export class ConnectionModal extends Modal {
  constructor(
    app: App,
    private connection: CrossDomainConnection,
    private analogyUseCase: GenerateAnalogyUseCase | null
  ) {
    super(app);
  }

  async onOpen(): Promise<void> {
    const { contentEl } = this;
    const conn = this.connection;

    contentEl.empty();
    contentEl.addClass('cdc-connection-modal');

    // Header
    contentEl.createEl('h2', { text: 'Connection Details' });

    // Source note
    const sourceSection = contentEl.createDiv({ cls: 'cdc-note-section' });
    sourceSection.createEl('h3', { text: 'Source Note' });
    sourceSection.createEl('p', {
      text: conn.sourceNote.title,
      cls: 'cdc-note-title',
    });
    sourceSection.createEl('p', {
      text: `Domain: ${conn.sourceNote.primaryDomain}`,
      cls: 'cdc-note-domain',
    });
    sourceSection.createEl('p', {
      text: `Tags: ${conn.sourceNote.tags.join(', ') || 'None'}`,
      cls: 'cdc-note-tags',
    });

    // Arrow
    contentEl.createEl('div', { text: '↓', cls: 'cdc-arrow-down' });

    // Target note
    const targetSection = contentEl.createDiv({ cls: 'cdc-note-section' });
    targetSection.createEl('h3', { text: 'Target Note' });
    targetSection.createEl('p', {
      text: conn.targetNote.title,
      cls: 'cdc-note-title',
    });
    targetSection.createEl('p', {
      text: `Domain: ${conn.targetNote.primaryDomain}`,
      cls: 'cdc-note-domain',
    });
    targetSection.createEl('p', {
      text: `Tags: ${conn.targetNote.tags.join(', ') || 'None'}`,
      cls: 'cdc-note-tags',
    });

    // Connection metrics
    const metricsSection = contentEl.createDiv({ cls: 'cdc-metrics-section' });
    metricsSection.createEl('h3', { text: 'Connection Metrics' });

    const metricsGrid = metricsSection.createDiv({ cls: 'cdc-metrics-grid' });

    // Serendipity score
    const serendipityItem = metricsGrid.createDiv({ cls: 'cdc-metric-item' });
    serendipityItem.createEl('span', { text: 'Serendipity', cls: 'cdc-metric-label' });
    serendipityItem.createEl('span', {
      text: conn.serendipityScore.toString(),
      cls: `cdc-metric-value cdc-score-${conn.serendipityScore.getLevel()}`,
    });

    // Similarity
    const similarityItem = metricsGrid.createDiv({ cls: 'cdc-metric-item' });
    similarityItem.createEl('span', { text: 'Similarity', cls: 'cdc-metric-label' });
    similarityItem.createEl('span', {
      text: `${(conn.similarity * 100).toFixed(1)}%`,
      cls: 'cdc-metric-value',
    });

    // Domain distance
    const distanceItem = metricsGrid.createDiv({ cls: 'cdc-metric-item' });
    distanceItem.createEl('span', { text: 'Domain Distance', cls: 'cdc-metric-label' });
    distanceItem.createEl('span', {
      text: conn.domainDistance.toString(),
      cls: 'cdc-metric-value',
    });

    // Connection type
    const typeItem = metricsGrid.createDiv({ cls: 'cdc-metric-item' });
    typeItem.createEl('span', { text: 'Connection Type', cls: 'cdc-metric-label' });
    typeItem.createEl('span', {
      text: getConnectionTypeLabel(conn.connectionType),
      cls: 'cdc-metric-value',
    });

    // Analogy section
    const analogySection = contentEl.createDiv({ cls: 'cdc-analogy-section' });
    analogySection.createEl('h3', { text: 'Analogy' });

    if (conn.analogy) {
      analogySection.createEl('p', {
        text: conn.analogy,
        cls: 'cdc-analogy-text',
      });
    } else if (this.analogyUseCase) {
      const generateBtn = analogySection.createEl('button', {
        text: 'Generate Analogy',
        cls: 'cdc-btn cdc-btn-primary',
      });
      generateBtn.onclick = async () => {
        generateBtn.disabled = true;
        generateBtn.textContent = 'Generating...';

        try {
          const analogy = await this.analogyUseCase!.execute(conn);
          this.connection.analogy = analogy;
          generateBtn.remove();
          analogySection.createEl('p', {
            text: analogy,
            cls: 'cdc-analogy-text',
          });
        } catch (error) {
          generateBtn.textContent = 'Failed - Retry';
          generateBtn.disabled = false;
        }
      };
    } else {
      analogySection.createEl('p', {
        text: 'Configure AI settings to generate analogies.',
        cls: 'cdc-no-ai',
      });
    }

    // Actions
    const actions = contentEl.createDiv({ cls: 'cdc-modal-actions' });

    const openSourceBtn = actions.createEl('button', {
      text: 'Open Source Note',
      cls: 'cdc-btn',
    });
    openSourceBtn.onclick = () => {
      this.app.workspace.openLinkText(conn.sourceNote.path, '', false);
      this.close();
    };

    const openTargetBtn = actions.createEl('button', {
      text: 'Open Target Note',
      cls: 'cdc-btn cdc-btn-primary',
    });
    openTargetBtn.onclick = () => {
      this.app.workspace.openLinkText(conn.targetNote.path, '', false);
      this.close();
    };
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
