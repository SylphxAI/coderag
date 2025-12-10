# Performance Tuning

CodeRAG is optimized for speed and memory efficiency. This guide covers optimization strategies for large codebases.

## Memory Optimization

CodeRAG provides multiple strategies to reduce memory usage.

### Low Memory Mode

Low memory mode uses SQL-based search instead of loading the entire index into RAM.

**Enabling:**

```typescript
import { CodebaseIndexer } from '@sylphx/coderag'
import { PersistentStorage } from '@sylphx/coderag/storage-persistent'

const storage = new PersistentStorage()

const indexer = new CodebaseIndexer({
  storage,
  lowMemoryMode: true  // Default: true with PersistentStorage
})
```

**Memory comparison:**

| Codebase Size | In-Memory | Low Memory | Reduction |
|---------------|-----------|------------|-----------|
| 1k chunks | 10 MB | 5 MB | 50% |
| 10k chunks | 100 MB | 10 MB | 90% |
| 100k chunks | 1 GB | 15 MB | 98.5% |

**Trade-offs:**

- Memory: 90% reduction for large codebases
- Search speed: ~50% slower (15-30ms vs 10-20ms)
- Indexing speed: Unchanged (same time to build index)

**When to use:**

- Large codebases (10k+ files)
- Memory-constrained environments
- Long-running processes (servers, daemons)

**When to avoid:**

- Small codebases (<1k files) where memory isn't a concern
- Latency-critical applications requiring <10ms search
- Development environments with plenty of RAM

### Chunk-Based Indexing

CodeRAG indexes at the chunk level rather than file level, reducing memory for large files.

**Example:**

```typescript
// Large file: 10,000 lines, 500 KB

// File-level indexing:
// - 1 document vector (500 KB content in memory)
// - Large TF-IDF vector (many unique terms)

// Chunk-level indexing:
// - 50 chunks (average 200 lines each)
// - 50 smaller TF-IDF vectors (fewer terms per chunk)
// - More precise search (function-level granularity)
```

**Memory savings:**

For a 1 MB file split into 10 chunks:

```
File-level: 1 MB content + 100 KB TF-IDF vector = 1.1 MB
Chunk-level: 1 MB content + 10 * 10 KB TF-IDF vectors = 1.1 MB (similar)

But with low memory mode:
File-level: 100 KB TF-IDF vector in RAM
Chunk-level: Only query candidates loaded (typically 10-50 chunks)
```

### Streaming Indexing

CodeRAG processes files in batches to avoid loading everything at once.

**Batch processing:**

```typescript
const indexer = new CodebaseIndexer({
  indexingBatchSize: 50  // Process 50 files at a time (default)
})
```

**Memory profile during indexing:**

```
Without batching (10k files):
  Peak memory: ~2 GB (all files loaded)

With batching (10k files, batch=50):
  Peak memory: ~100 MB (50 files at a time)
```

**Batch size tuning:**

| Batch Size | Memory Usage | Indexing Speed | Recommendation |
|------------|--------------|----------------|----------------|
| 10 | Very low | Slow (many DB writes) | Memory-critical |
| 50 | Low | Fast | **Default** |
| 100 | Medium | Faster | High-memory systems |
| 500 | High | Fastest | RAM-abundant |

**Example:**

```typescript
// Low memory environment (512 MB RAM)
const indexer = new CodebaseIndexer({
  indexingBatchSize: 10
})

// High memory environment (16 GB RAM)
const indexer = new CodebaseIndexer({
  indexingBatchSize: 200
})
```

## Batch Sizes

CodeRAG uses batching at multiple levels for efficiency.

### File Batch Size

Controls how many files are processed together during indexing.

**Configuration:**

```typescript
const indexer = new CodebaseIndexer({
  indexingBatchSize: 50  // Files per batch
})
```

**Impact:**

- **Memory**: Smaller batches = lower peak memory
- **Speed**: Larger batches = fewer DB transactions (faster)
- **I/O**: Larger batches = better disk cache utilization

**Tuning guide:**

```typescript
// For 1 GB RAM or less
indexingBatchSize: 10

// For 4 GB RAM (typical laptop)
indexingBatchSize: 50  // Default

// For 16 GB RAM or more
indexingBatchSize: 100-200

// For 64 GB RAM (server)
indexingBatchSize: 500
```

### Vector Batch Size

Controls how many embeddings are generated at once.

**Configuration:**

```typescript
const indexer = new CodebaseIndexer({
  embeddingProvider: provider,
  vectorBatchSize: 10  // Embeddings per API call (default)
})
```

**Impact:**

- **API calls**: Larger batches = fewer API requests (lower cost)
- **Latency**: Larger batches = longer per-request latency
- **Rate limits**: Too large batches may hit rate limits

**Tuning guide:**

```typescript
// Conservative (avoid rate limits)
vectorBatchSize: 5

// Default (good balance)
vectorBatchSize: 10

// Aggressive (faster but may hit limits)
vectorBatchSize: 50

// Maximum (check provider limits)
vectorBatchSize: 100
```

**OpenAI rate limits:**

```
text-embedding-3-small:
  - Tier 1: 3,000 RPM, 1M TPM
  - Tier 2: 5,000 RPM, 5M TPM
  - Tier 3: 5,000 RPM, 5M TPM

Recommended batch size:
  - Tier 1: 10 (safe)
  - Tier 2+: 20-50 (faster)
```

### SQL Batch Size

Internal batch sizes for database operations.

**Document vectors:**

```typescript
// Internal constant in storage-persistent.ts
const BATCH_SIZE = 199  // SQLite variable limit: ~999 / 5 fields = 199 rows
```

SQLite has a limit of ~999 bind variables. With 5 fields per row (chunkId, term, tf, tfidf, rawFreq), the maximum batch is 199 rows.

**IDF scores:**

```typescript
// Internal constant
const BATCH_SIZE = 300  // 3 fields per row: term, idf, documentFrequency
```

**These are internal optimizations and cannot be configured.**

## Caching Strategies

CodeRAG uses multiple cache layers for performance.

### Query Token Cache

Caches tokenized queries to avoid re-tokenization.

**Configuration:**

```typescript
// Internal cache in tfidf.ts
const queryTokenCache = new Map<string, string[]>()
const QUERY_CACHE_MAX_SIZE = 100
```

**Behavior:**

- Stores up to 100 unique queries
- LRU eviction (oldest removed when full)
- No TTL (persists until evicted or cleared)

**Performance impact:**

```
Without cache:
  Query "async function" → tokenize (~5ms) → search (15ms) = 20ms total

With cache (hit):
  Query "async function" → cache hit (~0.01ms) → search (15ms) = 15ms total

Speedup: 25% for repeated queries
```

### Search Result Cache

Caches complete search results including scores and snippets.

**Configuration:**

```typescript
// In CodebaseIndexer
this.searchCache = new LRUCache<SearchResult[]>(100, 5)
// 100 entries, 5 minute TTL
```

**Parameters:**

- **Max size**: 100 queries
- **TTL**: 5 minutes
- **Eviction**: LRU (least recently used)

**Cache key:**

Cache key includes all search parameters:

```typescript
const cacheKey = createCacheKey(query, {
  limit: 10,
  fileExtensions: ['.ts'],
  pathFilter: 'src/',
  excludePaths: ['node_modules/']
})
```

Different options = different cache entry.

**Invalidation:**

Cache is invalidated on index updates:

```typescript
// File changed
await storage.storeFile(file)
searchCache.invalidate()  // Clear all cached results
```

**Performance impact:**

```
Cache miss (first query):
  "async function" → search (20ms)

Cache hit (repeated query):
  "async function" → cache (<1ms)

Speedup: 20x for repeated queries
```

### Vector Storage Cache

LanceDB (vector storage) has internal caching.

**Behavior:**

- Recently accessed vectors cached in memory
- Automatic cache management (no configuration needed)
- Typical cache size: 10-50 MB

**No user configuration required.**

## Optimization Checklist

**For large codebases (10k+ files):**

- [x] Enable low memory mode
- [x] Use persistent storage (PersistentStorage)
- [x] Tune indexing batch size (10-50 files)
- [x] Reduce vector batch size if hitting rate limits (5-10)
- [x] Monitor memory usage and adjust accordingly

**For memory-constrained environments:**

- [x] `lowMemoryMode: true`
- [x] `indexingBatchSize: 10`
- [x] Skip vector search (no embeddingProvider)
- [x] Use BM25-only search (faster, no embeddings)

**For high-performance requirements:**

- [x] Increase indexing batch size (100-200)
- [x] Increase vector batch size (20-50)
- [x] Use in-memory mode if RAM permits (lowMemoryMode: false)
- [x] Enable hybrid search with tuned vectorWeight

## Performance Benchmarks

**Indexing speed:**

| Files | Chunks | Time | Throughput |
|-------|--------|------|------------|
| 100 | 500 | 2s | 50 files/s |
| 1,000 | 5,000 | 15s | 67 files/s |
| 10,000 | 50,000 | 180s | 56 files/s |
| 100,000 | 500,000 | 2,400s | 42 files/s |

Performance degrades slightly for very large codebases due to IDF recalculation.

**Search speed:**

| Mode | Chunks | Time | Notes |
|------|--------|------|-------|
| BM25 (in-memory) | 10k | 10ms | Fastest |
| BM25 (low-memory) | 10k | 20ms | SQL overhead |
| Vector | 10k | 40ms | Embedding + search |
| Hybrid (0.7) | 10k | 50ms | Both searches |

**Memory usage:**

| Mode | Chunks | RAM |
|------|--------|-----|
| In-memory | 1k | 10 MB |
| In-memory | 10k | 100 MB |
| In-memory | 100k | 1 GB |
| Low-memory | 1k | 5 MB |
| Low-memory | 10k | 10 MB |
| Low-memory | 100k | 15 MB |

## Example Configurations

**Default (balanced):**

```typescript
const indexer = new CodebaseIndexer({
  storage: new PersistentStorage(),
  lowMemoryMode: true,      // Use SQL-based search
  indexingBatchSize: 50,    // 50 files per batch
  vectorBatchSize: 10,      // 10 embeddings per API call
  embeddingProvider: provider
})
```

**Memory-optimized:**

```typescript
const indexer = new CodebaseIndexer({
  storage: new PersistentStorage(),
  lowMemoryMode: true,
  indexingBatchSize: 10,     // Smaller batches
  vectorBatchSize: 5,        // Fewer API calls
  maxFileSize: 524288        // 512 KB limit (skip large files)
})
```

**Speed-optimized:**

```typescript
const indexer = new CodebaseIndexer({
  storage: new PersistentStorage(),
  lowMemoryMode: false,      // In-memory search
  indexingBatchSize: 200,    // Large batches
  vectorBatchSize: 50,       // Large embedding batches
  embeddingProvider: provider
})
```

**BM25-only (no embeddings):**

```typescript
const indexer = new CodebaseIndexer({
  storage: new PersistentStorage(),
  lowMemoryMode: true,
  indexingBatchSize: 50
  // No embeddingProvider = BM25-only search
})

// Fast keyword search
const results = await indexer.search('async function')
```

**Hybrid with custom weights:**

```typescript
import { hybridSearch } from '@sylphx/coderag/hybrid-search'

const indexer = new CodebaseIndexer({
  storage: new PersistentStorage(),
  embeddingProvider: provider,
  vectorBatchSize: 20
})

// Tune vectorWeight for your use case
const results = await hybridSearch(query, indexer, {
  vectorWeight: 0.8,  // Favor semantic search
  limit: 20
})
```

## Profiling

**Measure indexing time:**

```typescript
const start = Date.now()

await indexer.index({
  onProgress: (current, total, file) => {
    const elapsed = Date.now() - start
    const rate = current / (elapsed / 1000)
    console.log(`[${current}/${total}] ${file} (${rate.toFixed(1)} files/s)`)
  }
})

const elapsed = Date.now() - start
console.log(`Indexing complete: ${elapsed}ms`)
```

**Measure search time:**

```typescript
const start = Date.now()
const results = await indexer.search('async function')
const elapsed = Date.now() - start

console.log(`Search time: ${elapsed}ms (${results.length} results)`)
```

**Monitor cache hit rate:**

```typescript
const stats = indexer.searchCache.stats()
console.log(`Cache hit rate: ${(stats.hitRate * 100).toFixed(1)}%`)
console.log(`Cache size: ${stats.size}/${stats.maxSize}`)
```

**Memory profiling:**

```typescript
// Node.js memory usage
const used = process.memoryUsage()
console.log(`Heap used: ${(used.heapUsed / 1024 / 1024).toFixed(2)} MB`)
console.log(`Heap total: ${(used.heapTotal / 1024 / 1024).toFixed(2)} MB`)
console.log(`RSS: ${(used.rss / 1024 / 1024).toFixed(2)} MB`)
```
