# Architecture

## Overview

Codebase Search is built as a monorepo with two main packages:
- `@sylphx/codebase-search` - Core search library
- `@sylphx/codebase-search-mcp` - MCP server integration

## Current Architecture (v1.0)

```
┌─────────────────────────────────────────────────────────┐
│                    MCP Server                           │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Tool Registration (codebase_search)             │  │
│  └────────────────┬─────────────────────────────────┘  │
│                   │                                     │
│                   v                                     │
│  ┌──────────────────────────────────────────────────┐  │
│  │         CodebaseIndexer API                      │  │
│  │  - index()                                       │  │
│  │  - search()                                      │  │
│  │  - getStatus()                                   │  │
│  └────────────────┬─────────────────────────────────┘  │
└───────────────────┼─────────────────────────────────────┘
                    │
                    │ import
                    │
┌───────────────────▼─────────────────────────────────────┐
│              @sylphx/codebase-search                    │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │             CodebaseIndexer                      │  │
│  │  - Orchestrates indexing and search             │  │
│  │  - Manages indexing status                      │  │
│  │  - Applies filters                              │  │
│  └──────────┬────────────────────┬──────────────────┘  │
│             │                    │                      │
│             v                    v                      │
│  ┌──────────────────┐  ┌──────────────────────────┐   │
│  │   File Scanner   │  │    TF-IDF Engine         │   │
│  │                  │  │                          │   │
│  │ - scanFiles()    │  │ - buildSearchIndex()     │   │
│  │ - .gitignore     │  │ - searchDocuments()      │   │
│  │ - file filters   │  │ - tokenize()             │   │
│  └──────────┬───────┘  │ - TF-IDF scoring         │   │
│             │           └──────────┬───────────────┘   │
│             v                      v                    │
│  ┌──────────────────────────────────────────────────┐  │
│  │            MemoryStorage                         │  │
│  │  - In-memory document store                     │  │
│  │  - File metadata cache                          │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Core Components

### 1. File Scanner (`utils.ts`)

**Purpose:** Recursively scan directories and filter files

**Key Functions:**
- `scanFiles()` - Walk directory tree
- `loadGitignore()` - Parse .gitignore patterns
- `isTextFile()` - Detect text vs binary files
- `detectLanguage()` - Identify file language

**Filtering:**
- Respects .gitignore patterns
- Excludes binary files
- Size limits (default: 1MB)
- Extension filters
- Path filters

### 2. TF-IDF Engine (`tfidf.ts`)

**Purpose:** Index and rank documents using TF-IDF

**Key Functions:**
- `tokenize()` - Extract identifiers from text
  - Splits camelCase, snake_case, PascalCase
  - Lowercases tokens
  - Filters out very short tokens
- `buildSearchIndex()` - Create TF-IDF vectors
- `searchDocuments()` - Rank documents by query
- `calculateCosineSimilarity()` - Measure relevance

**Ranking:**
1. Base score: Cosine similarity
2. Exact match boost: 1.5x
3. Phrase match boost: 2.0x (all terms present)

### 3. Memory Storage (`storage.ts`)

**Purpose:** In-memory document storage

**Data Structure:**
```typescript
interface CodebaseFile {
  path: string;
  content: string;
  hash: string;
  size: number;
  language?: string;
  indexed: boolean;
}
```

**Operations:**
- `add()` - Store file
- `get()` - Retrieve file
- `getAll()` - List all files
- `clear()` - Reset storage

### 4. Codebase Indexer (`indexer.ts`)

**Purpose:** High-level API for indexing and search

**Workflow:**
```
index()
  ↓
scanFiles()  →  Load files
  ↓
MemoryStorage.add()  →  Store files
  ↓
buildSearchIndex()  →  Create TF-IDF index
  ↓
Ready for search()
```

**Search Options:**
- `limit` - Max results
- `includeContent` - Include snippets
- `fileExtensions` - Filter by extension
- `pathFilter` - Filter by path
- `excludePaths` - Exclude paths

## Data Flow

### Indexing Flow

```
User requests index
       ↓
CodebaseIndexer.index()
       ↓
scanFiles(codebaseRoot)
       ↓
For each file:
  - Read content
  - Calculate hash
  - Detect language
  - Store in MemoryStorage
       ↓
buildSearchIndex(documents)
       ↓
For each document:
  - Tokenize content
  - Calculate TF-IDF
  - Store vectors
       ↓
Index ready
```

### Search Flow

```
User submits query
       ↓
CodebaseIndexer.search(query)
       ↓
Apply filters:
  - fileExtensions
  - pathFilter
  - excludePaths
       ↓
searchDocuments(query, filteredIndex)
       ↓
For each document:
  - Tokenize query
  - Calculate cosine similarity
  - Apply boost factors
  - Rank results
       ↓
Return top N results with snippets
```

## MCP Integration

### Server Lifecycle

```
Server starts
       ↓
Create CodebaseIndexer
       ↓
Auto-index (if enabled)
  - Progress logging
  - Error handling
       ↓
Register MCP tool
       ↓
Connect to stdio transport
       ↓
Ready for requests
```

### Tool Execution

```
Claude calls codebase_search
       ↓
Check indexing status
  - If indexing: Return progress
  - If empty: Return error
       ↓
Execute search with filters
       ↓
Format results as Markdown
       ↓
Return to Claude
```

## Performance Characteristics

### Current (v1.0)

**Indexing:**
- Speed: ~1000-2000 files/second (single-threaded)
- Memory: ~1-2 MB per 1000 files
- Storage: In-memory only (lost on restart)

**Search:**
- Speed: <100ms for typical queries
- Scalability: Linear with corpus size
- Accuracy: Keyword-based (TF-IDF)

**Limitations:**
- Full re-index on restart
- No persistent storage
- Single-threaded
- Text-based only (no AST)

## Future Architecture (v2.0+)

### Planned Changes

1. **Persistent Storage Layer**
   ```
   ┌─────────────────────────────────┐
   │    Storage Interface            │
   ├─────────────────────────────────┤
   │  MemoryStorage (current)        │
   │  SQLiteStorage (planned)        │
   │  PostgresStorage (future)       │
   └─────────────────────────────────┘
   ```

2. **AST Layer**
   ```
   ┌─────────────────────────────────┐
   │       AST Parser                │
   ├─────────────────────────────────┤
   │  TypeScript/JavaScript          │
   │  Python                         │
   │  Go                             │
   │  Tree-sitter (universal)        │
   └──────────────┬──────────────────┘
                  │
                  ▼
   ┌─────────────────────────────────┐
   │    Symbol Extractor             │
   │  - Functions                    │
   │  - Classes                      │
   │  - Types/Interfaces             │
   │  - Variables                    │
   └──────────────┬──────────────────┘
                  │
                  ▼
   ┌─────────────────────────────────┐
   │    Symbol Index                 │
   │  - Name search                  │
   │  - Type search                  │
   │  - Reference search             │
   └─────────────────────────────────┘
   ```

3. **Multi-Layer Search**
   ```
   User Query
        ↓
   ┌─────────────────────────────────┐
   │   Query Router                  │
   ├─────────────────────────────────┤
   │  Text search  → TF-IDF Engine   │
   │  Symbol search → AST Index      │
   │  Semantic search → Embeddings   │
   └─────────────────────────────────┘
   ```

4. **Incremental Indexing**
   ```
   File Change Event
        ↓
   Check mtime/hash
        ↓
   Changed? → Re-index file
        ↓
   Update indexes:
     - TF-IDF vectors
     - AST symbols
     - Cross-references
        ↓
   Persist to storage
   ```

## Design Principles

1. **Simplicity First** - Start with simple, working solutions
2. **Incremental Complexity** - Add features progressively
3. **Modular Design** - Each component has a single responsibility
4. **Type Safety** - Leverage TypeScript for correctness
5. **Performance** - Optimize for common cases, profile before optimizing
6. **Testability** - Design for easy testing
7. **Extensibility** - Support plugins and custom backends

## Technology Stack

- **Language:** TypeScript
- **Build:** Turbo monorepo + TypeScript compiler
- **Testing:** Vitest (configured but no tests yet)
- **MCP:** @modelcontextprotocol/sdk
- **Dependencies:**
  - `ignore` - .gitignore parsing
  - `zod` - Schema validation (MCP)

## Security Considerations

- **File Access:** Only reads files, never writes
- **Path Traversal:** Respects .gitignore, no symlink following
- **Secrets:** Excludes common secret files (.env, credentials.json)
- **Binary Files:** Automatically skipped
- **Size Limits:** Configurable max file size (default 1MB)

## Next Steps

See [ROADMAP.md](../ROADMAP.md) for planned improvements.
