# Hybrid Search

Hybrid search combines keyword-based search (BM25) with semantic search (vector embeddings) to leverage the strengths of both approaches.

## Weighted Combination Formula

Hybrid search merges results from BM25 and vector search using a weighted average.

**Formula:**

```
hybrid_score = (vectorWeight * normalized_vector_score) + ((1 - vectorWeight) * normalized_bm25_score)
```

Where:
- `vectorWeight`: Weight for vector search (0-1, default: 0.7)
- `normalized_vector_score`: Vector similarity score normalized to 0-1
- `normalized_bm25_score`: BM25 score normalized to 0-1

**Score normalization:**

Scores are normalized by dividing by the maximum score in each result set:

```typescript
const maxVectorScore = Math.max(...vectorResults.map(r => r.similarity), 0.01)
const maxBM25Score = Math.max(...bm25Results.map(r => r.score), 0.01)

const normalizedVectorScore = vectorScore / maxVectorScore
const normalizedBM25Score = bm25Score / maxBM25Score
```

**Implementation:**

```typescript
function mergeSearchResults(
  vectorResults: VectorSearchResult[],
  tfidfResults: SearchResult[],
  vectorWeight: number
): HybridSearchResult[] {
  const resultMap = new Map<string, HybridSearchResult>()

  // Normalize scores
  const maxVectorScore = Math.max(...vectorResults.map(r => r.similarity), 0.01)
  const maxBM25Score = Math.max(...tfidfResults.map(r => r.score), 0.01)

  // Add vector results
  for (const result of vectorResults) {
    const normalizedScore = result.similarity / maxVectorScore
    const key = getChunkKey(result.path, result.startLine, result.endLine)

    resultMap.set(key, {
      path: result.path,
      score: normalizedScore * vectorWeight,
      method: 'vector',
      similarity: result.similarity,
      ...
    })
  }

  // Add/merge BM25 results
  for (const result of tfidfResults) {
    const normalizedScore = result.score / maxBM25Score
    const key = getChunkKey(result.path, result.startLine, result.endLine)
    const existing = resultMap.get(key)

    if (existing) {
      // Combine scores
      resultMap.set(key, {
        ...existing,
        score: existing.score + normalizedScore * (1 - vectorWeight),
        method: 'hybrid'
      })
    } else {
      resultMap.set(key, {
        path: result.path,
        score: normalizedScore * (1 - vectorWeight),
        method: 'tfidf',
        ...
      })
    }
  }

  // Sort by combined score
  return Array.from(resultMap.values()).sort((a, b) => b.score - a.score)
}
```

## When to Use Each Mode

CodeRAG supports three search modes: vector-only, BM25-only, and hybrid.

### Vector Search (vectorWeight = 1.0)

**Best for:**
- Conceptual queries ("error handling patterns")
- Natural language questions ("how to validate user input")
- Finding similar code by meaning, not exact keywords
- Cross-language searches (similar logic in different languages)

**Example queries:**
```typescript
"authentication middleware"  // Finds auth-related code even without exact terms
"database connection pooling" // Understands concepts
"handle async errors"        // Natural language
```

**Usage:**

```typescript
import { semanticSearch } from '@sylphx/coderag/hybrid-search'

const results = await semanticSearch('error handling patterns', indexer, {
  limit: 10
})
```

### BM25 Search (vectorWeight = 0.0)

**Best for:**
- Exact keyword matching (function names, class names, identifiers)
- Fast search (2-3x faster than vector search)
- No embedding provider required
- Large codebases where vector search is too slow

**Example queries:**
```typescript
"fetchUser"           // Exact function name
"UserService"         // Exact class name
"calculateBM25"       // Specific identifier
```

**Usage:**

```typescript
import { keywordSearch } from '@sylphx/coderag/hybrid-search'

const results = await keywordSearch('fetchUser', indexer, {
  limit: 10
})
```

### Hybrid Search (vectorWeight = 0.7, default)

**Best for:**
- General-purpose search (balances precision and recall)
- Queries with both keywords and concepts
- Production use cases
- Unknown query types

**Example queries:**
```typescript
"async fetchUser error handling"  // Keywords + concepts
"UserService authentication logic" // Class name + concept
"validate email format regex"      // Specific + general
```

**Usage:**

```typescript
import { hybridSearch } from '@sylphx/coderag/hybrid-search'

const results = await hybridSearch('async fetchUser error handling', indexer, {
  limit: 10,
  vectorWeight: 0.7  // Default
})
```

## Tuning vectorWeight Parameter

The `vectorWeight` parameter controls the balance between vector and BM25 search.

**Weight spectrum:**

```
0.0   Pure BM25      Exact keywords only
0.3   BM25-heavy     Favor keywords, some semantic understanding
0.5   Balanced       Equal weight to both approaches
0.7   Vector-heavy   Favor semantics, some keyword matching (DEFAULT)
1.0   Pure Vector    Meaning only, ignore exact keywords
```

**Recommended settings by use case:**

| Use Case | vectorWeight | Rationale |
|----------|--------------|-----------|
| API search (exact names) | 0.2-0.3 | Favor exact matches |
| Code exploration | 0.7-0.8 | Find related code |
| Documentation search | 0.8-0.9 | Natural language queries |
| Fast lookup | 0.0 | Skip vector search |
| Semantic understanding | 1.0 | Ignore keywords |
| General search | 0.7 | **Default, works for most cases** |

**Tuning example:**

```typescript
// Find exact function names (favor keywords)
const results = await hybridSearch('getUserById', indexer, {
  vectorWeight: 0.3
})

// Find authentication-related code (favor semantics)
const results = await hybridSearch('authentication logic', indexer, {
  vectorWeight: 0.8
})
```

**Experimental tuning:**

Test different weights to find optimal balance for your queries:

```typescript
const query = 'error handling'
const weights = [0.0, 0.3, 0.5, 0.7, 1.0]

for (const w of weights) {
  const results = await hybridSearch(query, indexer, { vectorWeight: w, limit: 5 })
  console.log(`Weight ${w}:`)
  results.forEach(r => console.log(`  ${r.path} (score: ${r.score.toFixed(3)})`))
}
```

## Search Result Structure

Hybrid search returns unified results with metadata from both approaches.

**HybridSearchResult interface:**

```typescript
interface HybridSearchResult {
  readonly path: string          // File path
  readonly score: number         // Combined score (0-1+)
  readonly method: 'vector' | 'tfidf' | 'hybrid'
  readonly matchedTerms?: string[]    // From BM25 (keyword matches)
  readonly similarity?: number        // From vector (cosine similarity)
  readonly content?: string           // Chunk content or snippet
  readonly chunkType?: string         // AST node type
  readonly startLine?: number         // Chunk start line
  readonly endLine?: number           // Chunk end line
  readonly language?: string          // Programming language
}
```

**Method field:**

- `'vector'`: Result only from vector search
- `'tfidf'`: Result only from BM25 search
- `'hybrid'`: Result from both (merged)

**Example result:**

```typescript
{
  path: 'src/auth/middleware.ts',
  score: 0.856,
  method: 'hybrid',
  matchedTerms: ['authenticate', 'middleware'],  // From BM25
  similarity: 0.92,                              // From vector
  content: 'export async function authenticate(req, res, next) {...}',
  chunkType: 'FunctionDeclaration',
  startLine: 15,
  endLine: 25,
  language: 'typescript'
}
```

## Performance Comparison

**Search time comparison (10k chunks):**

| Mode | Time | Quality |
|------|------|---------|
| BM25 only | 10-20ms | Good for exact matches |
| Vector only | 30-50ms | Best semantic understanding |
| Hybrid (0.7) | 40-60ms | Best overall quality |

**Trade-offs:**

- BM25: Fastest, but misses semantic matches
- Vector: Best quality, but slower and requires embeddings
- Hybrid: Balanced performance and quality (recommended)

**Optimization tips:**

1. **Limit candidate size**: Use smaller limits for faster searches
   ```typescript
   const results = await hybridSearch(query, indexer, {
     limit: 5  // Fewer results = faster
   })
   ```

2. **Cache frequently used queries**: Hybrid search results are cached automatically
   ```typescript
   // First call: 50ms (executes both searches)
   await hybridSearch('authentication', indexer)

   // Second call: <1ms (cache hit)
   await hybridSearch('authentication', indexer)
   ```

3. **Skip vector search for simple queries**: Use BM25 for exact identifiers
   ```typescript
   if (isSimpleIdentifier(query)) {
     return keywordSearch(query, indexer)  // Faster
   } else {
     return hybridSearch(query, indexer)   // Better quality
   }
   ```

## Example Queries

**Hybrid search scenarios:**

```typescript
import { hybridSearch } from '@sylphx/coderag/hybrid-search'

// Conceptual query with keywords
await hybridSearch('async error handling middleware', indexer, {
  vectorWeight: 0.7,  // Default
  limit: 10
})

// Class name lookup (favor exact match)
await hybridSearch('UserService', indexer, {
  vectorWeight: 0.3,
  limit: 5
})

// Natural language question (favor semantics)
await hybridSearch('how to validate email addresses', indexer, {
  vectorWeight: 0.9,
  limit: 10
})

// File-filtered search
await hybridSearch('authentication', indexer, {
  vectorWeight: 0.7,
  fileExtensions: ['.ts', '.tsx'],
  pathFilter: 'src/auth'
})
```

**Comparing methods:**

```typescript
const query = 'database connection'

// BM25 only: finds exact matches of "database" and "connection"
const bm25Results = await keywordSearch(query, indexer)

// Vector only: finds all database-related code (pool, client, connection, etc.)
const vectorResults = await semanticSearch(query, indexer)

// Hybrid: combines both for best results
const hybridResults = await hybridSearch(query, indexer)
```
