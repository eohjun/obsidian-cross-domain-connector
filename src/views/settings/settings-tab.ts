/**
 * CDCSettingTab
 * Cross-Domain Connector 설정 탭
 */

import { PluginSettingTab, App, Setting } from 'obsidian';
import type CrossDomainConnectorPlugin from '../../main';
import { AISection } from './sections/ai-section';
import { DiscoverySection } from './sections/discovery-section';
import { AdvancedSection } from './sections/advanced-section';

export class CDCSettingTab extends PluginSettingTab {
  plugin: CrossDomainConnectorPlugin;

  constructor(app: App, plugin: CrossDomainConnectorPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Cross-Domain Connector Settings' });

    // AI Section
    new AISection(containerEl, this.plugin).render();

    // Discovery Section
    new DiscoverySection(containerEl, this.plugin).render();

    // Advanced Section
    new AdvancedSection(containerEl, this.plugin).render();
  }
}
