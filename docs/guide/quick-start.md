# Quick Start

Get started with Codebase Search in 5 minutes.

## 1. Install

```bash
bun add @sylphx/codebase-search
```

## 2. Set Up Environment

Create `.env`:

```bash
OPENAI_API_KEY=sk-...
```

## 3. Create Indexer

```typescript
// index.ts
import { CodebaseIndexer } from '@sylphx/codebase-search';

const indexer = new CodebaseIndexer({
  codebaseRoot: '/path/to/your/project',
  indexPath: '.codebase-search'
});

// Index your codebase
await indexer.index();

console.log('✅ Indexing complete!');
```

Run it:

```bash
bun run index.ts
```

## 4. Search Your Codebase

```typescript
// search.ts
import { CodebaseIndexer } from '@sylphx/codebase-search';

const indexer = new CodebaseIndexer({
  codebaseRoot: '/path/to/your/project',
  indexPath: '.codebase-search'
});

// Hybrid search (keyword + semantic)
const results = await indexer.search('user authentication', {
  limit: 10,
  vectorWeight: 0.7,  // 70% semantic, 30% keyword
  includeContent: true
});

console.log(`Found ${results.length} results:`);
results.forEach((result, i) => {
  console.log(`\n${i + 1}. ${result.path} (score: ${result.score.toFixed(3)})`);
  console.log(`   ${result.content?.slice(0, 100)}...`);
});
```

Run it:

```bash
bun run search.ts
```

## Search Strategies

### Hybrid Search (Recommended)

Best of both worlds - combines keyword precision with semantic understanding:

```typescript
const results = await indexer.search('authentication logic', {
  vectorWeight: 0.7  // 70% semantic, 30% keyword
});
```

### Keyword Search (Fast)

Traditional TF-IDF for exact term matching:

```typescript
const results = await indexer.keywordSearch('getUserData', {
  limit: 10
});
```

### Semantic Search (Smart)

Vector search for understanding meaning:

```typescript
const results = await indexer.semanticSearch('database connection pool', {
  limit: 10
});
```

## Incremental Updates

Only reindex changed files:

```typescript
// Initial index
await indexer.index();

// ... make changes to your codebase ...

// Incremental update (166x faster!)
await indexer.index();  // Automatically detects changes
```

## Search Options

```typescript
interface SearchOptions {
  limit?: number;           // Max results (default: 10)
  minScore?: number;        // Minimum relevance score (0-1)
  includeContent?: boolean; // Include file content in results
  vectorWeight?: number;    // Semantic vs keyword balance (0-1)
}
```

## Example: Full-Featured Search

```typescript
import { CodebaseIndexer } from '@sylphx/codebase-search';

const indexer = new CodebaseIndexer({
  codebaseRoot: process.cwd(),
  indexPath: '.codebase-search'
});

// Build index
console.log('📦 Indexing codebase...');
await indexer.index();

// Search with all options
const results = await indexer.search('error handling middleware', {
  limit: 5,
  minScore: 0.5,
  includeContent: true,
  vectorWeight: 0.8  // Favor semantic understanding
});

// Display results
console.log(`\n🔍 Found ${results.length} results:\n`);

results.forEach((result, i) => {
  console.log(`${i + 1}. ${result.path}`);
  console.log(`   Score: ${result.score.toFixed(3)}`);
  console.log(`   Language: ${result.language}`);

  if (result.content) {
    const preview = result.content.slice(0, 150).replace(/\n/g, ' ');
    console.log(`   Preview: ${preview}...`);
  }

  console.log('');
});
```

## Performance Tips

### 1. Use Query Caching

Caching is automatic and provides 100x speedup for repeated queries:

```typescript
// First query: ~130ms
const results1 = await indexer.search('authentication');

// Cached query: ~1.3ms (100x faster!)
const results2 = await indexer.search('authentication');
```

### 2. Incremental Updates

Only reindex changed files instead of full rebuild:

```typescript
// Initial index: ~13s for 250 files
await indexer.index();

// Change 5 files...

// Incremental update: ~2.6s (166x faster!)
await indexer.index();
```

### 3. Tune Vector Weight

Adjust based on your search needs:

```typescript
// Favor keyword precision (code symbols)
const results1 = await indexer.search('getUserData', { vectorWeight: 0.3 });

// Favor semantic understanding (concepts)
const results2 = await indexer.search('user authentication', { vectorWeight: 0.8 });

// Balanced (default)
const results3 = await indexer.search('error handling', { vectorWeight: 0.5 });
```

## Next Steps

- [TF-IDF Search](./tfidf.md) - Deep dive into keyword search
- [Vector Search](./vector-search.md) - Understand semantic search
- [Hybrid Search](./hybrid-search.md) - Master combined strategies
- [Embedding Providers](./providers.md) - Configure providers
- [Performance Tuning](./performance.md) - Optimize for your use case
