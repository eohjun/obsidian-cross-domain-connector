/**
 * Cross-Domain Connector Plugin
 * PKM 볼트에서 서로 다른 도메인의 노트 간 창발적 연결을 발견하는 플러그인
 */

import { Plugin, TFile } from 'obsidian';
import { CDCSettings, DEFAULT_SETTINGS, migrateSettings, SerendipityCache, hydrateSerendipityCache, DeepSerendipityCache } from './types';

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
import { DeepSerendipityUseCase } from './core/application/use-cases/deep-serendipity';

// Adapters
import { VaultEmbeddingsReader } from './core/adapters/embeddings/vault-embeddings-reader';

// Link Creation
import { LinkCreationService } from './core/application/services/link-creation-service';

export default class CrossDomainConnectorPlugin extends Plugin {
  settings!: CDCSettings;
  settingTab: CDCSettingTab | null = null;

  private aiService: AIService | null = null;
  private embeddingsReader!: VaultEmbeddingsReader;
  private classificationService!: DomainClassificationService;
  private discoverUseCase!: DiscoverConnectionsUseCase;
  private analogyUseCase: GenerateAnalogyUseCase | null = null;
  private deepSerendipityUseCase: DeepSerendipityUseCase | null = null;
  private linkCreationService!: LinkCreationService;

  // Serendipity 결과 캐시 (파일 기반 영구 저장)

  async onload(): Promise<void> {
    console.log('[CDC] Loading Cross-Domain Connector plugin');

    await this.loadSettings();

    // Initialize adapters
    this.embeddingsReader = new VaultEmbeddingsReader(this.app.vault);

    // Initialize link creation service
    this.linkCreationService = new LinkCreationService(this.app.vault);

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
      this.deepSerendipityUseCase = new DeepSerendipityUseCase(
        this.embeddingsReader,
        this.classificationService,
        this.aiService,
        {
          maxPairsToEvaluate: this.settings.discovery.deepMaxPairs,
          minQualityScore: this.settings.discovery.deepMinQuality,
          maxResults: this.settings.discovery.maxResults,
          includeFolders: this.settings.discovery.includeFolders,
          excludeFolders: this.settings.discovery.excludeFolders,
        }
      );
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
        includeFolders: this.settings.discovery.includeFolders,
        linkChecker: this.createLinkChecker(),
      }
    );

    // Register view
    this.registerView(VIEW_TYPE_CDC, (leaf) => {
      return new CDCMainView(
        leaf,
        this,
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
      // Update or create Deep Serendipity use case
      this.deepSerendipityUseCase = new DeepSerendipityUseCase(
        this.embeddingsReader,
        this.classificationService,
        this.aiService,
        {
          maxPairsToEvaluate: this.settings.discovery.deepMaxPairs,
          minQualityScore: this.settings.discovery.deepMinQuality,
          maxResults: this.settings.discovery.maxResults,
          includeFolders: this.settings.discovery.includeFolders,
          excludeFolders: this.settings.discovery.excludeFolders,
        }
      );
    } else {
      this.aiService = null;
      this.analogyUseCase = null;
      this.deepSerendipityUseCase = null;
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
        includeFolders: this.settings.discovery.includeFolders,
        linkChecker: this.createLinkChecker(),
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

  /**
   * LinkCreationService 인스턴스 반환
   */
  getLinkCreationService(): LinkCreationService {
    return this.linkCreationService;
  }

  /**
   * 두 노트 경로 간 링크 존재 여부를 확인하는 LinkChecker 생성
   * metadataCache를 사용하여 양방향 링크 확인
   */
  private createLinkChecker(): (path1: string, path2: string) => boolean {
    return (path1: string, path2: string): boolean => {
      const file1 = this.app.vault.getAbstractFileByPath(path1);
      const file2 = this.app.vault.getAbstractFileByPath(path2);

      if (!(file1 instanceof TFile) || !(file2 instanceof TFile)) {
        return false;
      }

      // file1 → file2 링크 확인
      const cache1 = this.app.metadataCache.getFileCache(file1);
      if (cache1?.links) {
        for (const link of cache1.links) {
          const linkedFile = this.app.metadataCache.getFirstLinkpathDest(
            link.link,
            file1.path
          );
          if (linkedFile && linkedFile.path === file2.path) {
            return true;
          }
        }
      }

      // file2 → file1 링크 확인 (양방향)
      const cache2 = this.app.metadataCache.getFileCache(file2);
      if (cache2?.links) {
        for (const link of cache2.links) {
          const linkedFile = this.app.metadataCache.getFirstLinkpathDest(
            link.link,
            file2.path
          );
          if (linkedFile && linkedFile.path === file1.path) {
            return true;
          }
        }
      }

      return false;
    };
  }

  // Serendipity 캐시 관련 메서드 (파일 기반 영구 저장)
  async getSerendipityCache(): Promise<SerendipityCache | null> {
    const data = await this.loadData() as { serendipityCache?: Record<string, unknown> } | null;
    if (!data?.serendipityCache) return null;

    // JSON에서 로드한 plain object를 클래스 인스턴스로 hydrate
    return hydrateSerendipityCache(data.serendipityCache);
  }

  async setSerendipityCache(cache: SerendipityCache): Promise<void> {
    const data = (await this.loadData() || {}) as Record<string, unknown>;
    data.serendipityCache = cache;
    await this.saveData(data);
  }

  async clearSerendipityCache(): Promise<void> {
    const data = (await this.loadData() || {}) as Record<string, unknown>;
    delete data.serendipityCache;
    await this.saveData(data);
  }

  // Deep Serendipity (LLM-First) 관련 메서드
  /**
   * DeepSerendipityUseCase 인스턴스 반환 (AI 서비스 필요)
   */
  getDeepSerendipityUseCase(): DeepSerendipityUseCase | null {
    return this.deepSerendipityUseCase;
  }

  async getDeepSerendipityCache(): Promise<DeepSerendipityCache | null> {
    const data = await this.loadData() as { deepSerendipityCache?: DeepSerendipityCache } | null;
    if (!data?.deepSerendipityCache) return null;
    return data.deepSerendipityCache;
  }

  async setDeepSerendipityCache(cache: DeepSerendipityCache): Promise<void> {
    const data = (await this.loadData() || {}) as Record<string, unknown>;
    data.deepSerendipityCache = cache;
    await this.saveData(data);
  }

  async clearDeepSerendipityCache(): Promise<void> {
    const data = (await this.loadData() || {}) as Record<string, unknown>;
    delete data.deepSerendipityCache;
    await this.saveData(data);
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
