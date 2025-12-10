# CodebaseIndexer

The primary class for indexing and searching codebases. Provides TF-IDF keyword search, optional vector search, and hybrid search capabilities.

## Constructor

```typescript
new CodebaseIndexer(options?: IndexerOptions)
```

Creates a new indexer instance.

### Parameters

**options** `IndexerOptions` (optional)

Configuration options for the indexer:

```typescript
interface IndexerOptions {
  codebaseRoot?: string              // Root directory (default: process.cwd())
  maxFileSize?: number               // Max file size in bytes (default: 1MB)
  storage?: Storage                  // Storage implementation (default: MemoryStorage)
  onProgress?: (current: number, total: number, file: string) => void
  watch?: boolean                    // Enable file watching (default: false)
  onFileChange?: (event: FileChangeEvent) => void
  embeddingProvider?: EmbeddingProvider  // Optional for vector search
  vectorBatchSize?: number           // Embedding batch size (default: 10)
  indexingBatchSize?: number         // Files per batch (default: 50)
  lowMemoryMode?: boolean            // Use SQL search (default: true with PersistentStorage)
}
```

### Returns

A new `CodebaseIndexer` instance.

### Example

```typescript
import { CodebaseIndexer, PersistentStorage } from '@sylphx/coderag'

const indexer = new CodebaseIndexer({
  codebaseRoot: '/path/to/project',
  storage: new PersistentStorage(),
  maxFileSize: 2 * 1024 * 1024,  // 2MB
  watch: true,
  onProgress: (current, total, file) => {
    console.log(`Indexing ${current}/${total}: ${file}`)
  }
})
```

## Methods

### index()

Index or update the codebase index.

```typescript
async index(options?: IndexerOptions): Promise<void>
```

Scans the codebase, chunks files at semantic boundaries, and builds TF-IDF and optional vector indexes. Automatically detects changes and performs incremental updates when using persistent storage.

#### Parameters

**options** `IndexerOptions` (optional) - Override constructor options for this indexing run.

#### Behavior

1. **First Run**: Full index of all files
2. **Subsequent Runs**: Incremental updates (detects added, changed, deleted files)
3. **Chunk-Level Indexing**: Uses AST to split code at function/class boundaries
4. **Progress Tracking**: Calls `onProgress` callback during indexing

#### Example

```typescript
// Initial index
await indexer.index()

// Re-index with progress tracking
await indexer.index({
  onProgress: (current, total, file) => {
    const percent = Math.round((current / total) * 100)
    console.log(`${percent}% - ${file}`)
  }
})
```

### search()

Search the indexed codebase using TF-IDF or BM25 scoring.

```typescript
async search(
  query: string,
  options?: SearchOptions
): Promise<SearchResult[]>
```

#### Parameters

**query** `string` - Search query (tokenized and ranked)

**options** `SearchOptions` (optional)

```typescript
interface SearchOptions {
  limit?: number              // Max results (default: 10)
  includeContent?: boolean    // Include snippets (default: true)
  fileExtensions?: string[]   // Filter by extensions (e.g., ['.ts', '.js'])
  pathFilter?: string         // Include paths containing string
  excludePaths?: string[]     // Exclude paths containing strings
  contextLines?: number       // Snippet context (default: 3)
  maxSnippetChars?: number    // Max snippet length (default: 2000)
  maxSnippetBlocks?: number   // Max code blocks (default: 4)
}
```

#### Returns

`Promise<SearchResult[]>` - Ranked search results

```typescript
interface SearchResult {
  path: string              // File path
  score: number            // Relevance score
  matchedTerms: string[]   // Matched query terms
  language?: string        // Detected language
  size: number            // Content size
  snippet?: string        // Code snippet with line numbers
  chunkType?: string      // AST node type (e.g., 'FunctionDeclaration')
  startLine?: number      // Chunk start line
  endLine?: number        // Chunk end line
}
```

#### Example

```typescript
// Basic search
const results = await indexer.search('authentication')

// Advanced search with filters
const results = await indexer.search('user login', {
  limit: 20,
  fileExtensions: ['.ts', '.tsx'],
  pathFilter: 'src/auth',
  excludePaths: ['node_modules', 'dist']
})

// Process results
for (const result of results) {
  console.log(`${result.path}:${result.startLine}`)
  console.log(`Score: ${result.score.toFixed(2)}`)
  console.log(`Matched: ${result.matchedTerms.join(', ')}`)
  console.log(result.snippet)
}
```

### startWatch()

Start watching for file changes.

```typescript
async startWatch(): Promise<void>
```

Uses `@parcel/watcher` for native file system events (FSEvents on macOS, inotify on Linux). File changes trigger incremental index updates.

#### Example

```typescript
const indexer = new CodebaseIndexer({
  codebaseRoot: './src',
  onFileChange: (event) => {
    console.log(`${event.type}: ${event.path} at ${event.timestamp}`)
  }
})

await indexer.index()
await indexer.startWatch()
// Index updates automatically on file changes
```

### stopWatch()

Stop watching for file changes.

```typescript
async stopWatch(): Promise<void>
```

Cleans up file watcher and pending updates.

#### Example

```typescript
await indexer.stopWatch()
```

### getStatus()

Get current indexing status.

```typescript
getStatus(): IndexingStatus
```

#### Returns

```typescript
interface IndexingStatus {
  isIndexing: boolean      // Currently indexing
  progress: number        // 0-100
  totalFiles: number      // Total files found
  processedFiles: number  // Files processed
  totalChunks: number     // Total chunks created
  indexedChunks: number   // Chunks indexed
  currentFile?: string    // Current file being processed
}
```

#### Example

```typescript
const status = indexer.getStatus()
console.log(`Progress: ${status.progress}%`)
console.log(`Chunks: ${status.indexedChunks}/${status.totalChunks}`)
```

### getIndexedCount()

Get total number of indexed files.

```typescript
async getIndexedCount(): Promise<number>
```

#### Returns

`Promise<number>` - Number of files in the index.

#### Example

```typescript
const count = await indexer.getIndexedCount()
console.log(`Indexed ${count} files`)
```

### getFileContent()

Retrieve raw content of an indexed file.

```typescript
async getFileContent(filePath: string): Promise<string | null>
```

#### Parameters

**filePath** `string` - Relative file path.

#### Returns

`Promise<string | null>` - File content or null if not found.

#### Example

```typescript
const content = await indexer.getFileContent('src/index.ts')
if (content) {
  console.log(content)
}
```

### getVectorStorage()

Get the vector storage instance (if embeddings enabled).

```typescript
getVectorStorage(): VectorStorage | undefined
```

#### Returns

`VectorStorage | undefined` - Vector storage or undefined if not configured.

### getEmbeddingProvider()

Get the embedding provider (if configured).

```typescript
getEmbeddingProvider(): EmbeddingProvider | undefined
```

#### Returns

`EmbeddingProvider | undefined` - Embedding provider or undefined if not configured.

## Events

### onFileChange

Callback invoked when a file changes (requires `watch: true`).

```typescript
interface FileChangeEvent {
  type: 'add' | 'change' | 'unlink'
  path: string
  timestamp: number
}
```

#### Example

```typescript
const indexer = new CodebaseIndexer({
  watch: true,
  onFileChange: (event) => {
    if (event.type === 'add') {
      console.log(`New file: ${event.path}`)
    } else if (event.type === 'change') {
      console.log(`Modified: ${event.path}`)
    } else if (event.type === 'unlink') {
      console.log(`Deleted: ${event.path}`)
    }
  }
})
```

### onProgress

Callback invoked during indexing to report progress.

```typescript
(current: number, total: number, file: string) => void
```

#### Example

```typescript
await indexer.index({
  onProgress: (current, total, file) => {
    process.stdout.write(`\rIndexing ${current}/${total}: ${file.padEnd(50)}`)
  }
})
```

## Advanced Usage

### With Vector Embeddings

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
  codebaseRoot: './src',
  storage: new PersistentStorage(),
  embeddingProvider,
  vectorBatchSize: 20  // Generate embeddings for 20 chunks at once
})

await indexer.index()
```

### Low Memory Mode

Uses SQL-based search instead of in-memory indexes:

```typescript
const indexer = new CodebaseIndexer({
  storage: new PersistentStorage(),
  lowMemoryMode: true,  // Default when using PersistentStorage
  indexingBatchSize: 25  // Process fewer files at once
})
```

### Custom Storage

```typescript
import { MemoryStorage } from '@sylphx/coderag'

const storage = new MemoryStorage()
const indexer = new CodebaseIndexer({ storage })

await indexer.index()

// Access stored files
const files = await storage.getAllFiles()
```

## Performance

### Indexing Speed

- In-memory: ~1000 files/second
- Persistent: ~500 files/second (chunk-level indexing)
- With embeddings: Depends on API rate limits (typically 10-50 chunks/second)

### Memory Usage

- Low memory mode: ~50-100MB for large codebases
- In-memory mode: ~200-500MB depending on codebase size
- Vector storage: Additional ~1MB per 1000 chunks (1536 dimensions)

### Search Speed

- TF-IDF (SQL): ~5-10ms per query
- TF-IDF (in-memory): ~1-2ms per query
- Vector search: ~10-50ms per query (LanceDB)
- Hybrid search: ~20-60ms per query

## Limitations

- Maximum file size: 1MB (configurable via `maxFileSize`)
- Binary files: Automatically skipped
- Chunk size: 100-1000 characters (configurable)
- Supported languages: See [language-config.ts](https://github.com/SylphxAI/coderag/blob/main/packages/core/src/language-config.ts)

## Related

- [Storage API](./storage.md)
- [Search Functions](./search.md)
- [Embeddings](./embeddings.md)
