# What is CodeRAG?

CodeRAG is a lightning-fast semantic code search library designed for RAG (Retrieval-Augmented Generation) applications. It combines traditional keyword search (TF-IDF/BM25) with optional vector embeddings to provide accurate, context-aware code search results.

## Key Features

### AST-Based Chunking

Unlike traditional search that returns entire files, CodeRAG uses Abstract Syntax Tree (AST) parsing to split code at semantic boundaries:

- **Functions**: Find specific function implementations
- **Classes**: Locate class definitions and methods
- **Imports**: Track module dependencies
- **Comments**: Search documentation blocks

This means search results are more precise and consume fewer tokens when used with LLMs.

### Hybrid Search

CodeRAG supports three search modes:

1. **Keyword Search (TF-IDF/BM25)**: Fast, precise matching using StarCoder2 tokenization
2. **Semantic Search (Vector)**: Meaning-based search using embeddings (requires OpenAI API)
3. **Hybrid Search**: Weighted combination of both for best results

### Performance

| Metric | Value |
|--------|-------|
| Indexing Speed | 1000-2000 files/sec |
| Startup Time | <100ms (cached) |
| Search Latency | <50ms |
| Memory per 1000 files | ~1-2 MB |

### Language Support

CodeRAG supports 15+ programming languages out of the box:

- **JavaScript/TypeScript**: JS, JSX, TS, TSX, MJS, CJS
- **Systems**: Python, Go, Rust, Java, C, C++, Ruby, PHP
- **Markup**: Markdown, HTML, XML
- **Data**: JSON, YAML, TOML, Protobuf

## Use Cases

### AI Assistants

CodeRAG powers AI coding assistants by providing relevant code context:

```typescript
// User asks: "How does authentication work?"
const results = await indexer.search('authentication logic')
// Returns: auth.ts:15-45 (login function), middleware/auth.ts:10-30 (JWT validation)
```

### Code Navigation

Build IDE-like "Go to Definition" features:

```typescript
const results = await indexer.search('function getUserById', {
  limit: 1,
  fileExtensions: ['.ts'],
})
```

### Documentation Search

Find relevant code examples for documentation:

```typescript
const results = await indexer.search('database connection pool', {
  includeContent: true,
  contextLines: 5,
})
```

## Architecture

```
┌─────────────────────────────────────────────────┐
│              CodebaseIndexer                     │
├─────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐               │
│  │  TF-IDF     │  │   Vector    │  (optional)   │
│  │  (BM25)     │  │  (OpenAI)   │               │
│  └──────┬──────┘  └──────┬──────┘               │
│         │                │                       │
│         └───────┬────────┘                       │
│                 ▼                                │
│  ┌─────────────────────────────────┐            │
│  │       AST Chunking              │            │
│  │     (tree-sitter + synth)       │            │
│  └─────────────────────────────────┘            │
├─────────────────────────────────────────────────┤
│  ┌─────────────────────────────────┐            │
│  │     PersistentStorage           │            │
│  │        (SQLite)                 │            │
│  └─────────────────────────────────┘            │
└─────────────────────────────────────────────────┘
```

## Next Steps

- [Installation](/guide/installation) - Install CodeRAG in your project
- [Quick Start](/guide/quick-start) - Build your first search index
- [MCP Server](/mcp/overview) - Use with AI assistants
