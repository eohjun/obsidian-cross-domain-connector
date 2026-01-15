# Cross-Domain Connector

An Obsidian plugin that discovers serendipitous connections between notes in different domains using embeddings and AI-powered analogy generation.

## Features

- **Serendipity Score Algorithm**: Prioritizes connections that are semantically similar but across different domains
- **Domain Classification**: Classify notes by tags, folders, or clusters
- **AI Analogy Generation**: Generate meaningful explanations for discovered connections
- **Serendipity Mode**: Find top 10 most serendipitous connections across entire vault
- **Auto-Exclude Linked Notes**: Excludes already-linked notes to show only novel connections
- **Deep Serendipity Mode**: LLM-first discovery for higher quality connections

## PKM Workflow

```
Vault Notes → Cross-Domain Connector → Serendipitous Connections
                    ↓
         ┌─────────┴─────────┐
         ↓                   ↓
   Connection List      AI Analogy
         ↓                   ↓
   Bidirectional      Knowledge Synthesis
   Link Creation
```

## Serendipity Score Algorithm

```
SerendipityScore = (Similarity × 0.4 + DomainDistance × 0.6) × NoveltyPenalty × SpecificityPenalty
```

- **Similarity**: Semantic similarity from embeddings (0-1)
- **DomainDistance**: How different the domains are (0-1)
- **NoveltyPenalty**: Reduces score for already-linked notes
- **SpecificityPenalty**: Penalizes generic/hub notes

## Supported AI Providers

| Provider | Model | Notes |
|----------|-------|-------|
| **OpenAI** | GPT-4o-mini | Default, fast analogy generation |
| **OpenAI** | GPT-4o | Higher quality analogies |
| **Google Gemini** | Gemini 1.5 Pro/Flash | Alternative provider |
| **Anthropic** | Claude 3.5 Sonnet | Deep analogies |

## Installation

### BRAT (Recommended)

1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin
2. Open BRAT settings
3. Click "Add Beta plugin"
4. Enter: `eohjun/obsidian-cross-domain-connector`
5. Enable the plugin

### Manual

1. Download `main.js`, `manifest.json`, `styles.css` from the latest release
2. Create folder: `<vault>/.obsidian/plugins/cross-domain-connector/`
3. Copy downloaded files to the folder
4. Enable the plugin in Obsidian settings

## Dependencies (Required)

- **[Vault Embeddings](https://github.com/eohjun/obsidian-vault-embeddings)**: Provides embedding data for similarity calculation

Vault Embeddings must be installed and configured for this plugin to work.

## Setup

### API Key Configuration

1. Open Settings → Cross-Domain Connector
2. In **AI Provider** section:
   - Select AI Provider (OpenAI, Gemini, or Anthropic)
   - Enter API key for analogy generation

## Commands

| Command | Description |
|---------|-------------|
| **Open Cross-Domain Connector** | Open the main sidebar view |
| **Discover Cross-Domain Connections for Current Note** | Find connections for active note |

## Usage Workflow

```
1. Open a note you want to find connections for
2. Run "Discover Cross-Domain Connections" command
3. Review suggested connections with serendipity scores
4. Click "Generate Analogy" for AI-powered connection explanation
5. Click "Create Bidirectional Link" to link the notes
6. Use "Serendipity Mode" to explore vault-wide discoveries
```

## Settings

| Setting | Description | Default |
|---------|-------------|---------|
| **AI Provider** | Analogy generation provider | OpenAI |
| **API Key** | Provider API key | - |
| **Min Similarity** | Minimum semantic similarity | 0.5 |
| **Min Serendipity Score** | Minimum serendipity threshold | 0.4 |
| **Max Results** | Maximum connections to show | 10 |
| **Exclude Folders** | Folders to exclude from search | templates, attachments |
| **Include Folders** | Folders to search (empty = all) | 04_Zettelkasten |
| **Classification Method** | Domain classification method | tag |
| **Domain Tag Prefixes** | Tag prefixes for domain detection | domain/, topic/ |
| **Deep Max Pairs** | Max pairs for Deep mode | 30 |
| **Deep Min Quality** | Min quality score for Deep mode | 0.5 |

## Deep Serendipity Mode

Deep mode uses LLM-first discovery for higher quality connections:

1. Gathers candidate pairs based on embeddings
2. Sends pairs to LLM for quality evaluation
3. Returns only high-quality, meaningful connections
4. More accurate but uses more API tokens

## Related Plugins

This plugin works well with:

- **[Vault Embeddings](https://github.com/eohjun/obsidian-vault-embeddings)**: Required - Provides embedding data
- **[PKM Note Recommender](https://github.com/eohjun/obsidian-pkm-note-recommender)**: Same-domain connections → Cross-domain expansion
- **[Socratic Challenger](https://github.com/eohjun/obsidian-socratic-challenger)**: Start deep dialogue from discovered connections
- **[Knowledge Synthesizer](https://github.com/eohjun/obsidian-knowledge-synthesizer)**: Synthesize cross-domain connections into new notes

## Development

```bash
# Install dependencies
npm install

# Development with watch mode
npm run dev

# Production build
npm run build
```

## License

MIT
