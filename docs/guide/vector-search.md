# Vector Search

CodeRAG supports semantic search through vector embeddings. Unlike keyword search (BM25), vector search understands meaning and context.

## How Embeddings Work

Embeddings convert text into high-dimensional vectors (arrays of numbers) that capture semantic meaning.

**Key concept:**

Similar code has similar vectors. Vectors are compared using cosine similarity or distance metrics.

**Example:**

```typescript
// These have similar embeddings (close in vector space):
"async function fetchUser(id)"
"function getUser(userId)"
"async getUserById(id)"

// These are dissimilar (far apart):
"async function fetchUser(id)"
"render UI component"
```

**Vector dimensions:**

- OpenAI `text-embedding-3-small`: 1536 dimensions
- OpenAI `text-embedding-3-large`: 3072 dimensions
- Custom models: configurable

Higher dimensions capture more nuance but cost more storage and compute.

**Embedding representation:**

```typescript
const embedding = [0.023, -0.015, 0.042, ..., 0.011] // 1536 numbers for text-embedding-3-small
```

## OpenAI Provider Setup

CodeRAG uses the Vercel AI SDK with OpenAI for embeddings.

**Installation:**

```bash
npm install @sylphx/coderag @ai-sdk/openai ai
```

**Environment variables:**

```bash
# .env
OPENAI_API_KEY=sk-...                        # Required
EMBEDDING_MODEL=text-embedding-3-small       # Optional (default)
EMBEDDING_DIMENSIONS=1536                    # Optional (auto-detected for known models)
OPENAI_BASE_URL=https://api.openai.com/v1   # Optional (for OpenAI-compatible endpoints)
```

**Programmatic configuration:**

```typescript
import { CodebaseIndexer } from '@sylphx/coderag'
import { createEmbeddingProvider, createDefaultConfig } from '@sylphx/coderag/embeddings'

// Auto-detect from environment
const provider = await getDefaultEmbeddingProvider()

// Custom configuration
const customProvider = createEmbeddingProvider({
  provider: 'openai',
  model: 'text-embedding-3-large',
  dimensions: 3072,
  apiKey: process.env.OPENAI_API_KEY,
  batchSize: 10
})

const indexer = new CodebaseIndexer({
  embeddingProvider: customProvider,
  vectorBatchSize: 10
})
```

**Supported providers:**

- `openai`: Official OpenAI API
- `openai-compatible`: OpenAI-compatible endpoints (OpenRouter, Together AI, etc.)
- `mock`: Deterministic mock embeddings for testing

**OpenAI-compatible example:**

```typescript
const provider = createEmbeddingProvider({
  provider: 'openai-compatible',
  model: 'custom-embedding-model',
  dimensions: 768,
  apiKey: process.env.API_KEY,
  baseURL: 'https://api.together.xyz/v1'
})
```

## Vector Storage (LanceDB)

CodeRAG uses LanceDB for efficient vector storage and retrieval.

**Why LanceDB?**

- Embedded database (no separate server)
- Fast vector search with ANN (approximate nearest neighbor)
- Disk-based storage (low memory footprint)
- Native support for filtering and metadata

**Storage location:**

Vectors are stored in `~/.coderag/projects/<hash>/vectors.lance`:

```typescript
import { getCoderagDataDir } from '@sylphx/coderag/db/client'

const dataDir = getCoderagDataDir('/path/to/codebase')
// Returns: /Users/username/.coderag/projects/abc123/

const vectorDbPath = path.join(dataDir, 'vectors.lance')
// Returns: /Users/username/.coderag/projects/abc123/vectors.lance
```

**Vector document structure:**

```typescript
interface VectorDocument {
  readonly id: string              // Unique identifier
  readonly embedding: number[]     // Vector (1536 or 3072 dims)
  readonly metadata: {
    readonly type: 'code' | 'knowledge'
    readonly language?: string     // e.g., 'typescript'
    readonly content?: string      // Code snippet (preview)
    readonly chunkType?: string    // e.g., 'FunctionDeclaration'
    readonly path?: string         // File path
    readonly startLine?: number
    readonly endLine?: number
  }
}
```

**Chunk-level embeddings:**

CodeRAG generates one embedding per chunk (not per file):

```typescript
// Vector ID format: chunk://path:startLine-endLine
const doc: VectorDocument = {
  id: 'chunk://src/utils.ts:5-10',
  embedding: [0.023, -0.015, ...],
  metadata: {
    type: 'code',
    chunkType: 'FunctionDeclaration',
    language: 'typescript',
    content: 'export function parseQuery(query: string): string[] {...}',
    path: 'src/utils.ts',
    startLine: 5,
    endLine: 10
  }
}
```

**Batch insertion:**

Embeddings are added in batches for performance:

```typescript
const batchSize = 10
const chunks = [...] // Array of chunks

for (let i = 0; i < chunks.length; i += batchSize) {
  const batch = chunks.slice(i, i + batchSize)

  // Generate embeddings for batch
  const embeddings = await embeddingProvider.generateEmbeddings(
    batch.map(c => c.content)
  )

  // Add to vector storage
  for (let j = 0; j < batch.length; j++) {
    await vectorStorage.addDocument({
      id: `chunk://${batch[j].path}:${batch[j].startLine}-${batch[j].endLine}`,
      embedding: embeddings[j],
      metadata: { ... }
    })
  }
}
```

Default batch size is 10 (configurable via `vectorBatchSize` option).

## Cosine Similarity Scoring

Vector similarity is measured using cosine similarity, which compares the angle between two vectors.

**Formula:**

```
cosine_similarity(A, B) = (A · B) / (||A|| * ||B||)
```

Where:
- `A · B` = dot product of A and B
- `||A||` = magnitude (length) of vector A
- `||B||` = magnitude (length) of vector B

**Range:**

- 1.0 = identical (same direction)
- 0.0 = orthogonal (no similarity)
- -1.0 = opposite (rarely happens with embeddings)

**Implementation:**

```typescript
export const cosineSimilarity = (vecA: number[], vecB: number[]): number => {
  if (vecA.length !== vecB.length) {
    throw new Error(`Vector dimension mismatch`)
  }

  const { dotProduct, normA, normB } = vecA.reduce(
    (acc, aVal, i) => {
      const bVal = vecB[i]
      return {
        dotProduct: acc.dotProduct + aVal * bVal,
        normA: acc.normA + aVal * aVal,
        normB: acc.normB + bVal * bVal,
      }
    },
    { dotProduct: 0, normA: 0, normB: 0 }
  )

  if (normA === 0 || normB === 0) {
    return 0
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}
```

**LanceDB distance:**

LanceDB uses L2 (Euclidean) distance by default. CodeRAG converts to similarity:

```typescript
// LanceDB returns L2 distance
const distance = result._distance // e.g., 0.5

// Convert to similarity score
const similarity = 1 / (1 + distance) // 0.67
```

**Search example:**

```typescript
import { VectorStorage } from '@sylphx/coderag/vector-storage'

const vectorStorage = new VectorStorage({
  dimensions: 1536,
  dbPath: './vectors.lance'
})

// Generate query embedding
const queryEmbedding = await embeddingProvider.generateEmbedding(
  'async function to fetch user data'
)

// Search for similar vectors
const results = await vectorStorage.search(queryEmbedding, {
  k: 10,              // Top 10 results
  minScore: 0.7       // Minimum similarity threshold
})

for (const result of results) {
  console.log(`${result.doc.metadata.path} (similarity: ${result.similarity})`)
  console.log(result.doc.metadata.content)
}
```

## Embedding Generation

**Single embedding:**

```typescript
const embedding = await embeddingProvider.generateEmbedding(
  'async function fetchUser(id: string)'
)
// Returns: number[] (1536 dimensions)
```

**Batch embeddings:**

```typescript
const texts = [
  'function fetchUser(id)',
  'class UserService',
  'interface User'
]

const embeddings = await embeddingProvider.generateEmbeddings(texts)
// Returns: number[][] (array of 1536-dim vectors)
```

Batch generation is more efficient (single API call).

## Mock Provider

For development and testing, CodeRAG includes a mock embedding provider.

**When to use:**

- Testing without OpenAI API key
- CI/CD pipelines
- Development environments

**Behavior:**

- Generates deterministic embeddings using hash functions
- Same input always produces same vector
- No API calls (instant, free)
- Not semantically meaningful (use for structure testing only)

**Usage:**

```typescript
import { createMockProvider } from '@sylphx/coderag/embeddings'

const mockProvider = createMockProvider(1536)

const embedding = await mockProvider.generateEmbedding('test')
// Returns: deterministic 1536-dim vector
```

**Auto-detection:**

If `OPENAI_API_KEY` is not set, CodeRAG automatically uses mock provider:

```typescript
const provider = await getDefaultEmbeddingProvider()
// Uses 'mock' if no API key, 'openai' if key present
```

## Performance Considerations

**Embedding generation cost:**

- OpenAI `text-embedding-3-small`: ~$0.02 per 1M tokens
- 1000 chunks * ~100 tokens each = 100k tokens = $0.002
- Generation time: ~1-2 seconds per batch of 10

**Optimization strategies:**

1. **Batch processing**: Generate embeddings in batches of 10-50
2. **Caching**: Reuse embeddings for unchanged chunks
3. **Incremental updates**: Only generate embeddings for new/changed chunks
4. **Model selection**: Use `text-embedding-3-small` for lower cost/latency

**Storage requirements:**

```
Chunks: 1000
Dimensions: 1536
Bytes per float: 4
Size: 1000 * 1536 * 4 = 6.14 MB
```

LanceDB compresses vectors, actual disk usage is lower.

**Search performance:**

- Vector search (k=10): ~20-50ms for 10k chunks
- Slower than BM25 (~10-20ms) but provides semantic understanding
- Use hybrid search to combine speed of BM25 with accuracy of vectors
