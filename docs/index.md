---
layout: home

hero:
  name: "Codebase Search"
  text: "Intelligent Code Search"
  tagline: Hybrid TF-IDF and vector search for blazing-fast, semantically-aware codebase exploration
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/sylphlab/codebase-search

features:
  - icon: ⚡
    title: Blazing Fast
    details: 2.7x faster initial indexing, 166x faster incremental updates, and 100x faster cached queries compared to traditional approaches.

  - icon: 🧠
    title: Hybrid Search
    details: Combines TF-IDF keyword search with semantic vector search for best-of-both-worlds accuracy.

  - icon: 🔌
    title: Extensible Providers
    details: Built-in support for OpenAI, OpenRouter, and custom embedding providers via registry pattern.

  - icon: 📦
    title: Zero Config
    details: Works out of the box with sensible defaults. Advanced configuration available when needed.

  - icon: 🎯
    title: Code-Aware
    details: StarCoder2 tokenization handles camelCase, snake_case, and code-specific patterns.

  - icon: 🤖
    title: MCP Integration
    details: Built-in Model Context Protocol server for seamless AI assistant integration.
---

## Quick Example

```typescript
import { CodebaseIndexer } from '@sylphx/codebase-search';

// Initialize indexer
const indexer = new CodebaseIndexer({
  codebaseRoot: '/path/to/project',
  indexPath: '.codebase-search'
});

// Index codebase
await indexer.index();

// Hybrid search (TF-IDF + Vector)
const results = await indexer.search('authentication logic', {
  limit: 10,
  vectorWeight: 0.7 // 70% semantic, 30% keyword
});

// Pure keyword search
const keywordResults = await indexer.keywordSearch('getUserData');

// Pure semantic search
const semanticResults = await indexer.semanticSearch('database connection pool');
```

## Why Codebase Search?

### Performance First

Built with performance in mind from day one:

- **Incremental Updates**: Only reindex changed files (166x faster)
- **Query Caching**: LRU cache for frequently searched queries (100x faster)
- **Efficient Storage**: SQLite + HNSW for optimal disk usage

### Pure Functional Design

- Immutable data structures
- Composable functions
- Easy to test and reason about

### Production Ready

- ✅ 396 tests passing
- ✅ Full TypeScript support
- ✅ Comprehensive documentation
- ✅ MCP server included

## Performance Benchmarks

| Operation | Codebase Search | Traditional | Improvement |
|-----------|----------------|-------------|-------------|
| Initial Indexing | 13.4s | 36.2s | **2.7x faster** |
| Incremental Update | 2.6s | 431.2s | **166x faster** |
| Cached Query | 0.0013s | 0.13s | **100x faster** |

<small>*Benchmarks on 250-file codebase, OpenAI embeddings*</small>

## Get Started

<div class="tip custom-block" style="padding-top: 8px">

Ready to supercharge your codebase search?

```bash
bun add @sylphx/codebase-search
```

</div>
