# Installation

## Package Installation

::: code-group

```bash [npm]
npm install @sylphx/coderag
```

```bash [pnpm]
pnpm add @sylphx/coderag
```

```bash [bun]
bun add @sylphx/coderag
```

```bash [yarn]
yarn add @sylphx/coderag
```

:::

## Requirements

- **Node.js**: 18.0.0 or higher
- **Runtime**: Node.js, Bun, or Deno

## Optional Dependencies

CodeRAG uses optional dependencies for language-specific AST parsing. These are automatically installed when needed but can be pre-installed for faster startup:

### Language Parsers

```bash
# All languages (recommended)
npm install @sylphx/synth-js @sylphx/synth-python @sylphx/synth-go \
  @sylphx/synth-rust @sylphx/synth-java @sylphx/synth-c

# Specific languages only
npm install @sylphx/synth-js      # JavaScript/TypeScript
npm install @sylphx/synth-python  # Python
npm install @sylphx/synth-go      # Go
npm install @sylphx/synth-rust    # Rust
```

### Vector Search (Optional)

For semantic search with embeddings:

```bash
# LanceDB for vector storage
npm install @lancedb/lancedb
```

## Environment Variables

### For Semantic Search

To enable vector-based semantic search, set your OpenAI API key:

```bash
# Required for semantic search
OPENAI_API_KEY=sk-...

# Optional: Custom endpoint (for OpenAI-compatible APIs)
OPENAI_BASE_URL=https://api.openai.com/v1

# Optional: Custom model
EMBEDDING_MODEL=text-embedding-3-small

# Optional: Custom dimensions
EMBEDDING_DIMENSIONS=1536
```

### Supported Embedding Providers

#### OpenAI (Official)

```bash
OPENAI_API_KEY=sk-...
EMBEDDING_MODEL=text-embedding-3-small  # or text-embedding-3-large
```

#### OpenRouter

```bash
OPENAI_API_KEY=sk-or-...
OPENAI_BASE_URL=https://api.openrouter.ai/api/v1
EMBEDDING_MODEL=openai/text-embedding-3-small
```

#### Together AI

```bash
OPENAI_API_KEY=...
OPENAI_BASE_URL=https://api.together.xyz/v1
EMBEDDING_MODEL=togethercomputer/m2-bert-80M-8k-retrieval
EMBEDDING_DIMENSIONS=768
```

#### Ollama (Local)

```bash
OPENAI_BASE_URL=http://localhost:11434/v1
EMBEDDING_MODEL=nomic-embed-text
EMBEDDING_DIMENSIONS=768
```

## MCP Server Installation

For AI assistant integration (Claude, Cursor, etc.):

```bash
# Run directly with npx (no installation needed)
npx @sylphx/coderag-mcp --root=/path/to/project

# Or install globally
npm install -g @sylphx/coderag-mcp
coderag-mcp --root=/path/to/project
```

## Verifying Installation

Create a test file to verify the installation:

```typescript
// test.ts
import { CodebaseIndexer, PersistentStorage } from '@sylphx/coderag'

const storage = new PersistentStorage({ codebaseRoot: '.' })
const indexer = new CodebaseIndexer({
  codebaseRoot: '.',
  storage,
})

console.log('CodeRAG installed successfully!')
```

Run with:

```bash
npx tsx test.ts
# or
bun test.ts
```

## Troubleshooting

### Native Module Errors (Windows)

If you encounter errors with native modules on Windows, ensure you're using the latest version which uses WASM-based parsers:

```bash
npm install @sylphx/coderag@latest
```

### Tokenizer Download

On first run, CodeRAG downloads the StarCoder2 tokenizer (~4.7MB). This is cached locally after the first download.

```
[INFO] Loading StarCoder2 tokenizer (4.7MB, one-time download)...
[SUCCESS] Tokenizer loaded in 406ms
```

### Memory Issues

For large codebases, enable low memory mode:

```typescript
const indexer = new CodebaseIndexer({
  codebaseRoot: './large-project',
  storage: new PersistentStorage({ codebaseRoot: './large-project' }),
  lowMemoryMode: true, // Uses SQL-based search
})
```

## Next Steps

- [Quick Start](/guide/quick-start) - Build your first search index
- [Performance Tuning](/guide/performance) - Tune for your use case
