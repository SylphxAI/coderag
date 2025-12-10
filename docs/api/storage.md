# Storage

CodeRAG provides two storage implementations: `PersistentStorage` for SQLite-backed persistence and `MemoryStorage` for in-memory usage.

## PersistentStorage

SQLite-based storage using LibSQL and Drizzle ORM. Supports chunk-level indexing with BM25 scoring.

### Constructor

```typescript
new PersistentStorage(config?: DbConfig)
```

#### Parameters

**config** `DbConfig` (optional)

```typescript
interface DbConfig {
  codebaseRoot?: string  // Project root (default: process.cwd())
  dbPath?: string        // Custom database path (optional)
}
```

If `dbPath` is not provided, uses `~/.coderag/projects/<hash>/` based on the codebase root path.

#### Example

```typescript
import { PersistentStorage } from '@sylphx/coderag'

// Automatic path (recommended)
const storage = new PersistentStorage({
  codebaseRoot: '/path/to/project'
})
// Creates: ~/.coderag/projects/a3d5f8b2/index.db

// Custom path
const storage = new PersistentStorage({
  dbPath: '/custom/path/index.db'
})
```

## Storage Interface

Both `PersistentStorage` and `MemoryStorage` implement the `Storage` interface:

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

## File Operations

### storeFile()

Store a single file in the index.

```typescript
async storeFile(file: CodebaseFile): Promise<void>
```

#### Parameters

```typescript
interface CodebaseFile {
  path: string
  content: string
  size: number
  mtime: number | Date
  language?: string
  hash: string
}
```

#### Example

```typescript
await storage.storeFile({
  path: 'src/index.ts',
  content: 'export function hello() { }',
  size: 30,
  mtime: Date.now(),
  language: 'typescript',
  hash: 'abc123'
})
```

### storeFiles()

Store multiple files in a batch (more efficient than individual stores).

```typescript
async storeFiles(files: CodebaseFile[]): Promise<void>
```

#### Example

```typescript
const files: CodebaseFile[] = [
  { path: 'src/a.ts', content: '...', /* ... */ },
  { path: 'src/b.ts', content: '...', /* ... */ }
]

await storage.storeFiles(files)
```

### getFile()

Retrieve a file by path.

```typescript
async getFile(path: string): Promise<CodebaseFile | null>
```

#### Example

```typescript
const file = await storage.getFile('src/index.ts')
if (file) {
  console.log(file.content)
}
```

### getAllFiles()

Get all indexed files.

```typescript
async getAllFiles(): Promise<CodebaseFile[]>
```

#### Example

```typescript
const files = await storage.getAllFiles()
console.log(`Total files: ${files.length}`)
```

### deleteFile()

Delete a file from the index.

```typescript
async deleteFile(path: string): Promise<void>
```

#### Example

```typescript
await storage.deleteFile('src/removed.ts')
```

### deleteFiles()

Delete multiple files in a batch (PersistentStorage only).

```typescript
async deleteFiles(paths: string[]): Promise<void>
```

#### Example

```typescript
await storage.deleteFiles(['src/a.ts', 'src/b.ts'])
```

### clear()

Clear all files from the index.

```typescript
async clear(): Promise<void>
```

#### Example

```typescript
await storage.clear()
```

### count()

Get total number of indexed files.

```typescript
async count(): Promise<number>
```

#### Example

```typescript
const fileCount = await storage.count()
console.log(`Indexed ${fileCount} files`)
```

### exists()

Check if a file exists in the index.

```typescript
async exists(path: string): Promise<boolean>
```

#### Example

```typescript
if (await storage.exists('src/index.ts')) {
  console.log('File is indexed')
}
```

## Chunk Operations

These methods are specific to `PersistentStorage` and support chunk-level indexing.

### storeChunks()

Store chunks for a file (replaces existing chunks).

```typescript
async storeChunks(filePath: string, chunks: ChunkData[]): Promise<number[]>
```

#### Parameters

```typescript
interface ChunkData {
  content: string
  type: string            // AST node type (e.g., 'FunctionDeclaration')
  startLine: number
  endLine: number
  metadata?: Record<string, unknown>
}
```

#### Returns

`Promise<number[]>` - Array of chunk IDs.

#### Example

```typescript
const chunkIds = await storage.storeChunks('src/index.ts', [
  {
    content: 'export function hello() { }',
    type: 'FunctionDeclaration',
    startLine: 1,
    endLine: 3
  }
])
```

### storeManyChunks()

Store chunks for multiple files in a batch.

```typescript
async storeManyChunks(
  fileChunks: Array<{ filePath: string; chunks: ChunkData[] }>
): Promise<Map<string, number[]>>
```

#### Returns

`Promise<Map<string, number[]>>` - Map of file paths to chunk ID arrays.

#### Example

```typescript
const chunkIdMap = await storage.storeManyChunks([
  {
    filePath: 'src/a.ts',
    chunks: [{ content: '...', type: 'FunctionDeclaration', startLine: 1, endLine: 5 }]
  },
  {
    filePath: 'src/b.ts',
    chunks: [{ content: '...', type: 'ClassDeclaration', startLine: 1, endLine: 10 }]
  }
])

const aChunkIds = chunkIdMap.get('src/a.ts')
```

### getChunksForFile()

Get all chunks for a file.

```typescript
async getChunksForFile(filePath: string): Promise<StoredChunk[]>
```

#### Returns

```typescript
interface StoredChunk extends ChunkData {
  id: number
  fileId: number
  filePath: string
}
```

#### Example

```typescript
const chunks = await storage.getChunksForFile('src/index.ts')
for (const chunk of chunks) {
  console.log(`${chunk.type} (${chunk.startLine}-${chunk.endLine}): ${chunk.content}`)
}
```

### getChunkCount()

Get total number of indexed chunks.

```typescript
async getChunkCount(): Promise<number>
```

#### Example

```typescript
const chunkCount = await storage.getChunkCount()
console.log(`Indexed ${chunkCount} chunks`)
```

## Vector Operations

These methods manage TF-IDF vectors for chunk-level search.

### storeChunkVectors()

Store TF-IDF vectors for a chunk.

```typescript
async storeChunkVectors(
  chunkId: number,
  terms: Map<string, { tf: number; tfidf: number; rawFreq: number }>,
  tokenCount?: number
): Promise<void>
```

#### Example

```typescript
const terms = new Map([
  ['function', { tf: 0.5, tfidf: 1.2, rawFreq: 2 }],
  ['export', { tf: 0.25, tfidf: 0.8, rawFreq: 1 }]
])

await storage.storeChunkVectors(123, terms, 4)
```

### storeManyChunkVectors()

Store vectors for multiple chunks in a batch.

```typescript
async storeManyChunkVectors(
  chunkVectors: Array<{
    chunkId: number
    terms: Map<string, { tf: number; tfidf: number; rawFreq: number }>
    tokenCount?: number
  }>
): Promise<void>
```

### getChunkVectors()

Get TF-IDF vectors for a chunk.

```typescript
async getChunkVectors(
  chunkId: number
): Promise<Map<string, { tf: number; tfidf: number; rawFreq: number }> | null>
```

### getAllChunkVectors()

Get all chunk vectors in a single query.

```typescript
async getAllChunkVectors(): Promise<
  Map<number, Map<string, { tf: number; tfidf: number; rawFreq: number }>>
>
```

Returns a map of chunk IDs to their term vectors.

## IDF Operations

Manage inverse document frequency scores.

### storeIdfScores()

Store IDF scores for all terms.

```typescript
async storeIdfScores(
  idf: Map<string, number>,
  docFreq: Map<string, number>
): Promise<void>
```

### getIdfScores()

Get all IDF scores.

```typescript
async getIdfScores(): Promise<Map<string, number>>
```

### getIdfScoresForTerms()

Get IDF scores for specific terms only.

```typescript
async getIdfScoresForTerms(terms: string[]): Promise<Map<string, number>>
```

### rebuildIdfScoresFromVectors()

Recalculate IDF scores from stored vectors.

```typescript
async rebuildIdfScoresFromVectors(): Promise<void>
```

Uses smoothed IDF formula: `log((N+1)/(df+1)) + 1`

## Search Operations

### searchByTerms()

Search chunks by query terms using SQL.

```typescript
async searchByTerms(
  queryTerms: string[],
  options?: { limit?: number }
): Promise<SearchCandidate[]>
```

#### Returns

```typescript
interface SearchCandidate {
  chunkId: number
  filePath: string
  content: string
  type: string
  startLine: number
  endLine: number
  matchedTerms: Map<string, { tfidf: number; rawFreq: number }>
  magnitude: number
  tokenCount: number
}
```

#### Example

```typescript
const candidates = await storage.searchByTerms(
  ['function', 'export'],
  { limit: 20 }
)

for (const candidate of candidates) {
  console.log(`${candidate.filePath}:${candidate.startLine}`)
  console.log(`Matched: ${Array.from(candidate.matchedTerms.keys()).join(', ')}`)
}
```

## Metadata Operations

### setMetadata()

Store metadata key-value pair.

```typescript
async setMetadata(key: string, value: string): Promise<void>
```

### getMetadata()

Retrieve metadata value.

```typescript
async getMetadata(key: string): Promise<string | null>
```

### getAverageDocLength()

Get average chunk token count (for BM25).

```typescript
async getAverageDocLength(): Promise<number>
```

### updateAverageDocLength()

Recalculate and store average chunk length.

```typescript
async updateAverageDocLength(): Promise<number>
```

## Maintenance Operations

### recalculateTfidfScores()

Update all TF-IDF scores using current IDF values.

```typescript
async recalculateTfidfScores(): Promise<void>
```

### updateChunkMagnitudes()

Recalculate pre-computed magnitudes for cosine similarity.

```typescript
async updateChunkMagnitudes(): Promise<void>
```

Magnitude formula: `sqrt(sum(tfidf^2))` for each chunk.

### getAllFileMetadata()

Get file metadata without content (for incremental updates).

```typescript
async getAllFileMetadata(): Promise<Map<string, { mtime: number; hash: string }>>
```

### getTermsForFiles()

Get all terms used in chunks of specified files.

```typescript
async getTermsForFiles(paths: string[]): Promise<Set<string>>
```

Useful for tracking affected terms during incremental updates.

## MemoryStorage

In-memory storage implementation. Useful for testing or temporary indexes.

### Constructor

```typescript
new MemoryStorage()
```

### Example

```typescript
import { MemoryStorage } from '@sylphx/coderag'

const storage = new MemoryStorage()

await storage.storeFile({
  path: 'test.ts',
  content: 'console.log("test")',
  size: 20,
  mtime: Date.now(),
  hash: 'abc'
})

const file = await storage.getFile('test.ts')
```

## Database Schema

PersistentStorage uses the following tables:

**files**
- id, path (unique), content, hash, size, mtime, language, indexed_at

**chunks**
- id, file_id, content, type, start_line, end_line, metadata, magnitude, token_count

**document_vectors**
- chunk_id, term, tf, tfidf, raw_freq

**idf_scores**
- term (unique), idf, document_frequency

**index_metadata**
- key (unique), value, updated_at

## Performance Tips

### Batch Operations

Use batch methods for better performance:

```typescript
// Good: Single transaction
await storage.storeFiles(files)
await storage.storeManyChunks(fileChunks)

// Bad: Multiple transactions
for (const file of files) {
  await storage.storeFile(file)
}
```

### Incremental Updates

Use metadata comparison to avoid unnecessary work:

```typescript
const metadata = await storage.getAllFileMetadata()
const existing = metadata.get(filePath)

if (existing?.hash === newHash) {
  // Skip, content unchanged
}
```

### Low Memory Mode

For large codebases, use SQL-based search:

```typescript
const indexer = new CodebaseIndexer({
  storage: new PersistentStorage(),
  lowMemoryMode: true  // Uses searchByTerms() instead of in-memory index
})
```

## Related

- [CodebaseIndexer](./indexer.md)
- [Types](./types.md)
