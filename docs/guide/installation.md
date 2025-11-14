# Installation

## Prerequisites

- Node.js 18+ or Bun 1.0+
- TypeScript 5.0+ (for TypeScript projects)

## Install Core Package

::: code-group

```bash [bun]
bun add @sylphx/codebase-search
```

```bash [npm]
npm install @sylphx/codebase-search
```

```bash [pnpm]
pnpm add @sylphx/codebase-search
```

```bash [yarn]
yarn add @sylphx/codebase-search
```

:::

## Install MCP Server (Optional)

For AI assistant integration:

::: code-group

```bash [bun]
bun add @sylphx/codebase-search-mcp
```

```bash [npm]
npm install @sylphx/codebase-search-mcp
```

:::

## Environment Setup

Create a `.env` file in your project root:

```bash
# OpenAI API Key (required for vector search)
OPENAI_API_KEY=sk-...

# Optional: Custom base URL for OpenAI-compatible endpoints
OPENAI_BASE_URL=https://api.openrouter.ai/api/v1

# Optional: Custom embedding model
EMBEDDING_MODEL=text-embedding-3-small

# Optional: Custom embedding dimensions
EMBEDDING_DIMENSIONS=1536
```

### Supported Providers

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

## Verify Installation

Create a test file:

```typescript
// test-search.ts
import { CodebaseIndexer } from '@sylphx/codebase-search';

const indexer = new CodebaseIndexer({
  codebaseRoot: process.cwd(),
  indexPath: '.codebase-search'
});

console.log('✅ Codebase Search installed successfully!');
```

Run it:

```bash
bun run test-search.ts
# or
npx tsx test-search.ts
```

## Next Steps

- [Quick Start](./quick-start.md) - Build your first index
- [Embedding Providers](./providers.md) - Configure providers
- [MCP Server](../mcp/installation.md) - Set up AI integration
