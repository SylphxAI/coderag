# API Overview

CodeRAG provides a comprehensive API for semantic code search with vector embeddings. This reference documents all exported types, classes, and functions.

## Installation

```bash
npm install @sylphx/coderag
```

## Package Structure

CodeRAG uses ESM-only exports with TypeScript support. The package provides both a main entry point and specialized subpath exports:

### Main Entry Point

```typescript
import { CodebaseIndexer } from '@sylphx/coderag'
```

Exports all core functionality including:
- CodebaseIndexer (primary class)
- Search functions (hybrid, semantic, keyword)
- Embedding providers
- Storage implementations
- AST chunking utilities
- Type definitions

### Subpath Exports

Specialized exports for advanced use cases:

```typescript
// Indexer only
import { CodebaseIndexer } from '@sylphx/coderag/indexer'

// TF-IDF utilities
import { buildSearchIndex, searchDocuments } from '@sylphx/coderag/tfidf'

// Storage implementations
import { PersistentStorage, MemoryStorage } from '@sylphx/coderag/storage'

// Utilities
import { scanFiles, detectLanguage } from '@sylphx/coderag/utils'
```

## Import Patterns

### Basic Usage

```typescript
import { CodebaseIndexer } from '@sylphx/coderag'

const indexer = new CodebaseIndexer({
  codebaseRoot: '/path/to/codebase',
  storage: new PersistentStorage()
})

await indexer.index()
const results = await indexer.search('authentication')
```

### With Embeddings

```typescript
import {
  CodebaseIndexer,
  createEmbeddingProvider,
  PersistentStorage
} from '@sylphx/coderag'

const embeddingProvider = createEmbeddingProvider({
  provider: 'openai',
  model: 'text-embedding-3-small',
  dimensions: 1536,
  apiKey: process.env.OPENAI_API_KEY
})

const indexer = new CodebaseIndexer({
  codebaseRoot: '/path/to/codebase',
  storage: new PersistentStorage(),
  embeddingProvider
})

await indexer.index()
```

### Hybrid Search

```typescript
import { CodebaseIndexer, hybridSearch } from '@sylphx/coderag'

const indexer = new CodebaseIndexer({ /* ... */ })
await indexer.index()

const results = await hybridSearch('authentication flow', indexer, {
  vectorWeight: 0.7, // 70% semantic, 30% keyword
  limit: 10
})
```

## TypeScript Support

CodeRAG includes comprehensive TypeScript definitions:

```typescript
import type {
  IndexerOptions,
  SearchResult,
  EmbeddingProvider,
  CodebaseFile,
  ChunkResult
} from '@sylphx/coderag'

// Type-safe configuration
const options: IndexerOptions = {
  codebaseRoot: './src',
  maxFileSize: 1048576,
  watch: true
}

// Type-safe results
const results: SearchResult[] = await indexer.search('query')
```

## Environment Variables

CodeRAG respects the following environment variables:

```bash
# OpenAI API configuration
OPENAI_API_KEY=your-api-key
OPENAI_BASE_URL=https://api.openai.com/v1  # Optional: custom endpoint

# Embedding model configuration
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=1536  # Optional: override default
```

## Core Concepts

### Chunk-Based Indexing

CodeRAG uses AST-based chunking to split code at semantic boundaries (functions, classes, etc.). This provides better search granularity than file-level indexing.

```typescript
import { chunkCodeByAST } from '@sylphx/coderag'

const chunks = await chunkCodeByAST(
  code,
  'example.ts',
  { maxChunkSize: 1000, preserveContext: true }
)
// Returns: ChunkResult[] with type, startLine, endLine, content
```

### Persistent Storage

CodeRAG uses SQLite via LibSQL for persistent storage:

```typescript
import { PersistentStorage } from '@sylphx/coderag'

const storage = new PersistentStorage({
  codebaseRoot: '/path/to/codebase',
  // Automatically creates ~/.coderag/projects/<hash>/
})
```

### Incremental Updates

File changes are detected and indexed incrementally:

```typescript
const indexer = new CodebaseIndexer({
  codebaseRoot: './src',
  watch: true,
  onFileChange: (event) => {
    console.log(`File ${event.type}: ${event.path}`)
  }
})

await indexer.index()
// Subsequent calls detect changes and update incrementally
```

## API Reference

- [CodebaseIndexer](./indexer.md) - Main indexing and search class
- [Storage](./storage.md) - Persistent and in-memory storage
- [Search Functions](./search.md) - Hybrid, semantic, and keyword search
- [Embeddings](./embeddings.md) - Embedding provider configuration
- [AST Chunking](./chunking.md) - Code chunking utilities
- [Types](./types.md) - TypeScript type definitions

## Next Steps

- Read the [CodebaseIndexer API](./indexer.md) for the main class documentation
- Explore [Search Functions](./search.md) for advanced search capabilities
- Learn about [Embedding Providers](./embeddings.md) for semantic search
