# Quick Start

Get up and running with CodeRAG in 5 minutes.

## Basic Usage

### 1. Create an Indexer

```typescript
import { CodebaseIndexer, PersistentStorage } from '@sylphx/coderag'

// Create persistent storage (SQLite database)
const storage = new PersistentStorage({
  codebaseRoot: './my-project',
})

// Create the indexer
const indexer = new CodebaseIndexer({
  codebaseRoot: './my-project',
  storage,
})
```

### 2. Index Your Codebase

```typescript
// Index all files
await indexer.index()

// Or index with progress reporting
await indexer.index({
  onProgress: (current, total, file) => {
    console.log(`[${current}/${total}] ${file}`)
  },
})
```

### 3. Search

```typescript
// Search for code
const results = await indexer.search('authentication middleware', {
  limit: 10,
  includeContent: true,
})

// Results include file path, score, and code snippet
for (const result of results) {
  console.log(`${result.path}:${result.startLine}-${result.endLine}`)
  console.log(`Score: ${result.score}`)
  console.log(`Type: ${result.chunkType}`)
  console.log(result.snippet)
  console.log('---')
}
```

## Complete Example

```typescript
import { CodebaseIndexer, PersistentStorage } from '@sylphx/coderag'

async function main() {
  // Setup
  const storage = new PersistentStorage({ codebaseRoot: '.' })
  const indexer = new CodebaseIndexer({
    codebaseRoot: '.',
    storage,
    maxFileSize: 1024 * 1024, // 1MB max file size
  })

  // Index with file watching
  console.log('Indexing codebase...')
  await indexer.index({ watch: true })
  console.log(`Indexed ${await indexer.getIndexedCount()} files`)

  // Search
  const query = 'database connection'
  console.log(`\nSearching for: "${query}"`)

  const results = await indexer.search(query, {
    limit: 5,
    includeContent: true,
    fileExtensions: ['.ts', '.js'],
  })

  // Display results
  for (const result of results) {
    console.log(`\n📄 ${result.path}:${result.startLine || 0}`)
    console.log(`   Score: ${result.score.toFixed(3)}`)
    console.log(`   Type: ${result.chunkType || 'unknown'}`)
    if (result.snippet) {
      console.log(`   Preview: ${result.snippet.slice(0, 100)}...`)
    }
  }

  // Keep watching for changes
  console.log('\n👁️  Watching for file changes...')
}

main().catch(console.error)
```

## With Semantic Search

Enable vector-based semantic search for meaning-based results:

```typescript
import {
  CodebaseIndexer,
  PersistentStorage,
  createEmbeddingProvider,
  hybridSearch,
} from '@sylphx/coderag'

// Create embedding provider (requires OPENAI_API_KEY)
const embeddingProvider = await createEmbeddingProvider({
  provider: 'openai',
  model: 'text-embedding-3-small',
  dimensions: 1536,
})

const storage = new PersistentStorage({ codebaseRoot: '.' })
const indexer = new CodebaseIndexer({
  codebaseRoot: '.',
  storage,
  embeddingProvider,
})

await indexer.index()

// Hybrid search: 70% semantic, 30% keyword
const results = await hybridSearch('user authentication flow', indexer, {
  vectorWeight: 0.7,
  limit: 10,
})
```

## Search Options

```typescript
interface SearchOptions {
  // Number of results to return
  limit?: number // default: 10

  // Include code snippets in results
  includeContent?: boolean // default: true

  // Filter by file extension
  fileExtensions?: string[] // e.g., ['.ts', '.tsx']

  // Filter by path pattern
  pathFilter?: string // e.g., 'src/components'

  // Exclude paths
  excludePaths?: string[] // e.g., ['node_modules', 'dist']

  // Context lines around matches
  contextLines?: number // default: 3

  // Max characters per snippet
  maxSnippetChars?: number // default: 2000

  // Max snippet blocks per file
  maxSnippetBlocks?: number // default: 4
}
```

## File Watching

Enable automatic re-indexing when files change:

```typescript
// Start watching
await indexer.index({ watch: true })

// Or start/stop manually
await indexer.startWatch()
await indexer.stopWatch()

// Check status
console.log(indexer.isWatchEnabled()) // true/false
```

## Keyword vs Semantic Search

### Keyword Search (Default)

Best for exact matches and code symbols:

```typescript
// Good for: function names, variable names, exact matches
const results = await indexer.search('getUserById')
const results = await indexer.search('handleSubmit')
```

### Semantic Search

Best for conceptual queries:

```typescript
import { hybridSearch } from '@sylphx/coderag'

// Good for: concepts, descriptions, "how does X work"
const results = await hybridSearch('authentication flow', indexer, {
  vectorWeight: 0.9, // Almost pure semantic
})
```

### Hybrid Search (Recommended)

Best for general queries:

```typescript
import { hybridSearch } from '@sylphx/coderag'

// Balanced keyword + semantic
const results = await hybridSearch('user login validation', indexer, {
  vectorWeight: 0.7, // 70% semantic, 30% keyword
})
```

## Next Steps

- [How Search Works](/guide/how-search-works) - Understand the search algorithm
- [AST Chunking](/guide/ast-chunking) - Learn about semantic chunking
- [MCP Server](/mcp/overview) - Use with AI assistants
