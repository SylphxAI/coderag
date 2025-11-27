# @sylphx/coderag

Core library for intelligent codebase search using hybrid TF-IDF + Vector search.

## Installation

```bash
bun add @sylphx/coderag
```

## Features

- 🔍 **Hybrid Search** - Combines TF-IDF and vector search with RRF fusion
- 🌳 **AST-based Chunking** - Smart code splitting using Synth parsers
- 💾 **Persistent Storage** - SQLite-backed index for instant startup
- ⚡ **Incremental Updates** - Only reindex changed files
- 👁️ **File Watching** - Auto-update index on file changes
- 🧠 **Embeddings** - OpenAI embeddings for semantic search

## Quick Start

```typescript
import { CodebaseIndexer, PersistentStorage } from '@sylphx/coderag'

// Create indexer with persistent storage
const storage = new PersistentStorage({ codebaseRoot: './my-project' })
const indexer = new CodebaseIndexer({
  codebaseRoot: './my-project',
  storage,
})

// Index (instant on subsequent runs)
await indexer.index({ watch: true })

// Search
const results = await indexer.search('authentication', { limit: 10 })
```

## API

### `CodebaseIndexer`

Main class for indexing and searching.

```typescript
const indexer = new CodebaseIndexer({
  codebaseRoot: string,          // Project root path
  storage?: Storage,             // Storage backend (default: in-memory)
  maxFileSize?: number,          // Max file size in bytes (default: 1MB)
  onFileChange?: (event) => void // File change callback
})

// Methods
await indexer.index(options)     // Index codebase
await indexer.search(query, options) // Search
await indexer.startWatch()       // Start file watcher
await indexer.stopWatch()        // Stop file watcher
```

### `PersistentStorage`

SQLite-backed persistent storage.

```typescript
const storage = new PersistentStorage({
  codebaseRoot: string,          // Project root (for .coderag/ folder)
  dbPath?: string                // Custom database path
})
```

### `buildSearchIndex` / `searchDocuments`

Low-level TF-IDF functions.

```typescript
import { buildSearchIndex, searchDocuments } from '@sylphx/coderag'

const documents = [
  { uri: 'file://auth.ts', content: '...' },
  { uri: 'file://user.ts', content: '...' },
]

const index = buildSearchIndex(documents)
const results = searchDocuments('auth', index, { limit: 5 })
```

### AST Chunking

Smart code chunking using Synth parsers.

```typescript
import { chunkCodeByAST } from '@sylphx/coderag'

const chunks = await chunkCodeByAST(code, 'typescript', {
  maxChunkSize: 1500,
  minChunkSize: 100,
})
// Returns: [{ content, type, startLine, endLine }, ...]
```

Supported languages: JavaScript, TypeScript, HTML, JSON, YAML, Markdown

### Vector Storage

For semantic search with embeddings.

```typescript
import { VectorStorage, createEmbeddingProvider } from '@sylphx/coderag'

const provider = await createEmbeddingProvider({
  provider: 'openai',
  model: 'text-embedding-3-small',
})

const vectorStorage = new VectorStorage()
await vectorStorage.addDocument('doc1', embedding, { path: 'auth.ts' })

const results = await vectorStorage.search(queryEmbedding, { limit: 5 })
```

## Search Options

```typescript
interface SearchOptions {
  limit?: number           // Max results (default: 10)
  includeContent?: boolean // Include snippets (default: true)
  fileExtensions?: string[] // Filter by extension
  pathFilter?: string      // Filter by path pattern
  excludePaths?: string[]  // Exclude paths
}
```

## Performance

| Metric | Value |
|--------|-------|
| Indexing speed | ~1000-2000 files/sec |
| Startup with cache | <100ms |
| Search latency | <50ms |
| Memory per 1000 files | ~1-2 MB |

## License

MIT

---

**Powered by [Sylphx](https://github.com/SylphxAI)**

Built with [@sylphx/synth](https://github.com/SylphxAI/synth)
