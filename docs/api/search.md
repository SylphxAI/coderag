# Search Functions

CodeRAG provides three search modes: hybrid (combines vector and TF-IDF), semantic (vector only), and keyword (TF-IDF only).

## hybridSearch()

Combines vector embeddings and TF-IDF keyword search with weighted scoring.

```typescript
async function hybridSearch(
  query: string,
  indexer: CodebaseIndexer,
  options?: HybridSearchOptions
): Promise<HybridSearchResult[]>
```

### Parameters

**query** `string` - Search query

**indexer** `CodebaseIndexer` - Configured indexer with embeddings

**options** `HybridSearchOptions` (optional)

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

### Returns

`Promise<HybridSearchResult[]>` - Ranked results with metadata

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

### Behavior

**vectorWeight Modes:**
- `>= 0.99`: Pure vector search (semantic only)
- `<= 0.01`: Pure TF-IDF search (keyword only)
- `0.02-0.98`: Hybrid mode (combines both)

**Scoring:**
- Vector score: Cosine similarity (0-1)
- TF-IDF score: BM25 relevance (normalized)
- Combined: `vectorWeight * vector + (1 - vectorWeight) * tfidf`

### Example

```typescript
import { CodebaseIndexer, hybridSearch, createEmbeddingProvider } from '@sylphx/coderag'

// Setup
const embeddingProvider = createEmbeddingProvider({
  provider: 'openai',
  model: 'text-embedding-3-small',
  dimensions: 1536,
  apiKey: process.env.OPENAI_API_KEY
})

const indexer = new CodebaseIndexer({
  codebaseRoot: './src',
  embeddingProvider
})

await indexer.index()

// Hybrid search (70% semantic, 30% keyword)
const results = await hybridSearch(
  'how to authenticate users',
  indexer,
  {
    vectorWeight: 0.7,
    limit: 10,
    includeContent: true
  }
)

for (const result of results) {
  console.log(`${result.path}:${result.startLine} (${result.method})`)
  console.log(`Score: ${result.score.toFixed(3)}`)
  if (result.matchedTerms) {
    console.log(`Keywords: ${result.matchedTerms.join(', ')}`)
  }
  if (result.similarity) {
    console.log(`Semantic similarity: ${result.similarity.toFixed(3)}`)
  }
  if (result.content) {
    console.log(result.content)
  }
  console.log('---')
}
```

### Advanced Usage

**Adjust semantic vs keyword balance:**

```typescript
// More semantic (better for conceptual queries)
const semanticResults = await hybridSearch(query, indexer, {
  vectorWeight: 0.9  // 90% semantic, 10% keyword
})

// More keyword (better for specific terms)
const keywordResults = await hybridSearch(query, indexer, {
  vectorWeight: 0.3  // 30% semantic, 70% keyword
})

// Balanced
const balanced = await hybridSearch(query, indexer, {
  vectorWeight: 0.5  // 50/50 split
})
```

**Filter results:**

```typescript
const results = await hybridSearch(
  'authentication',
  indexer,
  {
    fileExtensions: ['.ts', '.tsx'],
    pathFilter: 'src/auth',
    excludePaths: ['test', 'mock'],
    minScore: 0.1
  }
)
```

## semanticSearch()

Pure vector search using embeddings. Convenience wrapper for `hybridSearch()` with `vectorWeight: 1.0`.

```typescript
async function semanticSearch(
  query: string,
  indexer: CodebaseIndexer,
  options?: Omit<HybridSearchOptions, 'vectorWeight'>
): Promise<HybridSearchResult[]>
```

### Parameters

Same as `hybridSearch()` except `vectorWeight` is fixed at 1.0.

### Returns

`Promise<HybridSearchResult[]>` - Results with `method: 'vector'`

### Example

```typescript
import { semanticSearch } from '@sylphx/coderag'

// Semantic search only
const results = await semanticSearch(
  'find code that handles user authentication',
  indexer,
  { limit: 5 }
)

// Works well for:
// - Conceptual queries ("how to...", "find code that...")
// - Natural language questions
// - Cross-language concepts
// - Similar functionality search
```

## keywordSearch()

Pure TF-IDF/BM25 keyword search. Convenience wrapper for `hybridSearch()` with `vectorWeight: 0.0`.

```typescript
async function keywordSearch(
  query: string,
  indexer: CodebaseIndexer,
  options?: Omit<HybridSearchOptions, 'vectorWeight'>
): Promise<HybridSearchResult[]>
```

### Parameters

Same as `hybridSearch()` except `vectorWeight` is fixed at 0.0.

### Returns

`Promise<HybridSearchResult[]>` - Results with `method: 'tfidf'`

### Example

```typescript
import { keywordSearch } from '@sylphx/coderag'

// Keyword search only
const results = await keywordSearch(
  'createUser validateEmail',
  indexer,
  { limit: 10 }
)

// Works well for:
// - Specific function/variable names
// - Exact terminology
// - API identifiers
// - Symbol search
```

## Search Strategies

### When to Use Each Mode

**Semantic Search** (`semanticSearch()` or high `vectorWeight`)
- Natural language questions
- Conceptual similarity
- "Find code that does X"
- Cross-language patterns
- Requires embedding provider

**Keyword Search** (`keywordSearch()` or low `vectorWeight`)
- Specific identifiers
- Exact function/class names
- Fast lookups
- No API calls needed
- Works offline

**Hybrid Search** (balanced `vectorWeight`)
- Best of both worlds
- Handles varied query types
- More robust results
- Recommended for general use

### Query Examples

**Good for Semantic:**
```typescript
await semanticSearch('how to validate user input', indexer)
await semanticSearch('authentication flow', indexer)
await semanticSearch('error handling patterns', indexer)
```

**Good for Keyword:**
```typescript
await keywordSearch('createUser validateEmail', indexer)
await keywordSearch('React useState useEffect', indexer)
await keywordSearch('class AuthService', indexer)
```

**Good for Hybrid:**
```typescript
await hybridSearch('JWT token authentication', indexer, { vectorWeight: 0.7 })
await hybridSearch('database connection pooling', indexer, { vectorWeight: 0.6 })
await hybridSearch('API error handling middleware', indexer, { vectorWeight: 0.5 })
```

## Score Interpretation

### Vector Similarity

Cosine similarity between query and chunk embeddings:
- `0.9-1.0`: Highly relevant
- `0.7-0.9`: Relevant
- `0.5-0.7`: Somewhat relevant
- `< 0.5`: Weakly relevant

### TF-IDF/BM25 Score

BM25 relevance scoring (varies by corpus):
- Higher = more relevant
- Normalized per query
- Affected by term frequency and document frequency

### Combined Score

Weighted combination in hybrid mode:
- Normalized to 0-1 range
- `vectorWeight` controls the balance
- Results sorted by combined score descending

## Result Metadata

### Chunk Information

Results include AST chunk metadata:

```typescript
const result = results[0]

console.log(`Type: ${result.chunkType}`)  // 'FunctionDeclaration', 'ClassDeclaration', etc.
console.log(`Lines: ${result.startLine}-${result.endLine}`)
console.log(`Language: ${result.language}`)
```

### Match Information

```typescript
// Keyword matches
if (result.matchedTerms) {
  console.log(`Matched terms: ${result.matchedTerms.join(', ')}`)
}

// Vector similarity
if (result.similarity) {
  console.log(`Similarity: ${(result.similarity * 100).toFixed(1)}%`)
}

// Search method
console.log(`Method: ${result.method}`)  // 'vector', 'tfidf', or 'hybrid'
```

## Filtering

### By File Extension

```typescript
const tsResults = await hybridSearch(query, indexer, {
  fileExtensions: ['.ts', '.tsx']
})

const pyResults = await hybridSearch(query, indexer, {
  fileExtensions: ['.py']
})
```

### By Path

```typescript
// Include specific paths
const authResults = await hybridSearch(query, indexer, {
  pathFilter: 'src/auth'
})

// Exclude specific paths
const prodResults = await hybridSearch(query, indexer, {
  excludePaths: ['test', 'mock', 'fixture']
})

// Combine filters
const filtered = await hybridSearch(query, indexer, {
  fileExtensions: ['.ts'],
  pathFilter: 'src',
  excludePaths: ['test', 'dist']
})
```

### By Score

```typescript
const highQuality = await hybridSearch(query, indexer, {
  minScore: 0.5,  // Only high-confidence results
  limit: 5
})
```

## Performance

### Search Speed

- Semantic: ~10-50ms (LanceDB vector search)
- Keyword: ~5-10ms (SQL BM25)
- Hybrid: ~20-60ms (both methods + merging)

### Optimization Tips

**Limit results:**
```typescript
// Faster: fewer results to process
const results = await hybridSearch(query, indexer, { limit: 5 })
```

**Skip content:**
```typescript
// Faster: no snippet generation
const results = await hybridSearch(query, indexer, { includeContent: false })
```

**Filter early:**
```typescript
// Faster: filter at query time, not after
const results = await hybridSearch(query, indexer, {
  fileExtensions: ['.ts'],
  pathFilter: 'src'
})
```

## Error Handling

### Fallback Behavior

If vector search fails, automatically falls back to keyword search:

```typescript
try {
  const results = await hybridSearch(query, indexer, { vectorWeight: 0.7 })
  // Falls back to TF-IDF if embedding generation fails
} catch (error) {
  console.error('Search failed:', error)
}
```

### Missing Embeddings

```typescript
const indexer = new CodebaseIndexer({
  // No embeddingProvider configured
})

// hybridSearch() will use TF-IDF only
const results = await hybridSearch(query, indexer)
// Logs: [INFO] Using TF-IDF search only
```

## Related

- [CodebaseIndexer](./indexer.md)
- [Embeddings](./embeddings.md)
- [Types](./types.md)
