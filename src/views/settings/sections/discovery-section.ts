/**
 * DiscoverySection
 * 연결 발견 설정 섹션
 */

import { Setting } from 'obsidian';
import type CrossDomainConnectorPlugin from '../../../main';

export class DiscoverySection {
  constructor(
    private containerEl: HTMLElement,
    private plugin: CrossDomainConnectorPlugin
  ) {}

  render(): void {
    this.containerEl.createEl('h3', { text: 'Discovery Settings' });

    // Minimum similarity
    new Setting(this.containerEl)
      .setName('Minimum Similarity')
      .setDesc('Minimum embedding similarity threshold (0.0-1.0). Higher values mean stricter matching.')
      .addSlider((slider) => {
        slider
          .setLimits(0.3, 0.9, 0.05)
          .setValue(this.plugin.settings.discovery.minSimilarity)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.discovery.minSimilarity = value;
            await this.plugin.saveSettings();
          });
      })
      .addExtraButton((button) => {
        button
          .setIcon('reset')
          .setTooltip('Reset to default (0.5)')
          .onClick(async () => {
            this.plugin.settings.discovery.minSimilarity = 0.5;
            await this.plugin.saveSettings();
            this.containerEl.empty();
            this.plugin.settingTab?.display();
          });
      });

    // Minimum serendipity score
    new Setting(this.containerEl)
      .setName('Minimum Serendipity Score')
      .setDesc('Minimum serendipity score threshold (0.0-1.0). Higher values show more surprising connections.')
      .addSlider((slider) => {
        slider
          .setLimits(0.2, 0.8, 0.05)
          .setValue(this.plugin.settings.discovery.minSerendipityScore)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.discovery.minSerendipityScore = value;
            await this.plugin.saveSettings();
          });
      })
      .addExtraButton((button) => {
        button
          .setIcon('reset')
          .setTooltip('Reset to default (0.4)')
          .onClick(async () => {
            this.plugin.settings.discovery.minSerendipityScore = 0.4;
            await this.plugin.saveSettings();
            this.containerEl.empty();
            this.plugin.settingTab?.display();
          });
      });

    // Max results
    new Setting(this.containerEl)
      .setName('Maximum Results')
      .setDesc('Maximum number of connections to display')
      .addSlider((slider) => {
        slider
          .setLimits(5, 30, 1)
          .setValue(this.plugin.settings.discovery.maxResults)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.discovery.maxResults = value;
            await this.plugin.saveSettings();
          });
      });

    // Include folders
    new Setting(this.containerEl)
      .setName('Include Folders')
      .setDesc('Only search within these folders (comma-separated). Leave empty to search all.')
      .addTextArea((text) => {
        text
          .setPlaceholder('04_Zettelkasten')
          .setValue(this.plugin.settings.discovery.includeFolders.join(', '))
          .onChange(async (value) => {
            this.plugin.settings.discovery.includeFolders = value
              .split(',')
              .map((s) => s.trim())
              .filter((s) => s.length > 0);
            await this.plugin.saveSettings();
          });
        text.inputEl.rows = 2;
      });

    // Exclude folders
    new Setting(this.containerEl)
      .setName('Exclude Folders')
      .setDesc('Folders to exclude from connection discovery (comma-separated)')
      .addTextArea((text) => {
        text
          .setPlaceholder('templates, attachments, archive')
          .setValue(this.plugin.settings.discovery.excludeFolders.join(', '))
          .onChange(async (value) => {
            this.plugin.settings.discovery.excludeFolders = value
              .split(',')
              .map((s) => s.trim())
              .filter((s) => s.length > 0);
            await this.plugin.saveSettings();
          });
        text.inputEl.rows = 2;
      });
  }
}
