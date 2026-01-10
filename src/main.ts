/**
 * Cross-Domain Connector Plugin
 * PKM 볼트에서 서로 다른 도메인의 노트 간 창발적 연결을 발견하는 플러그인
 */

import { Plugin, TFile } from 'obsidian';
import { CDCSettings, DEFAULT_SETTINGS, migrateSettings } from './types';

// Views
import { CDCMainView, VIEW_TYPE_CDC } from './views/main-view';
import { CDCSettingTab } from './views/settings/settings-tab';

// Services
import {
  initializeAIService,
  updateAIServiceSettings,
  resetAIService,
  AIService,
} from './core/application/services/ai-service';
import { DomainClassificationService } from './core/application/services/domain-classification-service';

// Use Cases
import { DiscoverConnectionsUseCase } from './core/application/use-cases/discover-connections';
import { GenerateAnalogyUseCase } from './core/application/use-cases/generate-analogy';

// Adapters
import { VaultEmbeddingsReader } from './core/adapters/embeddings/vault-embeddings-reader';

export default class CrossDomainConnectorPlugin extends Plugin {
  settings!: CDCSettings;
  settingTab: CDCSettingTab | null = null;

  private aiService: AIService | null = null;
  private embeddingsReader!: VaultEmbeddingsReader;
  private classificationService!: DomainClassificationService;
  private discoverUseCase!: DiscoverConnectionsUseCase;
  private analogyUseCase: GenerateAnalogyUseCase | null = null;

  async onload(): Promise<void> {
    console.log('[CDC] Loading Cross-Domain Connector plugin');

    await this.loadSettings();

    // Initialize adapters
    this.embeddingsReader = new VaultEmbeddingsReader(this.app.vault);

    // Initialize domain classification service
    this.classificationService = new DomainClassificationService(
      this.app.vault,
      (file: TFile) => this.app.metadataCache.getFileCache(file),
      {
        method: this.settings.advanced.classificationMethod,
        domainTagPrefixes: this.settings.advanced.domainTagPrefixes,
      }
    );

    // Initialize AI service if API key is configured
    if (this.settings.ai.apiKeys[this.settings.ai.provider]) {
      this.aiService = initializeAIService(this.settings.ai);
      this.analogyUseCase = new GenerateAnalogyUseCase(this.aiService);
    }

    // Initialize discover connections use case
    this.discoverUseCase = new DiscoverConnectionsUseCase(
      this.app.vault,
      this.embeddingsReader,
      this.classificationService,
      {
        minSimilarity: this.settings.discovery.minSimilarity,
        minSerendipityScore: this.settings.discovery.minSerendipityScore,
        maxResults: this.settings.discovery.maxResults,
        excludeFolders: this.settings.discovery.excludeFolders,
      }
    );

    // Register view
    this.registerView(VIEW_TYPE_CDC, (leaf) => {
      return new CDCMainView(
        leaf,
        this.discoverUseCase,
        this.analogyUseCase
      );
    });

    // Commands
    this.addCommand({
      id: 'open-cdc-view',
      name: 'Open Cross-Domain Connector',
      callback: () => this.activateView(),
    });

    this.addCommand({
      id: 'discover-connections',
      name: 'Discover Cross-Domain Connections for Current Note',
      checkCallback: (checking: boolean) => {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) return false;
        if (!checking) {
          this.activateView();
        }
        return true;
      },
    });

    // Settings tab
    this.settingTab = new CDCSettingTab(this.app, this);
    this.addSettingTab(this.settingTab);

    // Ribbon icon
    this.addRibbonIcon('git-branch', 'Cross-Domain Connector', () => {
      this.activateView();
    });

    // File events - refresh classification index
    this.registerEvent(
      this.app.vault.on('create', () => {
        this.classificationService.refreshIndex();
      })
    );

    this.registerEvent(
      this.app.vault.on('delete', () => {
        this.classificationService.refreshIndex();
      })
    );

    this.registerEvent(
      this.app.vault.on('rename', () => {
        this.classificationService.refreshIndex();
      })
    );

    console.log('[CDC] Cross-Domain Connector plugin loaded');
  }

  async onunload(): Promise<void> {
    console.log('[CDC] Unloading Cross-Domain Connector plugin');
    resetAIService();
  }

  async loadSettings(): Promise<void> {
    const data = await this.loadData();
    this.settings = migrateSettings(data || {});
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);

    // Update AI service
    if (this.settings.ai.apiKeys[this.settings.ai.provider]) {
      if (this.aiService) {
        updateAIServiceSettings(this.settings.ai);
      } else {
        this.aiService = initializeAIService(this.settings.ai);
        this.analogyUseCase = new GenerateAnalogyUseCase(this.aiService);
      }
    } else {
      this.aiService = null;
      this.analogyUseCase = null;
      resetAIService();
    }

    // Update classification service
    this.classificationService = new DomainClassificationService(
      this.app.vault,
      (file: TFile) => this.app.metadataCache.getFileCache(file),
      {
        method: this.settings.advanced.classificationMethod,
        domainTagPrefixes: this.settings.advanced.domainTagPrefixes,
      }
    );

    // Update discover use case
    this.discoverUseCase = new DiscoverConnectionsUseCase(
      this.app.vault,
      this.embeddingsReader,
      this.classificationService,
      {
        minSimilarity: this.settings.discovery.minSimilarity,
        minSerendipityScore: this.settings.discovery.minSerendipityScore,
        maxResults: this.settings.discovery.maxResults,
        excludeFolders: this.settings.discovery.excludeFolders,
      }
    );
  }

  async resetSettings(): Promise<void> {
    this.settings = { ...DEFAULT_SETTINGS };
    await this.saveSettings();
  }

  async getEmbeddingCount(): Promise<number> {
    return this.embeddingsReader.getEmbeddingCount();
  }

  private async activateView(): Promise<void> {
    const { workspace } = this.app;

    let leaf = workspace.getLeavesOfType(VIEW_TYPE_CDC)[0];

    if (!leaf) {
      const rightLeaf = workspace.getRightLeaf(false);
      if (rightLeaf) {
        leaf = rightLeaf;
        await leaf.setViewState({ type: VIEW_TYPE_CDC, active: true });
      }
    }

    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }
}
