/**
 * AISection
 * AI 설정 섹션
 */

import { Setting } from 'obsidian';
import type CrossDomainConnectorPlugin from '../../../main';
import type { AIProvider } from '../../../core/application/services/ai-service';
import { PROVIDER_MODELS } from '../../../types';

export class AISection {
  constructor(
    private containerEl: HTMLElement,
    private plugin: CrossDomainConnectorPlugin
  ) {}

  render(): void {
    this.containerEl.createEl('h3', { text: 'AI Settings' });

    // Provider selection
    new Setting(this.containerEl)
      .setName('AI Provider')
      .setDesc('Select the AI provider for analogy generation')
      .addDropdown((dropdown) => {
        dropdown
          .addOption('claude', 'Claude (Anthropic)')
          .addOption('openai', 'OpenAI')
          .addOption('gemini', 'Gemini (Google)')
          .addOption('grok', 'Grok (xAI)')
          .setValue(this.plugin.settings.ai.provider)
          .onChange(async (value) => {
            this.plugin.settings.ai.provider = value as AIProvider;
            // 프로바이더 변경 시 기본 모델 설정
            const models = PROVIDER_MODELS[value as AIProvider];
            if (models && models.length > 0) {
              this.plugin.settings.ai.model = models[0].id;
            }
            await this.plugin.saveSettings();
            // 설정 화면 새로고침
            this.containerEl.empty();
            this.plugin.settingTab?.display();
          });
      });

    // Model selection
    const currentProvider = this.plugin.settings.ai.provider;
    const models = PROVIDER_MODELS[currentProvider] || [];

    new Setting(this.containerEl)
      .setName('Model')
      .setDesc('Select the AI model')
      .addDropdown((dropdown) => {
        models.forEach((model) => {
          dropdown.addOption(model.id, `${model.name}${model.description ? ` - ${model.description}` : ''}`);
        });
        dropdown
          .setValue(this.plugin.settings.ai.model)
          .onChange(async (value) => {
            this.plugin.settings.ai.model = value;
            await this.plugin.saveSettings();
          });
      });

    // API Key
    const apiKeyDesc = this.getApiKeyDescription(currentProvider);
    new Setting(this.containerEl)
      .setName(`${this.getProviderName(currentProvider)} API Key`)
      .setDesc(apiKeyDesc)
      .addText((text) => {
        text
          .setPlaceholder('Enter your API key')
          .setValue(this.plugin.settings.ai.apiKeys[currentProvider] || '')
          .onChange(async (value) => {
            this.plugin.settings.ai.apiKeys[currentProvider] = value;
            await this.plugin.saveSettings();
          });
        text.inputEl.type = 'password';
      });

    // API Key help link
    const helpLink = this.getApiKeyHelpLink(currentProvider);
    if (helpLink) {
      new Setting(this.containerEl)
        .setName('Get API Key')
        .setDesc(`Get your ${this.getProviderName(currentProvider)} API key`)
        .addButton((button) => {
          button
            .setButtonText('Open')
            .onClick(() => {
              window.open(helpLink, '_blank');
            });
        });
    }
  }

  private getProviderName(provider: AIProvider): string {
    const names: Record<AIProvider, string> = {
      claude: 'Anthropic',
      openai: 'OpenAI',
      gemini: 'Google',
      grok: 'xAI',
    };
    return names[provider];
  }

  private getApiKeyDescription(provider: AIProvider): string {
    const descriptions: Record<AIProvider, string> = {
      claude: 'Your Anthropic API key for Claude models',
      openai: 'Your OpenAI API key. Note: Reasoning models (o1, o3, gpt-5.x) do not support temperature.',
      gemini: 'Your Google AI API key for Gemini models',
      grok: 'Your xAI API key for Grok models',
    };
    return descriptions[provider];
  }

  private getApiKeyHelpLink(provider: AIProvider): string | null {
    const links: Record<AIProvider, string> = {
      claude: 'https://console.anthropic.com/settings/keys',
      openai: 'https://platform.openai.com/api-keys',
      gemini: 'https://aistudio.google.com/app/apikey',
      grok: 'https://console.x.ai',
    };
    return links[provider] || null;
  }
}
