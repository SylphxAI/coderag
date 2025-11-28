<div align="center">

# CodeRAG

**Lightning-fast hybrid code search for AI assistants**

[![npm version](https://img.shields.io/npm/v/@sylphx/coderag?style=flat-square&label=core)](https://www.npmjs.com/package/@sylphx/coderag)
[![npm version](https://img.shields.io/npm/v/@sylphx/coderag-mcp?style=flat-square&label=mcp)](https://www.npmjs.com/package/@sylphx/coderag-mcp)
[![CI](https://img.shields.io/github/actions/workflow/status/SylphxAI/coderag/ci.yml?style=flat-square)](https://github.com/SylphxAI/coderag/actions)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)

**Zero dependencies** • **<50ms search** • **Hybrid TF-IDF + Vector** • **MCP ready**

[Quick Start](#-quick-start) • [Features](#-features) • [MCP Setup](#-mcp-server-setup) • [API](#-api-reference)

</div>

---

## Why CodeRAG?

Traditional code search tools are either **slow** (full-text grep), **inaccurate** (keyword matching), or **complex** (require external services).

CodeRAG is different:

```
❌ Old way: Docker + ChromaDB + Ollama + 30 second startup
✅ CodeRAG: npx @sylphx/coderag-mcp (instant)
```

| Feature | grep/ripgrep | Cloud RAG | CodeRAG |
|---------|-------------|-----------|---------|
| **Semantic understanding** | ❌ | ✅ | ✅ |
| **Zero external deps** | ✅ | ❌ | ✅ |
| **Offline support** | ✅ | ❌ | ✅ |
| **Startup time** | Instant | 10-30s | <1s |
| **Search latency** | ~100ms | ~500ms | <50ms |

---

## ✨ Features

### Search
- 🔍 **Hybrid Search** - TF-IDF + optional vector embeddings
- 🧠 **StarCoder2 Tokenizer** - Code-aware tokenization (4.7MB, trained on code)
- 📊 **Smoothed IDF** - No term gets ignored, stable ranking
- ⚡ **<50ms Latency** - Instant results even on large codebases

### Indexing
- 🚀 **1000-2000 files/sec** - Fast initial indexing
- 💾 **SQLite Persistence** - Instant startup (<100ms) with cached index
- ⚡ **Incremental Updates** - Smart diff detection, no full rebuilds
- 👁️ **File Watching** - Real-time index updates on file changes

### Integration
- 📦 **MCP Server** - Works with Claude Desktop, Cursor, VS Code, Windsurf
- 🧠 **Vector Search** - Optional OpenAI embeddings for semantic search
- 🌳 **AST Chunking** - Smart code splitting using [Synth](https://github.com/SylphxAI/synth) parsers
- 💻 **Low Memory Mode** - SQL-based search for resource-constrained environments

---

## 🚀 Quick Start

### Option 1: MCP Server (Recommended for AI Assistants)

```bash
npx @sylphx/coderag-mcp --root=/path/to/project
```

Or add to your MCP config:

```json
{
  "mcpServers": {
    "coderag": {
      "command": "npx",
      "args": ["-y", "@sylphx/coderag-mcp", "--root=/path/to/project"]
    }
  }
}
```

See [MCP Server Setup](#-mcp-server-setup) for Claude Desktop, Cursor, VS Code, etc.

### Option 2: As a Library

```bash
npm install @sylphx/coderag
# or
bun add @sylphx/coderag
```

```typescript
import { CodebaseIndexer, PersistentStorage } from '@sylphx/coderag'

// Create indexer with persistent storage
const storage = new PersistentStorage({ codebaseRoot: './my-project' })
const indexer = new CodebaseIndexer({
  codebaseRoot: './my-project',
  storage,
})

// Index codebase (instant on subsequent runs)
await indexer.index({ watch: true })

// Search
const results = await indexer.search('authentication logic', { limit: 10 })
console.log(results)
// [{ path: 'src/auth/login.ts', score: 0.87, matchedTerms: ['authentication', 'logic'], snippet: '...' }]
```

---

## 📦 Packages

| Package | Description | Install |
|---------|-------------|---------|
| [@sylphx/coderag](./packages/core) | Core search library | `npm i @sylphx/coderag` |
| [@sylphx/coderag-mcp](./packages/mcp-server) | MCP server for AI assistants | `npx @sylphx/coderag-mcp` |

---

## 🔌 MCP Server Setup

### Claude Desktop

Add to `claude_desktop_config.json`:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "coderag": {
      "command": "npx",
      "args": ["-y", "@sylphx/coderag-mcp", "--root=/path/to/project"]
    }
  }
}
```

### Cursor

Add to `~/.cursor/mcp.json` (macOS) or `%USERPROFILE%\.cursor\mcp.json` (Windows):

```json
{
  "mcpServers": {
    "coderag": {
      "command": "npx",
      "args": ["-y", "@sylphx/coderag-mcp", "--root=/path/to/project"]
    }
  }
}
```

### VS Code

Add to VS Code settings (JSON) or `.vscode/mcp.json`:

```json
{
  "mcp": {
    "servers": {
      "coderag": {
        "command": "npx",
        "args": ["-y", "@sylphx/coderag-mcp", "--root=${workspaceFolder}"]
      }
    }
  }
}
```

### Windsurf

Add to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "coderag": {
      "command": "npx",
      "args": ["-y", "@sylphx/coderag-mcp", "--root=/path/to/project"]
    }
  }
}
```

### Claude Code

```bash
claude mcp add coderag -- npx -y @sylphx/coderag-mcp --root=/path/to/project
```

---

## 🛠️ MCP Tool: `codebase_search`

Search project source files with hybrid TF-IDF + vector ranking.

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | Yes | - | Search query |
| `limit` | number | No | 10 | Max results |
| `include_content` | boolean | No | true | Include code snippets |
| `file_extensions` | string[] | No | - | Filter by extension (e.g., `[".ts", ".tsx"]`) |
| `path_filter` | string | No | - | Filter by path pattern |
| `exclude_paths` | string[] | No | - | Exclude paths (e.g., `["node_modules", "dist"]`) |

### Example

```json
{
  "query": "user authentication login",
  "limit": 5,
  "file_extensions": [".ts", ".tsx"],
  "exclude_paths": ["node_modules", "dist", "test"]
}
```

### Response Format

```markdown
# 🔍 Codebase Search Results

**Query:** "user authentication login"
**Results:** 3 / 500 files

## 1. `src/auth/login.ts`

- **Score:** 0.87
- **Language:** TypeScript
- **Matched Terms:** authentication, login, user

**Snippet:**
```typescript
15: export async function authenticate(credentials) {
16:   const user = await findUser(credentials.email)
17:   return validatePassword(user, credentials.password)
```

---

## 📚 API Reference

### `CodebaseIndexer`

Main class for indexing and searching.

```typescript
import { CodebaseIndexer, PersistentStorage } from '@sylphx/coderag'

const storage = new PersistentStorage({ codebaseRoot: './project' })
const indexer = new CodebaseIndexer({
  codebaseRoot: './project',
  storage,
  maxFileSize: 1024 * 1024, // 1MB default
})

// Index with file watching
await indexer.index({ watch: true })

// Search with options
const results = await indexer.search('query', {
  limit: 10,
  includeContent: true,
  fileExtensions: ['.ts', '.js'],
  excludePaths: ['node_modules'],
})

// Stop watching
await indexer.stopWatch()
```

### `PersistentStorage`

SQLite-backed storage for instant startup.

```typescript
import { PersistentStorage } from '@sylphx/coderag'

const storage = new PersistentStorage({
  codebaseRoot: './project',  // Creates .coderag/ folder
  dbPath: './custom.db',      // Optional custom path
})
```

### Low-Level TF-IDF Functions

```typescript
import { buildSearchIndex, searchDocuments, initializeTokenizer } from '@sylphx/coderag'

// Initialize StarCoder2 tokenizer (4.7MB, one-time download)
await initializeTokenizer()

// Build index
const documents = [
  { uri: 'file://auth.ts', content: 'export function authenticate...' },
  { uri: 'file://user.ts', content: 'export class User...' },
]
const index = await buildSearchIndex(documents)

// Search
const results = await searchDocuments('authenticate user', index, { limit: 5 })
```

### Vector Search (Optional)

For semantic search with embeddings:

```typescript
import { hybridSearch, createEmbeddingProvider } from '@sylphx/coderag'

// Requires OPENAI_API_KEY environment variable
const results = await hybridSearch('authentication flow', indexer, {
  vectorWeight: 0.7,  // 70% vector, 30% TF-IDF
  limit: 10,
})
```

---

## ⚙️ Configuration

### MCP Server Options

| Option | Default | Description |
|--------|---------|-------------|
| `--root=<path>` | Current directory | Codebase root path |
| `--max-size=<bytes>` | 1048576 (1MB) | Max file size to index |
| `--no-auto-index` | false | Disable auto-indexing on startup |

### Environment Variables

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | Enable vector search with OpenAI embeddings |
| `OPENAI_BASE_URL` | Custom OpenAI-compatible endpoint |
| `EMBEDDING_MODEL` | Embedding model (default: `text-embedding-3-small`) |
| `EMBEDDING_DIMENSIONS` | Custom embedding dimensions |

---

## 📊 Performance

| Metric | Value |
|--------|-------|
| **Initial indexing** | ~1000-2000 files/sec |
| **Startup with cache** | <100ms |
| **Search latency** | <50ms |
| **Memory per 1000 files** | ~1-2 MB |
| **Tokenizer size** | 4.7MB (StarCoder2) |

### Benchmarks

Tested on MacBook Pro M1, 16GB RAM:

| Codebase | Files | Index Time | Search Time |
|----------|-------|------------|-------------|
| Small (100 files) | 100 | 0.5s | <10ms |
| Medium (1000 files) | 1,000 | 2s | <30ms |
| Large (10000 files) | 10,000 | 15s | <50ms |

---

## 🏗️ Architecture

```
coderag/
├── packages/
│   ├── core/                     # @sylphx/coderag
│   │   ├── src/
│   │   │   ├── indexer.ts           # Main indexer with file watching
│   │   │   ├── tfidf.ts             # TF-IDF with StarCoder2 tokenizer
│   │   │   ├── code-tokenizer.ts    # StarCoder2 tokenization
│   │   │   ├── hybrid-search.ts     # Vector + TF-IDF fusion
│   │   │   ├── incremental-tfidf.ts # Smart incremental updates
│   │   │   ├── storage-persistent.ts # SQLite storage
│   │   │   ├── vector-storage.ts    # LanceDB vector storage
│   │   │   ├── embeddings.ts        # OpenAI embeddings
│   │   │   └── ast-chunking.ts      # Synth AST chunking
│   │   └── package.json
│   │
│   └── mcp-server/               # @sylphx/coderag-mcp
│       ├── src/
│       │   └── index.ts             # MCP server
│       └── package.json
```

### How It Works

1. **Indexing**: Scans codebase, tokenizes with StarCoder2, builds TF-IDF index
2. **Storage**: Persists to SQLite (`.coderag/` folder) for instant startup
3. **Watching**: Detects file changes, performs incremental updates
4. **Search**: Hybrid TF-IDF + optional vector search with score fusion

---

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

# Lint & Format
bun run lint
bun run format
```

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Open an issue to discuss changes
2. Fork and create a feature branch
3. Run `bun run lint` and `bun run test`
4. Submit a pull request

---

## 📄 License

MIT © [Sylphx](https://sylphx.com)

---

<div align="center">

**Powered by [Sylphx](https://github.com/SylphxAI)**

Built with [@sylphx/synth](https://github.com/SylphxAI/synth) • [@sylphx/mcp-server-sdk](https://github.com/SylphxAI/mcp-server-sdk) • [@sylphx/doctor](https://github.com/SylphxAI/doctor) • [@sylphx/bump](https://github.com/SylphxAI/bump)

</div>
