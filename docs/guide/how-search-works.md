# How Search Works

CodeRAG uses chunk-level indexing with BM25 scoring to deliver fast, accurate code search. Unlike traditional file-level search, CodeRAG operates at the granularity of individual code blocks (functions, classes, etc.).

## Chunk-Level Indexing

CodeRAG indexes code at the chunk level rather than the file level. Each chunk represents a semantic unit extracted through AST parsing.

**Why chunk-level?**

- More precise search results pointing to specific functions or classes
- Better relevance scoring (matches terms within the same function, not scattered across a large file)
- Enables line-level navigation with startLine and endLine metadata

**Example:**

For a TypeScript file with 3 functions, CodeRAG creates 3 separate searchable chunks:

```typescript
// File: utils.ts

// Chunk 1: FunctionDeclaration (lines 1-5)
export function parseQuery(query: string): string[] {
  return query.toLowerCase().split(/\s+/)
}

// Chunk 2: FunctionDeclaration (lines 7-11)
export function calculateScore(tf: number, idf: number): number {
  return tf * idf
}

// Chunk 3: FunctionDeclaration (lines 13-17)
export function normalizeVector(vec: number[]): number[] {
  const magnitude = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0))
  return vec.map(v => v / magnitude)
}
```

Each chunk is indexed independently with its own TF-IDF vector.

## StarCoder2 Tokenization

CodeRAG uses the StarCoder2 tokenizer for code-aware tokenization. This tokenizer understands code syntax and produces better tokens than generic text tokenizers.

**Advantages:**

- Preserves camelCase and snake_case as single tokens (`getUserById` stays intact, not split into `get`, `User`, `By`, `Id`)
- Recognizes common code patterns (operators, keywords, identifiers)
- Language-agnostic (works across 15+ programming languages)

**Implementation:**

```typescript
import { tokenize } from '@sylphx/coderag'

const tokens = await tokenize('function getUserById(id: string)')
// Returns: ['function', 'getUserById', '(', 'id', ':', 'string', ')']
```

Tokenization happens asynchronously due to WASM-based StarCoder2 model.

## BM25 Scoring Formula

BM25 (Best Matching 25) improves upon basic TF-IDF with two key enhancements:

1. **Term frequency saturation (k1 parameter)**: Diminishing returns for repeated terms
2. **Document length normalization (b parameter)**: Adjusts for chunk length

**Formula:**

```
score(C, Q) = Σ IDF(qi) * (f(qi, C) * (k1 + 1)) / (f(qi, C) + k1 * (1 - b + b * |C| / avgdl))
```

Where:
- `C` = chunk (document)
- `Q` = query
- `f(qi, C)` = raw frequency of term qi in chunk C
- `|C|` = chunk length (token count)
- `avgdl` = average chunk length across all chunks
- `k1 = 1.2` (term frequency saturation)
- `b = 0.75` (length normalization)

**Parameters:**

```typescript
// From packages/core/src/tfidf.ts
const BM25_K1 = 1.2 // Typical range: 1.2-2.0
const BM25_B = 0.75  // 0 = no normalization, 1 = full normalization
```

These are industry-standard values from Elasticsearch and Lucene.

**How it works:**

For a query `"async function error"`, BM25 scores each chunk by:

1. Tokenizing the query: `["async", "function", "error"]`
2. For each chunk, calculating term scores using the formula above
3. Summing term scores to get final chunk score
4. Ranking chunks by score descending

## Query Caching

CodeRAG caches search results using an LRU (Least Recently Used) cache to avoid re-executing identical searches.

**Cache parameters:**

```typescript
// From packages/core/src/indexer.ts
this.searchCache = new LRUCache<SearchResult[]>(100, 5)
// 100 entries max, 5 minute TTL
```

**Cache behavior:**

- Maximum 100 cached queries
- 5-minute time-to-live (TTL) per entry
- LRU eviction: oldest entries removed when cache is full
- Cache invalidation on index updates (file add/change/delete)

**Implementation:**

```typescript
// Cache key includes query + options
const cacheKey = createCacheKey(query, {
  limit: 10,
  fileExtensions: ['.ts'],
  pathFilter: 'src/',
  excludePaths: ['node_modules/']
})

const cachedResults = this.searchCache.get(cacheKey)
if (cachedResults) {
  return cachedResults // Cache hit
}

// Execute search...
const results = await searchChunks(query, options)
this.searchCache.set(cacheKey, results)
```

**Cache statistics:**

Query cache performance metrics:

```typescript
const stats = searchCache.stats()
console.log(`Hit rate: ${stats.hitRate}`) // 0-1 (1 = 100% hits)
console.log(`Size: ${stats.size}/${stats.maxSize}`)
```

## Search Flow

End-to-end search process:

1. **Query tokenization**: Convert query string to tokens using StarCoder2
2. **Cache check**: Look up results in LRU cache
3. **SQL candidate retrieval**: Query database for chunks containing any query term
4. **BM25 scoring**: Score each candidate chunk using BM25 formula
5. **Filtering**: Apply file extension, path, and exclusion filters
6. **Ranking**: Sort by BM25 score descending
7. **Limiting**: Return top N results
8. **Caching**: Store results in cache for future queries

**Performance characteristics:**

- Tokenization: ~1-5ms per query (cached after first use)
- SQL retrieval: ~10-50ms depending on index size
- BM25 scoring: ~1ms per 100 candidates
- Total search time: typically 20-100ms for 10,000 chunks

**SQL-based search:**

CodeRAG uses SQL for memory-efficient search:

```typescript
// Query chunks by terms
const candidates = await storage.searchByTerms(queryTokens, {
  limit: limit * 3 // Get 3x candidates for scoring
})

// Candidates include:
// - chunkId, filePath, content
// - matched terms with tfidf and rawFreq
// - pre-computed magnitude and tokenCount
```

Pre-computed values (magnitude, tokenCount) stored in the database avoid recalculation during search.
