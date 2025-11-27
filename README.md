# CodeRAG

Lightning-fast hybrid code search (TF-IDF + Vector) - RAG-ready for AI assistants.

## 📦 Packages

| Package | Version | Description |
|---------|---------|-------------|
| [@sylphx/coderag](./packages/core) | [![npm](https://img.shields.io/npm/v/@sylphx/coderag)](https://www.npmjs.com/package/@sylphx/coderag) | Core search library |
| [@sylphx/coderag-mcp](./packages/mcp-server) | [![npm](https://img.shields.io/npm/v/@sylphx/coderag-mcp)](https://www.npmjs.com/package/@sylphx/coderag-mcp) | MCP server for Claude |

## ✨ Features

- 🔍 **Hybrid Search** - TF-IDF + Vector search with RRF fusion
- 🌳 **AST-based Chunking** - Smart code splitting using [Synth](https://github.com/SylphxAI/synth) parsers
- 🚀 **Fast Indexing** - 1000-2000 files/second with SQLite persistence
- 👁️ **File Watching** - Real-time index updates on file changes
- 💾 **Persistent Storage** - Instant startup (<100ms) with cached index
- ⚡ **Incremental Updates** - Smart delta updates, not full rebuilds
- 🧠 **Embeddings Ready** - Vector search with OpenAI embeddings
- 📦 **MCP Integration** - Works with Claude Desktop out of the box

## 🚀 Quick Start

### As a Library

```bash
bun add @sylphx/coderag
```

```typescript
import { CodebaseIndexer, PersistentStorage } from '@sylphx/coderag'

const storage = new PersistentStorage({ codebaseRoot: './my-project' })
const indexer = new CodebaseIndexer({
  codebaseRoot: './my-project',
  storage,
})

// Index codebase (instant on subsequent runs)
await indexer.index({ watch: true })

// Search
const results = await indexer.search('authentication logic', { limit: 10 })
```

### As MCP Server (Claude Desktop)

```bash
bun add -g @sylphx/coderag-mcp
```

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "coderag": {
      "command": "coderag-mcp",
      "args": ["--root=/path/to/project"]
    }
  }
}
```

## 🏗️ Architecture

```
coderag/
├── packages/
│   ├── core/                  # @sylphx/coderag
│   │   ├── src/
│   │   │   ├── indexer.ts        # Codebase indexing + watch
│   │   │   ├── tfidf.ts          # TF-IDF implementation
│   │   │   ├── ast-chunking.ts   # AST-based code chunking
│   │   │   ├── hybrid-search.ts  # TF-IDF + Vector fusion
│   │   │   ├── vector-storage.ts # Vector storage for embeddings
│   │   │   ├── embeddings.ts     # OpenAI embeddings provider
│   │   │   └── storage-persistent.ts  # SQLite storage
│   │   └── package.json
│   │
│   └── mcp-server/            # @sylphx/coderag-mcp
│       ├── src/
│       │   └── index.ts          # MCP server (uses @sylphx/mcp-server-sdk)
│       └── package.json
│
├── docs/                      # VitePress documentation
└── examples/                  # Usage examples
```

## 📊 Performance

| Metric | Value |
|--------|-------|
| Initial indexing | ~1000-2000 files/sec |
| Startup with cache | <100ms |
| Search latency | <50ms |
| Memory per 1000 files | ~1-2 MB |

## 🔧 Development

```bash
# Clone
git clone https://github.com/SylphxAI/coderag.git
cd coderag

# Install
bun install

# Build
bun run build

# Test
bun run test

# Lint
bun run lint
```

## 📝 License

MIT

---

<div align="center">

**Powered by [Sylphx](https://github.com/SylphxAI)**

Built with [@sylphx/synth](https://github.com/SylphxAI/synth) · [@sylphx/mcp-server-sdk](https://github.com/SylphxAI/mcp-server-sdk) · [@sylphx/doctor](https://github.com/SylphxAI/doctor)

</div>
