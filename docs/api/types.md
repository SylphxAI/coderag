# TypeScript Types

Comprehensive type definitions for CodeRAG API.

## Indexer Types

### IndexerOptions

Configuration for `CodebaseIndexer` constructor.

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

### IndexingStatus

Current indexing progress.

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

### FileChangeEvent

File system change event.

```typescript
interface FileChangeEvent {
  type: 'add' | 'change' | 'unlink'
  path: string
  timestamp: number
}
```

### FileDiff

Filesystem diff result for incremental updates.

```typescript
interface FileDiff {
  added: FileMetadata[]     // New files
  changed: FileMetadata[]   // Modified files
  deleted: string[]         // Deleted file paths
  unchanged: number         // Unchanged file count
}
```

### SearchResult

Search result from `CodebaseIndexer.search()`.

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

## Storage Types

### Storage

Storage interface implemented by `PersistentStorage` and `MemoryStorage`.

```typescript
interface Storage {
  storeFile(file: CodebaseFile): Promise<void>
  storeFiles?(files: CodebaseFile[]): Promise<void>
  getFile(path: string): Promise<CodebaseFile | null>
  getAllFiles(): Promise<CodebaseFile[]>
  deleteFile(path: string): Promise<void>
  clear(): Promise<void>
  count(): Promise<number>
  getChunkCount?(): Promise<number>
  exists(path: string): Promise<boolean>
}
```

### CodebaseFile

Stored file representation.

```typescript
interface CodebaseFile {
  path: string            // Relative file path
  content: string         // File content
  size: number           // File size in bytes
  mtime: number | Date   // Modification time
  language?: string      // Detected language
  hash: string           // Content hash
}
```

### DbConfig

Database configuration for `PersistentStorage`.

```typescript
interface DbConfig {
  codebaseRoot?: string  // Project root (default: process.cwd())
  dbPath?: string        // Custom database path (optional)
}
```

### ChunkData

Chunk data for storage.

```typescript
interface ChunkData {
  content: string
  type: string            // AST node type
  startLine: number
  endLine: number
  metadata?: Record<string, unknown>
}
```

### StoredChunk

Chunk with database ID.

```typescript
interface StoredChunk extends ChunkData {
  id: number           // Chunk ID
  fileId: number       // Parent file ID
  filePath: string     // File path
}
```

## Search Types

### HybridSearchOptions

Options for hybrid search.

```typescript
interface HybridSearchOptions {
  limit?: number           // Max results (default: 10)
  minScore?: number        // Min relevance score (default: 0.01)
  vectorWeight?: number    // 0-1, vector vs TF-IDF (default: 0.7)
  includeContent?: boolean // Include snippets (default: false)
  fileExtensions?: string[] // Filter by extension
  pathFilter?: string      // Include paths containing string
  excludePaths?: string[]  // Exclude paths
}
```

### HybridSearchResult

Result from hybrid search.

```typescript
interface HybridSearchResult {
  path: string
  score: number
  method: 'vector' | 'tfidf' | 'hybrid'
  matchedTerms?: string[]
  similarity?: number
  content?: string
  chunkType?: string
  startLine?: number
  endLine?: number
  language?: string
}
```

### SearchIndex

TF-IDF search index structure.

```typescript
interface SearchIndex {
  documents: DocumentVector[]
  idf: Map<string, number>
  totalDocuments: number
  metadata: {
    generatedAt: string
    version: string
  }
}
```

### DocumentVector

TF-IDF document vector.

```typescript
interface DocumentVector {
  uri: string
  magnitude: number
  rawTerms: Map<string, number>
  tfidf: Map<string, number>
}
```

## Embedding Types

### EmbeddingConfig

Embedding provider configuration.

```typescript
interface EmbeddingConfig {
  provider: 'openai' | 'openai-compatible' | 'mock'
  model: string              // Model name
  dimensions: number         // Vector dimensions
  apiKey?: string           // API key
  baseURL?: string          // Custom endpoint for OpenAI-compatible APIs
  batchSize?: number        // Embedding batch size (default: 10)
}
```

### EmbeddingProvider

Embedding provider interface.

```typescript
interface EmbeddingProvider {
  name: string
  model: string
  dimensions: number
  generateEmbedding(text: string): Promise<number[]>
  generateEmbeddings(texts: string[]): Promise<number[][]>
}
```

## Vector Storage Types

### VectorStorageOptions

Configuration for vector storage.

```typescript
interface VectorStorageOptions {
  dimensions: number       // Vector dimensions
  dbPath: string          // LanceDB path
}
```

### VectorDocument

Document with embedding.

```typescript
interface VectorDocument {
  id: string
  embedding: number[]
  metadata: Record<string, unknown>
}
```

### VectorSearchResult

Vector search result.

```typescript
interface VectorSearchResult {
  doc: VectorDocument
  similarity: number
}
```

### VectorStorageStats

Vector storage statistics.

```typescript
interface VectorStorageStats {
  documentCount: number
  dimensions: number
}
```

## Chunking Types

### ASTChunkOptions

Options for AST-based chunking.

```typescript
interface ASTChunkOptions {
  maxChunkSize?: number       // Max chunk chars (default: 1000)
  minChunkSize?: number       // Min chunk chars (default: 100)
  preserveContext?: boolean   // Include imports/types (default: true)
  nodeTypes?: string[]        // Custom AST node types to chunk
  parseEmbedded?: boolean     // Parse code in markdown (default: true)
}
```

### ChunkResult

Chunk with metadata.

```typescript
interface ChunkResult {
  content: string              // Chunk content
  type: string                 // AST node type
  startLine: number           // Start line (1-indexed)
  endLine: number             // End line (inclusive)
  metadata: Record<string, unknown>  // Additional metadata
}
```

## Language Configuration Types

### LanguageConfig

Language-specific configuration.

```typescript
interface LanguageConfig {
  parser: string              // Parser module name
  boundaries: string[]        // AST node types for semantic boundaries
  contextTypes?: string[]     // Node types to preserve as context
  parserOptions?: Record<string, unknown>
  embedded?: EmbeddedLanguageConfig[]
}
```

### EmbeddedLanguageConfig

Configuration for embedded code parsing.

```typescript
interface EmbeddedLanguageConfig {
  nodeType: string            // Parent node type
  langAttr?: string          // Attribute containing language name
  defaultLanguage?: string   // Default language if not specified
  recursive?: boolean        // Enable recursive parsing
}
```

## TF-IDF Types

### IncrementalUpdate

Update operation for incremental TF-IDF.

```typescript
interface IncrementalUpdate {
  type: 'add' | 'update' | 'delete'
  uri: string
  newContent?: string
  oldDocument?: DocumentVector
}
```

### IncrementalStats

Statistics from incremental update.

```typescript
interface IncrementalStats {
  affectedDocuments: number
  affectedTerms: number
  updateTime: number
}
```

## Utility Types

### ScanOptions

Options for file scanning.

```typescript
interface ScanOptions {
  ignoreFilter?: Ignore
  codebaseRoot?: string
  maxFileSize?: number
}
```

### ScanResult

File scan result.

```typescript
interface ScanResult {
  path: string
  size: number
}
```

### FileMetadata

File metadata without content.

```typescript
interface FileMetadata {
  path: string
  absolutePath: string
  size: number
  mtime: number
  language?: string
}
```

### ProjectMetadata

Project metadata for database location.

```typescript
interface ProjectMetadata {
  codebaseRoot: string
  hash: string
  dataDir: string
}
```

## Cache Types

### CacheEntry

LRU cache entry.

```typescript
interface CacheEntry<T> {
  value: T
  timestamp: number
}
```

### CacheStats

Cache statistics.

```typescript
interface CacheStats {
  hits: number
  misses: number
  size: number
  maxSize: number
}
```

## Type Guards

Useful type guards for working with CodeRAG types.

```typescript
function isPersistentStorage(storage: Storage): storage is PersistentStorage {
  return 'storeChunks' in storage
}

function hasChunkMetadata(result: SearchResult): result is SearchResult & {
  chunkType: string
  startLine: number
  endLine: number
} {
  return result.chunkType !== undefined &&
         result.startLine !== undefined &&
         result.endLine !== undefined
}

function isHybridResult(result: HybridSearchResult): boolean {
  return result.method === 'hybrid'
}
```

## Generic Types

```typescript
// Storage key-value types
type StorageKey = string
type StorageValue = string | number | boolean | null

// Vector types
type Vector = number[]
type VectorId = string

// Score types
type Score = number  // 0-1 for cosine similarity, unbounded for TF-IDF/BM25
type Similarity = number  // -1 to 1 for cosine similarity

// Path types
type FilePath = string
type AbsolutePath = string
type RelativePath = string
```

## Constants

```typescript
// Default values
const DEFAULT_MAX_FILE_SIZE = 1048576  // 1MB
const DEFAULT_MAX_CHUNK_SIZE = 1000
const DEFAULT_MIN_CHUNK_SIZE = 100
const DEFAULT_VECTOR_BATCH_SIZE = 10
const DEFAULT_INDEXING_BATCH_SIZE = 50
const DEFAULT_SEARCH_LIMIT = 10
const DEFAULT_VECTOR_WEIGHT = 0.7

// BM25 parameters
const BM25_K1 = 1.2
const BM25_B = 0.75
```

## Usage Examples

### Type-Safe Indexer Configuration

```typescript
import type { IndexerOptions, EmbeddingConfig } from '@sylphx/coderag'

const embeddingConfig: EmbeddingConfig = {
  provider: 'openai',
  model: 'text-embedding-3-small',
  dimensions: 1536,
  apiKey: process.env.OPENAI_API_KEY
}

const indexerOptions: IndexerOptions = {
  codebaseRoot: './src',
  maxFileSize: 2 * 1024 * 1024,
  watch: true,
  onProgress: (current, total, file) => {
    console.log(`${current}/${total}: ${file}`)
  }
}
```

### Type-Safe Search

```typescript
import type { SearchResult, HybridSearchOptions } from '@sylphx/coderag'

const options: HybridSearchOptions = {
  limit: 20,
  vectorWeight: 0.7,
  fileExtensions: ['.ts', '.tsx']
}

const results: SearchResult[] = await indexer.search('auth', options)

for (const result of results) {
  if (hasChunkMetadata(result)) {
    console.log(`${result.chunkType} at ${result.startLine}`)
  }
}
```

### Type-Safe Storage

```typescript
import type { CodebaseFile, StoredChunk } from '@sylphx/coderag'

const file: CodebaseFile = {
  path: 'src/index.ts',
  content: code,
  size: code.length,
  mtime: Date.now(),
  language: 'typescript',
  hash: computeHash(code)
}

await storage.storeFile(file)

const chunks: StoredChunk[] = await storage.getChunksForFile(file.path)
```

## Related

- [CodebaseIndexer](./indexer.md)
- [Storage](./storage.md)
- [Search Functions](./search.md)
- [Embeddings](./embeddings.md)
- [AST Chunking](./chunking.md)
