---
layout: home

hero:
  name: CodeRAG
  text: Semantic Code Search
  tagline: Lightning-fast hybrid search with AST chunking - RAG-ready for AI assistants
  image:
    src: /logo.svg
    alt: CodeRAG
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: MCP Server
      link: /mcp/overview
    - theme: alt
      text: View on GitHub
      link: https://github.com/SylphxAI/coderag

features:
  - icon:
      svg: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path fill="currentColor" d="M13 2.03v2.02c4.39.54 7.5 4.53 6.96 8.92c-.46 3.64-3.32 6.53-6.96 6.96v2c5.5-.55 9.5-5.43 8.95-10.93c-.45-4.75-4.22-8.5-8.95-8.97m-2 .03c-1.95.19-3.81.94-5.33 2.2L7.1 5.74c1.12-.9 2.47-1.48 3.9-1.68zM4.26 5.67A9.9 9.9 0 0 0 2.05 11h2c.19-1.42.75-2.77 1.64-3.9zM2.06 13c.2 1.96.97 3.81 2.21 5.33l1.42-1.43A8 8 0 0 1 4.06 13zm5.04 5.37l-1.43 1.37A10 10 0 0 0 11 21.95v-2c-1.42-.2-2.77-.76-3.9-1.58M12 8l-4 4h3v4h2v-4h3z"/></svg>'
    title: Blazing Fast
    details: Index 1000-2000 files/sec with instant startup (<100ms). Incremental updates only reindex changed files.
    link: /guide/performance
    linkText: Learn more

  - icon:
      svg: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a9 9 0 0 0-9 9c0 4.17 2.84 7.67 6.69 8.69L12 22l2.31-2.31C18.16 18.67 21 15.17 21 11a9 9 0 0 0-9-9m0 2c1.66 0 3 1.34 3 3s-1.34 3-3 3s-3-1.34-3-3s1.34-3 3-3m0 14.3a7.2 7.2 0 0 1-6-3.22c.03-1.99 4-3.08 6-3.08c1.99 0 5.97 1.09 6 3.08a7.2 7.2 0 0 1-6 3.22"/></svg>'
    title: AST Chunking
    details: Split code at semantic boundaries (functions, classes) using tree-sitter. 15+ languages supported.
    link: /guide/ast-chunking
    linkText: Learn more

  - icon:
      svg: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5A6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5S14 7.01 14 9.5S11.99 14 9.5 14"/></svg>'
    title: Hybrid Search
    details: Combines TF-IDF keyword search with optional vector embeddings for best-of-both-worlds accuracy.
    link: /guide/hybrid-search
    linkText: Learn more

  - icon:
      svg: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10s10-4.48 10-10S17.52 2 12 2m-2 15l-5-5l1.41-1.41L10 14.17l7.59-7.59L19 8z"/></svg>'
    title: Zero Config
    details: Works out of the box with sensible defaults. Just point to your codebase and start searching.
    link: /guide/quick-start
    linkText: Learn more

  - icon:
      svg: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path fill="currentColor" d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6l6 6zm5.2 0l4.6-4.6l-4.6-4.6L16 6l6 6l-6 6z"/></svg>'
    title: Code-Aware
    details: StarCoder2 tokenization handles camelCase, snake_case, and code-specific patterns correctly.
    link: /guide/tfidf
    linkText: Learn more

  - icon:
      svg: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10s10-4.48 10-10S17.52 2 12 2m4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19c-.14.75-.42 1-.68 1.03c-.58.05-1.02-.38-1.58-.75c-.88-.58-1.38-.94-2.23-1.5c-.99-.65-.35-1.01.22-1.59c.15-.15 2.71-2.48 2.76-2.69a.2.2 0 0 0-.05-.18c-.06-.05-.14-.03-.21-.02c-.09.02-1.49.95-4.22 2.79c-.4.27-.76.41-1.08.4c-.36-.01-1.04-.2-1.55-.37c-.63-.2-1.12-.31-1.08-.66c.02-.18.27-.36.74-.55c2.92-1.27 4.86-2.11 5.83-2.51c2.78-1.16 3.35-1.36 3.73-1.36c.08 0 .27.02.39.12c.1.08.13.19.14.27c-.01.06.01.24 0 .38"/></svg>'
    title: MCP Integration
    details: Built-in Model Context Protocol server for Claude, Cursor, VS Code, and other AI assistants.
    link: /mcp/overview
    linkText: Learn more
---

<script setup>
import { VPTeamMembers } from 'vitepress/theme'
</script>

## Quick Example

```typescript
import { CodebaseIndexer, PersistentStorage } from '@sylphx/coderag'

// Create persistent storage (SQLite)
const storage = new PersistentStorage({ codebaseRoot: './my-project' })

// Initialize indexer
const indexer = new CodebaseIndexer({
  codebaseRoot: './my-project',
  storage,
})

// Index codebase with file watching
await indexer.index({ watch: true })

// Search for code
const results = await indexer.search('authentication logic', {
  limit: 10,
  includeContent: true,
})

console.log(results)
// [{ path: 'src/auth.ts', score: 0.85, snippet: '...', chunkType: 'FunctionDeclaration' }]
```

## Why CodeRAG?

<div class="features-grid">

### Performance First

Built with performance in mind from day one:

- **Fast Indexing**: 1000-2000 files/second
- **Instant Startup**: <100ms with cached index
- **Low Memory**: SQL-based search mode available
- **Incremental Updates**: Only reindex changed files

### Chunk-Level Search

Returns semantic chunks, not entire files:

- **Functions**: Find specific function implementations
- **Classes**: Locate class definitions
- **Methods**: Search within class methods
- **Imports**: Track dependencies

### Production Ready

- 400+ tests passing
- Full TypeScript support
- Comprehensive documentation
- MCP server included

</div>

## Installation

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

:::

## MCP Server (for AI Assistants)

Use CodeRAG with Claude, Cursor, or any MCP-compatible AI assistant:

```bash
npx @sylphx/coderag-mcp --root=/path/to/project
```

Or add to your `claude_desktop_config.json`:

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

<div class="tip custom-block" style="padding-top: 8px">

Ready to get started? Check out the [Quick Start Guide](/guide/quick-start) or learn about the [MCP Server](/mcp/overview).

</div>

<style>
.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
  margin-top: 2rem;
}

.features-grid h3 {
  margin-top: 0;
  border-top: none;
  padding-top: 0;
}
</style>
