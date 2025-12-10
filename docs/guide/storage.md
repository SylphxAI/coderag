# Persistent Storage

CodeRAG uses SQLite with LibSQL for persistent, memory-efficient storage. This enables incremental updates and low-memory operation.

## SQLite with LibSQL

LibSQL is a fork of SQLite optimized for embedded applications with WASM support.

**Why LibSQL?**

- Embedded database (no separate server)
- ACID transactions (reliable updates)
- Fast reads/writes
- Low memory footprint
- WASM-compatible (works in browsers and edge environments)
- Drizzle ORM integration

**Database location:**

Storage is in `~/.coderag/projects/<hash>/coderag.db`:

```typescript
import { getCoderagDataDir } from '@sylphx/coderag/db/client'

const dataDir = getCoderagDataDir('/path/to/codebase')
// Returns: /Users/username/.coderag/projects/abc123/

const dbPath = path.join(dataDir, 'coderag.db')
// Returns: /Users/username/.coderag/projects/abc123/coderag.db
```

The hash is based on the codebase absolute path, ensuring each project has its own isolated database.

**Creating storage:**

```typescript
import { PersistentStorage } from '@sylphx/coderag/storage-persistent'

// Default: creates database in ~/.coderag/projects/<hash>/
const storage = new PersistentStorage()

// Custom path
const storage = new PersistentStorage({
  url: 'file:///custom/path/coderag.db'
})

// In-memory (for testing)
const storage = new PersistentStorage({
  url: ':memory:'
})
```

## Database Schema

CodeRAG uses a chunk-based schema optimized for granular search.

**Schema overview:**

```
files
  └─ chunks (1:N)
      └─ document_vectors (1:N)

idf_scores (global)
index_metadata (global)
```

**Files table:**

Stores file metadata and full content.

```sql
CREATE TABLE files (
  id INTEGER PRIMARY KEY,
  path TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL,
  hash TEXT NOT NULL,
  size INTEGER NOT NULL,
  mtime INTEGER NOT NULL,
  language TEXT,
  indexed_at INTEGER NOT NULL
)
```

**Chunks table:**

Stores code chunks extracted via AST parsing.

```sql
CREATE TABLE chunks (
  id INTEGER PRIMARY KEY,
  file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  type TEXT NOT NULL,
  start_line INTEGER NOT NULL,
  end_line INTEGER NOT NULL,
  metadata TEXT,
  token_count INTEGER,
  magnitude REAL,
  FOREIGN KEY(file_id) REFERENCES files(id)
)
```

Key fields:
- `type`: AST node type (e.g., `FunctionDeclaration`)
- `start_line`, `end_line`: Line numbers for navigation
- `token_count`: Used for BM25 length normalization
- `magnitude`: Pre-computed for cosine similarity

**Document vectors table:**

Stores TF-IDF vectors for each chunk.

```sql
CREATE TABLE document_vectors (
  id INTEGER PRIMARY KEY,
  chunk_id INTEGER NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
  term TEXT NOT NULL,
  tf REAL NOT NULL,
  tfidf REAL NOT NULL,
  raw_freq INTEGER NOT NULL,
  FOREIGN KEY(chunk_id) REFERENCES chunks(id)
)

CREATE INDEX idx_vectors_chunk ON document_vectors(chunk_id)
CREATE INDEX idx_vectors_term ON document_vectors(term)
```

One row per (chunk, term) pair. Enables efficient term-based search.

**IDF scores table:**

Stores global IDF scores for all terms.

```sql
CREATE TABLE idf_scores (
  term TEXT PRIMARY KEY,
  idf REAL NOT NULL,
  document_frequency INTEGER NOT NULL
)
```

Shared across all chunks for IDF calculation.

**Index metadata table:**

Stores key-value metadata.

```sql
CREATE TABLE index_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
)
```

Used for:
- Average document length (`avgDocLength`)
- Index version
- Last update timestamp

## Low Memory Mode

Low memory mode uses SQL-based search instead of loading the entire index into memory.

**Enabling low memory mode:**

```typescript
import { CodebaseIndexer } from '@sylphx/coderag'
import { PersistentStorage } from '@sylphx/coderag/storage-persistent'

const storage = new PersistentStorage()

const indexer = new CodebaseIndexer({
  storage,
  lowMemoryMode: true  // Default: true when using PersistentStorage
})
```

**Memory comparison:**

| Mode | Memory Usage | Search Speed |
|------|--------------|--------------|
| In-memory | ~100MB per 10k chunks | 10-20ms |
| Low memory | ~10MB baseline | 15-30ms |

Low memory mode sacrifices 50% search speed for 90% memory reduction.

**How it works:**

**In-memory mode:**
1. Load all chunks and TF-IDF vectors into RAM
2. Build in-memory search index
3. Search uses in-memory data structures

**Low memory mode:**
1. Query database for chunks matching query terms
2. Compute BM25 scores on-the-fly
3. Return top results

**SQL-based search:**

```typescript
// Get chunks containing query terms
const candidates = await storage.searchByTerms(queryTokens, { limit: 100 })

// Candidates include:
// - chunkId, filePath, content
// - matchedTerms (with tfidf and rawFreq)
// - pre-computed magnitude and tokenCount

// Score candidates using BM25 (in memory, only for candidates)
for (const candidate of candidates) {
  let score = 0
  for (const term of matchedTerms) {
    const termData = candidate.matchedTerms.get(term)
    const tf = termData.rawFreq
    const idf = idfScores.get(term)
    score += idf * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * docLen / avgDocLen))
  }
}
```

Only top candidates are loaded into memory, not the entire index.

## Migrations

CodeRAG uses Drizzle ORM for schema migrations.

**Migration system:**

Migrations ensure database schema stays up-to-date across versions.

```typescript
import { runMigrations } from '@sylphx/coderag/db/migrations'

// Auto-runs on storage initialization
const storage = new PersistentStorage()
// Migrations applied automatically
```

**Migration tracking:**

Migrations are tracked in the `__drizzle_migrations` table:

```sql
CREATE TABLE __drizzle_migrations (
  id INTEGER PRIMARY KEY,
  hash TEXT NOT NULL,
  created_at INTEGER
)
```

Each migration runs once, identified by its hash.

**Current migrations:**

```typescript
// packages/core/src/db/migrations.ts

export async function runMigrations(client: Client) {
  // Create files table
  await client.execute(`
    CREATE TABLE IF NOT EXISTS files (...)
  `)

  // Create chunks table
  await client.execute(`
    CREATE TABLE IF NOT EXISTS chunks (...)
  `)

  // Create document_vectors table with indexes
  await client.execute(`
    CREATE TABLE IF NOT EXISTS document_vectors (...)
  `)
  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_vectors_chunk ON document_vectors(chunk_id)
  `)
  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_vectors_term ON document_vectors(term)
  `)

  // Create idf_scores table
  await client.execute(`
    CREATE TABLE IF NOT EXISTS idf_scores (...)
  `)

  // Create index_metadata table
  await client.execute(`
    CREATE TABLE IF NOT EXISTS index_metadata (...)
  `)
}
```

Migrations are idempotent (safe to run multiple times).

## Batch Operations

CodeRAG uses batch operations for efficient bulk updates.

**Batch file storage:**

```typescript
const files: CodebaseFile[] = [...]  // 1000 files

// Bad: One transaction per file (slow)
for (const file of files) {
  await storage.storeFile(file)  // 1000 transactions
}

// Good: Batch transaction (fast)
await storage.storeFiles(files)  // 1 batch transaction
```

**Implementation:**

```typescript
async storeFiles(files: CodebaseFile[]): Promise<void> {
  await this.client.batch(
    files.map(file => ({
      sql: `INSERT INTO files (...) VALUES (?, ?, ?, ...)
            ON CONFLICT(path) DO UPDATE SET ...`,
      args: [file.path, file.content, file.hash, ...]
    })),
    'write'
  )
}
```

Batch size limit: ~500-1000 files per batch (SQLite variable limit).

**Batch chunk vectors:**

```typescript
const chunkVectors: Array<{
  chunkId: number
  terms: Map<string, { tf, tfidf, rawFreq }>
  tokenCount: number
}> = [...]

// Store all vectors in batches
await storage.storeManyChunkVectors(chunkVectors)
```

Vectors are batched in groups of 199 (SQLite has ~999 bind variable limit, 5 fields per row = 199 rows max).

**Batch IDF updates:**

```typescript
// Rebuild IDF for all terms using SQL
await storage.rebuildIdfScoresFromVectors()

// SQL aggregation (no need to load data into memory)
const dfResults = await db.select({
  term: documentVectors.term,
  df: sql`COUNT(DISTINCT ${documentVectors.chunkId})`
})
.from(documentVectors)
.groupBy(documentVectors.term)

// Batch insert IDF scores
const scores = dfResults.map(row => ({
  term: row.term,
  idf: Math.log((totalChunks + 1) / (row.df + 1)) + 1,
  documentFrequency: row.df
}))

// Insert in batches of 300
for (let i = 0; i < scores.length; i += 300) {
  await db.insert(idfScores).values(scores.slice(i, i + 300))
}
```

## Incremental Updates

CodeRAG supports incremental updates for efficient file watching.

**Update flow:**

1. **Detect changes**: Compare filesystem with database
2. **Delete old data**: Remove chunks and vectors for changed/deleted files
3. **Insert new data**: Add chunks and vectors for new/changed files
4. **Rebuild IDF**: Recalculate IDF scores globally
5. **Update TF-IDF**: Recalculate TF-IDF scores using new IDF
6. **Update metadata**: Recalculate chunk magnitudes and average doc length

**Example:**

```typescript
// User edits src/utils.ts
// CodeRAG detects change via file watcher

// 1. Get terms for old chunks (for IDF recalculation)
const affectedTerms = await storage.getTermsForFiles(['src/utils.ts'])

// 2. Delete old chunks
await storage.deleteFiles(['src/utils.ts'])

// 3. Re-chunk file
const chunks = await chunkCodeByAST(newContent, 'src/utils.ts')

// 4. Store file and chunks
await storage.storeFile({ path: 'src/utils.ts', content: newContent, ... })
const chunkIds = await storage.storeChunks('src/utils.ts', chunks)

// 5. Build TF-IDF vectors for new chunks
const chunkVectors = buildVectors(chunks)
await storage.storeManyChunkVectors(chunkVectors)

// 6. Rebuild global IDF scores
await storage.rebuildIdfScoresFromVectors()

// 7. Recalculate TF-IDF scores for all chunks
await storage.recalculateTfidfScores()

// 8. Update pre-computed magnitudes
await storage.updateChunkMagnitudes()
```

Incremental updates are significantly faster than full reindex:

| Operation | Full Rebuild | Incremental |
|-----------|--------------|-------------|
| 1 file changed | 30 seconds | 0.5 seconds |
| 10 files changed | 30 seconds | 3 seconds |
| 100 files changed | 30 seconds | 15 seconds |

## Storage API

**Key methods:**

```typescript
class PersistentStorage {
  // File operations
  async storeFile(file: CodebaseFile): Promise<void>
  async storeFiles(files: CodebaseFile[]): Promise<void>
  async getFile(path: string): Promise<CodebaseFile | null>
  async getAllFiles(): Promise<CodebaseFile[]>
  async deleteFile(path: string): Promise<void>
  async deleteFiles(paths: string[]): Promise<void>
  async count(): Promise<number>

  // Chunk operations
  async storeChunks(filePath: string, chunks: ChunkData[]): Promise<number[]>
  async storeManyChunks(fileChunks: Array<{ filePath, chunks }>): Promise<Map<string, number[]>>
  async getChunksForFile(filePath: string): Promise<StoredChunk[]>
  async getAllChunks(): Promise<StoredChunk[]>
  async getChunkCount(): Promise<number>

  // Vector operations
  async storeChunkVectors(chunkId, terms, tokenCount): Promise<void>
  async storeManyChunkVectors(chunkVectors): Promise<void>
  async getChunkVectors(chunkId): Promise<Map<string, { tf, tfidf, rawFreq }>>
  async getAllChunkVectors(): Promise<Map<number, Map<string, { tf, tfidf, rawFreq }>>>

  // IDF operations
  async storeIdfScores(idf, docFreq): Promise<void>
  async getIdfScores(): Promise<Map<string, number>>
  async getIdfScoresForTerms(terms): Promise<Map<string, number>>
  async rebuildIdfScoresFromVectors(): Promise<void>

  // Search operations
  async searchByTerms(queryTerms, options): Promise<SearchCandidate[]>
  async getAverageDocLength(): Promise<number>
  async updateAverageDocLength(): Promise<number>

  // Metadata operations
  async setMetadata(key, value): Promise<void>
  async getMetadata(key): Promise<string | null>

  // Index maintenance
  async recalculateTfidfScores(): Promise<void>
  async updateChunkMagnitudes(): Promise<void>
  async clear(): Promise<void>
  close(): void
}
```
