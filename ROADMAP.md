# Roadmap

## Current Status (v1.0.0)

### ✅ Completed
- TF-IDF based text search
- .gitignore support
- In-memory indexing
- Code-aware tokenization (camelCase, snake_case, etc.)
- MCP server integration
- Basic file scanning and filtering
- Watch mode for development
- Incremental TypeScript builds
- Monorepo structure with Turbo

### ❌ Critical Missing Features
1. **Tests** - No test coverage
2. **Persistent index** - Currently in-memory only (re-indexes on restart)
3. **Incremental indexing** - Full re-index on every change
4. **Symbol search** - No AST-based search
5. **CI/CD pipeline**
6. **Code quality tools** (linting, formatting)

---

## Phase 1: Foundation (v1.1.0) - Q1 2025

**Goal:** Establish production-ready quality and reliability

### Testing Infrastructure
- [ ] Unit tests for core TF-IDF algorithms
- [ ] Integration tests for indexing pipeline
- [ ] MCP server tests
- [ ] Test coverage reporting
- [ ] Benchmark suite

### Code Quality
- [ ] ESLint configuration
- [ ] Prettier formatting
- [ ] Pre-commit hooks
- [ ] Type coverage improvements (`strict: true`)

### CI/CD
- [ ] GitHub Actions workflow
  - [ ] Run tests on PR
  - [ ] Type checking
  - [ ] Linting
  - [ ] Build validation
- [ ] Automated releases
- [ ] npm publishing workflow

### Documentation
- [ ] API documentation (TypeDoc)
- [ ] Contributing guide
- [ ] Architecture documentation
- [ ] Performance benchmarks

---

## Phase 2: Persistence & Performance (v1.2.0) - Q2 2025

**Goal:** Make search fast and persistent across restarts

### Persistent Index
- [ ] SQLite-based index storage
- [ ] Serialize/deserialize TF-IDF vectors
- [ ] Index versioning and migration
- [ ] Configurable storage backends (memory/disk)

### Incremental Indexing
- [ ] File change detection (mtime, hash)
- [ ] Partial re-indexing for changed files
- [ ] Watch mode for automatic re-indexing
- [ ] Debounced indexing on file changes

### Performance Optimizations
- [ ] Worker threads for large codebases
- [ ] Streaming file processing
- [ ] Index compression
- [ ] Query result caching
- [ ] Benchmark improvements (target: <50ms search time)

---

## Phase 3: AST & Symbol Search (v2.0.0) - Q2-Q3 2025

**Goal:** Enable semantic, structure-aware code search

### AST Parsing
- [ ] TypeScript/JavaScript AST parsing (using `@typescript/vfs` or similar)
- [ ] Python AST parsing
- [ ] Go AST parsing
- [ ] Rust AST parsing (via tree-sitter)
- [ ] Language-agnostic tree-sitter integration

### Symbol Extraction
- [ ] Extract all symbols (functions, classes, interfaces, types, variables)
- [ ] Symbol metadata (location, kind, scope, visibility)
- [ ] Import/export relationships
- [ ] Symbol signatures

### Symbol Search
- [ ] Search by symbol name
- [ ] Search by symbol kind (e.g., "find all functions")
- [ ] Search by symbol signature
- [ ] Go-to-definition support
- [ ] Find all references
- [ ] Find implementations

### Structural Search
- [ ] Query language for structural patterns
- [ ] AST-based pattern matching
- [ ] Type-aware search (e.g., "functions returning Promise<User>")
- [ ] Scope-aware search

---

## Phase 4: Advanced Features (v2.1.0+) - Q3-Q4 2025

**Goal:** Add powerful semantic and cross-reference capabilities

### Cross-Reference Analysis
- [ ] Call graph generation
- [ ] Import dependency graph
- [ ] Find unused exports
- [ ] Dead code detection
- [ ] Circular dependency detection

### Semantic Search
- [ ] Embeddings-based semantic search (optional, using local models)
- [ ] Similar code fragment search
- [ ] Code clone detection
- [ ] Search by documentation/comments

### Language Server Protocol (LSP)
- [ ] LSP server implementation
- [ ] Editor integrations (VSCode, Neovim, etc.)
- [ ] Real-time symbol indexing
- [ ] Code navigation

### Enhanced MCP Server
- [ ] Real-time index updates
- [ ] Streaming search results
- [ ] Symbol search via MCP tool
- [ ] Multi-repo indexing
- [ ] Index statistics and diagnostics

---

## Phase 5: Ecosystem & Integrations (v3.0.0) - 2026

**Goal:** Build a rich ecosystem of integrations

### Platform Integrations
- [ ] GitHub API integration (search across repos)
- [ ] GitLab integration
- [ ] Bitbucket integration
- [ ] Self-hosted Git support

### AI Integrations
- [ ] RAG (Retrieval-Augmented Generation) support
- [ ] Code summarization
- [ ] Intelligent query expansion
- [ ] Natural language to structural query

### CLI Tool
- [ ] Standalone CLI for terminal use
- [ ] Interactive search UI (TUI)
- [ ] Query result formatting (JSON, table, etc.)
- [ ] Configuration file support

### Plugins & Extensions
- [ ] Plugin API for custom analyzers
- [ ] Custom tokenizers
- [ ] Custom ranking algorithms
- [ ] Language support plugins

---

## Long-Term Vision

### Multi-Language Support
Expand AST support to cover:
- Java, C#, C++
- Ruby, PHP
- Swift, Kotlin
- Elixir, Clojure
- And more...

### Distributed Indexing
- Index sharding for massive codebases
- Distributed search across multiple machines
- Cloud-native deployment

### Advanced Analytics
- Code complexity metrics
- Code quality scoring
- Technical debt analysis
- Change impact analysis

---

## Contributing

We welcome contributions! Check our [Contributing Guide](./CONTRIBUTING.md) for details.

**Priority Areas for Contributors:**
1. **Tests** - Help us reach 80%+ coverage
2. **AST Parsers** - Add support for more languages
3. **Documentation** - Improve examples and guides
4. **Performance** - Optimize indexing and search

---

## Release Schedule

- **v1.1.0** - Q1 2025 (Testing & Quality)
- **v1.2.0** - Q2 2025 (Persistence & Performance)
- **v2.0.0** - Q3 2025 (AST & Symbol Search)
- **v2.1.0** - Q4 2025 (Advanced Features)
- **v3.0.0** - 2026 (Ecosystem)

**Note:** Dates are estimates and subject to change based on community feedback and priorities.
