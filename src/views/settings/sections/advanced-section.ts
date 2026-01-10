/**
 * AdvancedSection
 * 고급 설정 섹션
 */

import { Setting, Notice } from 'obsidian';
import type CrossDomainConnectorPlugin from '../../../main';
import type { ClassificationMethod } from '../../../core/domain/interfaces/domain-classifier';

export class AdvancedSection {
  constructor(
    private containerEl: HTMLElement,
    private plugin: CrossDomainConnectorPlugin
  ) {}

  render(): void {
    this.containerEl.createEl('h3', { text: 'Advanced Settings' });

    // Classification method
    new Setting(this.containerEl)
      .setName('Domain Classification Method')
      .setDesc('How to determine the domain of each note')
      .addDropdown((dropdown) => {
        dropdown
          .addOption('tag', 'Tag-based (uses #domain/ or #topic/ tags)')
          .addOption('folder', 'Folder-based (uses folder structure)')
          .addOption('cluster', 'Cluster-based (auto-detect from embeddings)')
          .setValue(this.plugin.settings.advanced.classificationMethod)
          .onChange(async (value) => {
            this.plugin.settings.advanced.classificationMethod =
              value as ClassificationMethod;
            await this.plugin.saveSettings();
          });
      });

    // Domain tag prefixes
    new Setting(this.containerEl)
      .setName('Domain Tag Prefixes')
      .setDesc('Tag prefixes to use for domain detection (comma-separated)')
      .addText((text) => {
        text
          .setPlaceholder('domain/, topic/')
          .setValue(this.plugin.settings.advanced.domainTagPrefixes.join(', '))
          .onChange(async (value) => {
            this.plugin.settings.advanced.domainTagPrefixes = value
              .split(',')
              .map((s) => s.trim())
              .filter((s) => s.length > 0);
            await this.plugin.saveSettings();
          });
      });

    // Debug mode
    new Setting(this.containerEl)
      .setName('Debug Mode')
      .setDesc('Enable detailed logging in the console')
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.advanced.debugMode)
          .onChange(async (value) => {
            this.plugin.settings.advanced.debugMode = value;
            await this.plugin.saveSettings();
          });
      });

    // Embedding folder info
    new Setting(this.containerEl)
      .setName('Embeddings Source')
      .setDesc('Cross-Domain Connector uses embeddings from the Vault Embeddings plugin (09_Embedded folder)')
      .addButton((button) => {
        button
          .setButtonText('Check Embeddings')
          .onClick(async () => {
            const count = await this.plugin.getEmbeddingCount();
            if (count > 0) {
              new Notice(`Found ${count} embeddings available`);
            } else {
              new Notice('No embeddings found. Please run Vault Embeddings plugin first.');
            }
          });
      });

    // Reset settings
    new Setting(this.containerEl)
      .setName('Reset Settings')
      .setDesc('Reset all settings to default values')
      .addButton((button) => {
        button
          .setButtonText('Reset')
          .setWarning()
          .onClick(async () => {
            if (confirm('Are you sure you want to reset all settings to default?')) {
              await this.plugin.resetSettings();
              this.containerEl.empty();
              this.plugin.settingTab?.display();
              new Notice('Settings reset to default');
            }
          });
      });
  }
}
