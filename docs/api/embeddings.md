# Embedding Providers

CodeRAG supports multiple embedding providers for semantic vector search. Providers use the Vercel AI SDK with OpenAI-compatible APIs.

## createEmbeddingProvider()

Factory function to create embedding providers.

```typescript
function createEmbeddingProvider(config: EmbeddingConfig): EmbeddingProvider
```

### Parameters

**config** `EmbeddingConfig`

```typescript
interface EmbeddingConfig {
  provider: 'openai' | 'openai-compatible' | 'mock'
  model: string              // Model name
  dimensions: number         // Vector dimensions
  apiKey?: string           // API key (or use OPENAI_API_KEY env var)
  baseURL?: string          // Custom endpoint for OpenAI-compatible APIs
  batchSize?: number        // Embedding batch size (default: 10)
}
```

### Returns

`EmbeddingProvider` instance

```typescript
interface EmbeddingProvider {
  name: string
  model: string
  dimensions: number
  generateEmbedding(text: string): Promise<number[]>
  generateEmbeddings(texts: string[]): Promise<number[][]>
}
```

### Example

```typescript
import { createEmbeddingProvider } from '@sylphx/coderag'

const provider = createEmbeddingProvider({
  provider: 'openai',
  model: 'text-embedding-3-small',
  dimensions: 1536,
  apiKey: process.env.OPENAI_API_KEY
})

// Generate single embedding
const embedding = await provider.generateEmbedding('function hello() {}')
console.log(embedding.length)  // 1536

// Generate batch
const embeddings = await provider.generateEmbeddings([
  'function a() {}',
  'class B {}'
])
console.log(embeddings.length)  // 2
```

## OpenAI Provider

Uses OpenAI's embedding models.

### Supported Models

**text-embedding-3-small** (recommended)
- Dimensions: 1536
- Performance: Fast
- Cost: Low
- Quality: Good for code

**text-embedding-3-large**
- Dimensions: 3072
- Performance: Slower
- Cost: Higher
- Quality: Better semantic understanding

**text-embedding-ada-002** (legacy)
- Dimensions: 1536
- Performance: Fast
- Cost: Low
- Quality: Good

### Example

```typescript
const provider = createEmbeddingProvider({
  provider: 'openai',
  model: 'text-embedding-3-small',
  dimensions: 1536,
  apiKey: process.env.OPENAI_API_KEY
})
```

### Environment Variables

```bash
OPENAI_API_KEY=sk-...
EMBEDDING_MODEL=text-embedding-3-small  # Optional
EMBEDDING_DIMENSIONS=1536               # Optional
```

## OpenAI-Compatible Provider

Use OpenAI-compatible endpoints (OpenRouter, Together AI, etc.).

### Example

```typescript
// OpenRouter
const provider = createEmbeddingProvider({
  provider: 'openai-compatible',
  model: 'openai/text-embedding-3-small',
  dimensions: 1536,
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1'
})

// Together AI
const provider = createEmbeddingProvider({
  provider: 'openai-compatible',
  model: 'togethercomputer/m2-bert-80M-8k-retrieval',
  dimensions: 768,
  apiKey: process.env.TOGETHER_API_KEY,
  baseURL: 'https://api.together.xyz/v1'
})
```

### Environment Variables

```bash
OPENAI_API_KEY=your-key
OPENAI_BASE_URL=https://custom-endpoint/v1
EMBEDDING_MODEL=custom-model-name
EMBEDDING_DIMENSIONS=768
```

## Mock Provider

Deterministic hash-based embeddings for testing (no API calls).

### Example

```typescript
const provider = createEmbeddingProvider({
  provider: 'mock',
  model: 'mock',
  dimensions: 1536
})

// Or use createMockProvider() directly
import { createMockProvider } from '@sylphx/coderag'

const provider = createMockProvider(1536)
```

### Use Cases

- Testing without API costs
- Offline development
- CI/CD pipelines
- Fallback when API unavailable

## Default Provider

Get provider from environment variables.

```typescript
import { getDefaultEmbeddingProvider } from '@sylphx/coderag'

const provider = await getDefaultEmbeddingProvider()
// Detects from OPENAI_API_KEY and OPENAI_BASE_URL
```

### Detection Logic

1. If `OPENAI_BASE_URL` set: `openai-compatible`
2. If `OPENAI_API_KEY` set: `openai`
3. Otherwise: `mock`

## Custom Providers

Register custom embedding providers.

```typescript
import { registerProvider } from '@sylphx/coderag'

registerProvider('huggingface', (config) => ({
  name: 'huggingface',
  model: config.model,
  dimensions: config.dimensions,
  generateEmbedding: async (text) => {
    // Your implementation
    const response = await fetch('https://api-inference.huggingface.co/...', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({ inputs: text })
    })
    const data = await response.json()
    return data.embeddings
  },
  generateEmbeddings: async (texts) => {
    // Batch implementation
    return Promise.all(texts.map(text => this.generateEmbedding(text)))
  }
}))

// Use custom provider
const provider = createEmbeddingProvider({
  provider: 'huggingface',
  model: 'sentence-transformers/all-MiniLM-L6-v2',
  dimensions: 384,
  apiKey: process.env.HF_API_KEY
})
```

## Provider Composition

Combine providers for fallback behavior.

```typescript
import { composeProviders, createOpenAIProvider, createMockProvider } from '@sylphx/coderag'

const primary = createOpenAIProvider({
  provider: 'openai',
  model: 'text-embedding-3-small',
  dimensions: 1536,
  apiKey: process.env.OPENAI_API_KEY
})

const fallback = createMockProvider(1536)

const composed = composeProviders(primary, fallback)
// Uses primary, falls back to mock if primary fails
```

## Utility Functions

### generateMockEmbedding()

Generate deterministic mock embedding.

```typescript
import { generateMockEmbedding } from '@sylphx/coderag'

const embedding = generateMockEmbedding('hello world', 1536)
// Always returns same vector for same input
```

### cosineSimilarity()

Calculate similarity between two vectors.

```typescript
import { cosineSimilarity } from '@sylphx/coderag'

const similarity = cosineSimilarity(embedding1, embedding2)
// Returns: -1 to 1 (1 = identical, 0 = orthogonal, -1 = opposite)
```

### normalizeVector()

Normalize vector to unit length.

```typescript
import { normalizeVector } from '@sylphx/coderag'

const normalized = normalizeVector([3, 4])
// Returns: [0.6, 0.8] (magnitude = 1)
```

### chunkText()

Split text into chunks for embedding.

```typescript
import { chunkText } from '@sylphx/coderag'

const chunks = chunkText(longText, {
  maxChunkSize: 1000,
  overlap: 100
})
```

## Usage with CodebaseIndexer

```typescript
import { CodebaseIndexer, createEmbeddingProvider, PersistentStorage } from '@sylphx/coderag'

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
  vectorBatchSize: 20  // Generate 20 embeddings at once
})

await indexer.index()
// Generates embeddings for each code chunk
```

## Performance

### Batch Size

Control API request size:

```typescript
const provider = createEmbeddingProvider({
  provider: 'openai',
  model: 'text-embedding-3-small',
  dimensions: 1536,
  batchSize: 10  // Default
})

// Larger batches = fewer API calls but higher latency
const indexer = new CodebaseIndexer({
  embeddingProvider: provider,
  vectorBatchSize: 50  // 50 chunks per batch
})
```

### Speed Comparison

Model speeds (approximate):
- `text-embedding-3-small`: ~1000 tokens/sec
- `text-embedding-3-large`: ~500 tokens/sec
- `text-embedding-ada-002`: ~1000 tokens/sec

Indexing 1000 code chunks (~500 tokens each):
- Small model: ~250 seconds (50 batches of 20)
- Large model: ~500 seconds
- Mock provider: ~1 second (no API calls)

## Cost Estimation

OpenAI pricing (as of 2024):
- `text-embedding-3-small`: $0.02 / 1M tokens
- `text-embedding-3-large`: $0.13 / 1M tokens
- `text-embedding-ada-002`: $0.10 / 1M tokens

Example: 10,000 code chunks, 500 tokens each = 5M tokens
- Small: $0.10
- Large: $0.65
- Ada-002: $0.50

## Error Handling

### Automatic Fallback

Provider automatically falls back to mock on error:

```typescript
const provider = createEmbeddingProvider({
  provider: 'openai',
  model: 'text-embedding-3-small',
  dimensions: 1536,
  apiKey: 'invalid-key'
})

const embedding = await provider.generateEmbedding('test')
// Logs: [WARN] OpenAI embedding failed, falling back to mock
// Returns: Mock embedding (deterministic hash)
```

### Manual Error Handling

```typescript
try {
  const embedding = await provider.generateEmbedding(text)
} catch (error) {
  console.error('Embedding generation failed:', error)
  // Handle error
}
```

## Best Practices

**Use environment variables:**
```typescript
// Good
const provider = createEmbeddingProvider({
  provider: 'openai',
  model: 'text-embedding-3-small',
  dimensions: 1536,
  apiKey: process.env.OPENAI_API_KEY  // From env
})

// Avoid
const provider = createEmbeddingProvider({
  apiKey: 'sk-hardcoded-key'  // Security risk
})
```

**Batch when possible:**
```typescript
// Good: Single API call
const embeddings = await provider.generateEmbeddings(texts)

// Avoid: Multiple API calls
const embeddings = await Promise.all(
  texts.map(text => provider.generateEmbedding(text))
)
```

**Choose appropriate dimensions:**
```typescript
// For code search: 1536 is sufficient
const provider = createEmbeddingProvider({
  model: 'text-embedding-3-small',
  dimensions: 1536
})

// For semantic understanding: 3072 is better
const provider = createEmbeddingProvider({
  model: 'text-embedding-3-large',
  dimensions: 3072
})
```

## Related

- [CodebaseIndexer](./indexer.md)
- [Search Functions](./search.md)
- [Types](./types.md)
