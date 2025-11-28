# @sylphx/codebase-search

## 0.1.10 (2025-11-28)

### 🐛 Bug Fixes

- **core:** replace chokidar with @parcel/watcher for native FSEvents ([34d3568](https://github.com/SylphxAI/coderag/commit/34d35686e9b38167c1bb07ee67d7acfce9e18df5))

## 0.1.9 (2025-11-28)

### 🐛 Bug Fixes

- **core:** use gitignore patterns in file watcher ([19553d9](https://github.com/SylphxAI/coderag/commit/19553d94774c93be54cae9703a89eafda22f4359))

## 0.1.8 (2025-11-27)

### 🐛 Bug Fixes

- **core:** fallback to polling mode on EMFILE error ([ec473f2](https://github.com/SylphxAI/coderag/commit/ec473f27f653729b44c80dacec5feff6851e3b72))
- **core:** handle EMFILE error in file watcher gracefully ([58849a2](https://github.com/SylphxAI/coderag/commit/58849a2c6c18b82bbe41cc478fe151d81a129554))

## 0.1.7 (2025-11-27)

### 🐛 Bug Fixes

- **core:** batch SQLite inserts to avoid variable limit ([712a7ab](https://github.com/SylphxAI/coderag/commit/712a7ab8459f5a87744ef1276287894efbdddece))
- **core:** handle permission errors when scanning directories ([917e056](https://github.com/SylphxAI/coderag/commit/917e05605eb96ece041c79027796f6bddddd8d80))

### 📚 Documentation

- correct search description - vector search with TF-IDF fallback, not hybrid ([2c9e4eb](https://github.com/SylphxAI/coderag/commit/2c9e4ebb742a41510e043c092321830cf015760d))

## 0.1.6 (2025-11-27)

### 🐛 Bug Fixes

- simplify prepack to just build own package ([87a7e95](https://github.com/SylphxAI/coderag/commit/87a7e951219554b8a42ee7c6b61965fe264c0fa8))

## 0.1.5 (2025-11-27)

### 🐛 Bug Fixes

- use bunx turbo in prepack for CI compatibility ([301fdec](https://github.com/SylphxAI/coderag/commit/301fdecf1d917fb90de96e15f870edbc2f4f7a1e))
- add prepack scripts with turbo for proper builds ([59fafd1](https://github.com/SylphxAI/coderag/commit/59fafd15ad3759d2ceaeee2a207b8bb1dfa1601f))

## 0.1.4 (2025-11-27)

### 🐛 Bug Fixes

- remove prepack scripts - let bump handle builds ([cfeebc7](https://github.com/SylphxAI/coderag/commit/cfeebc78d09903d8a920c002ad00c4177f45e537))

## 0.1.3 (2025-11-27)

### ♻️ Refactoring

- **vector:** replace hnswlib-node with LanceDB ([2c8da9b](https://github.com/SylphxAI/coderag/commit/2c8da9b34905df36df82a4744e8a81b884587dbe))

### 📚 Documentation

- add @sylphx package credits to READMEs ([155a445](https://github.com/SylphxAI/coderag/commit/155a44592de320e0a84deb16872df01ff83ebbb0))
- update all READMEs with current package names and features ([fe7b08f](https://github.com/SylphxAI/coderag/commit/fe7b08fc0cccf482e38a1840aa929ad24219883a))

### 🔧 Chores

- update @sylphx/biome-config to 0.4.0 and add extends ([ba5e30f](https://github.com/SylphxAI/coderag/commit/ba5e30f9b2862a559ec350c8e5e80f98e6ca8112))
- add prepack scripts to build before publish ([79ca05f](https://github.com/SylphxAI/coderag/commit/79ca05fb4b20aebd9c4ccc4610fd3a468de0cb13))
- update biome config and apply formatting ([467acdb](https://github.com/SylphxAI/coderag/commit/467acdb8c6c4f5b18e39147f05fde70317b1e64d))
- remove banned dependencies and add prepublishOnly script ([ce6a23a](https://github.com/SylphxAI/coderag/commit/ce6a23a35203f18b4b3e8d635a71845b1af98efa))

## 0.1.2 (2025-11-27)

### ♻️ Refactoring

- **vector:** replace hnswlib-node with LanceDB ([2c8da9b](https://github.com/SylphxAI/coderag/commit/2c8da9b34905df36df82a4744e8a81b884587dbe))

### 📚 Documentation

- add @sylphx package credits to READMEs ([155a445](https://github.com/SylphxAI/coderag/commit/155a44592de320e0a84deb16872df01ff83ebbb0))
- update all READMEs with current package names and features ([fe7b08f](https://github.com/SylphxAI/coderag/commit/fe7b08fc0cccf482e38a1840aa929ad24219883a))

### 🔧 Chores

- update @sylphx/biome-config to 0.4.0 and add extends ([ba5e30f](https://github.com/SylphxAI/coderag/commit/ba5e30f9b2862a559ec350c8e5e80f98e6ca8112))
- add prepack scripts to build before publish ([79ca05f](https://github.com/SylphxAI/coderag/commit/79ca05fb4b20aebd9c4ccc4610fd3a468de0cb13))
- update biome config and apply formatting ([467acdb](https://github.com/SylphxAI/coderag/commit/467acdb8c6c4f5b18e39147f05fde70317b1e64d))
- remove banned dependencies and add prepublishOnly script ([ce6a23a](https://github.com/SylphxAI/coderag/commit/ce6a23a35203f18b4b3e8d635a71845b1af98efa))

## 0.1.1 (2025-11-27)

### ♻️ Refactoring

- **vector:** replace hnswlib-node with LanceDB ([2c8da9b](https://github.com/SylphxAI/coderag/commit/2c8da9b34905df36df82a4744e8a81b884587dbe))

### 📚 Documentation

- add @sylphx package credits to READMEs ([155a445](https://github.com/SylphxAI/coderag/commit/155a44592de320e0a84deb16872df01ff83ebbb0))
- update all READMEs with current package names and features ([fe7b08f](https://github.com/SylphxAI/coderag/commit/fe7b08fc0cccf482e38a1840aa929ad24219883a))

### 🔧 Chores

- update @sylphx/biome-config to 0.4.0 and add extends ([ba5e30f](https://github.com/SylphxAI/coderag/commit/ba5e30f9b2862a559ec350c8e5e80f98e6ca8112))
- add prepack scripts to build before publish ([79ca05f](https://github.com/SylphxAI/coderag/commit/79ca05fb4b20aebd9c4ccc4610fd3a468de0cb13))
- update biome config and apply formatting ([467acdb](https://github.com/SylphxAI/coderag/commit/467acdb8c6c4f5b18e39147f05fde70317b1e64d))
- remove banned dependencies and add prepublishOnly script ([ce6a23a](https://github.com/SylphxAI/coderag/commit/ce6a23a35203f18b4b3e8d635a71845b1af98efa))

## 0.1.0

### Minor Changes

- bff0e19: Add Synth AST-based code chunking for semantic code splitting

  **New Features:**
  - AST-aware chunking using Synth parsers (6+ languages: JS/TS, Markdown, HTML, JSON, YAML)
  - Semantic boundary detection (functions, classes, interfaces)
  - Context preservation (includes imports/types in each chunk)
  - Smart chunk merging that respects semantic units
  - Graceful fallback to character chunking when AST parsing fails

  **API:**
  - `chunkCodeByAST()` - Full API with metadata (type, line numbers, etc.)
  - `chunkCodeByASTSimple()` - Simplified API returning string array

  **Quality Improvements:**
  - 75% more semantic chunks compared to character-based chunking
  - 100% semantic accuracy (no broken functions/classes)
  - Better embeddings for RAG (complete semantic units)

  **Dependencies:**
  - Added `@sylphx/synth@^0.1.3`
  - Added `@sylphx/synth-js@^0.2.0` (with TypeScript support)
  - Added `@sylphx/synth-md@latest`
  - Added `@sylphx/synth-html@latest`
  - Added `@sylphx/synth-json@latest`
  - Added `@sylphx/synth-yaml@latest`

  **Testing:**
  - 17 comprehensive tests (100% passing)
  - Tested with real TypeScript files
  - Validated with Synth v0.2.0

  **Documentation:**
  - Integration plan
  - Usage guide with examples
  - Complete RAG pipeline example
  - Feature summary and validation reports

- 0e8e81a: # 🎉 CodeRAG - Initial Release v0.1.0

  Lightning-fast hybrid code search (TF-IDF + Vector) - RAG-ready for AI assistants

  ## Core Features

  ### Hybrid Search Engine
  - **TF-IDF Search**: Fast keyword-based search with relevance scoring
  - **Vector Search**: Semantic search using embeddings (HNSW algorithm)
  - **Hybrid Ranking**: Weighted combination for best results

  ### Performance
  - **2.7x faster** initial indexing vs traditional approaches
  - **166x faster** incremental updates
  - **100x faster** cached queries

  ### Code Tokenization
  - StarCoder2-based tokenizer for code understanding
  - Handles camelCase, snake_case, code identifiers
  - Lightweight fallback tokenizer (no model download required)

  ### Embedding Provider Support
  - OpenAI (official)
  - OpenAI-compatible (OpenRouter, Together AI, Fireworks AI, Ollama)
  - Extensible provider registry for custom implementations
  - Mock provider for testing

  ### Persistent Storage
  - SQLite-based metadata and index storage
  - Atomic batch operations
  - Incremental update engine

  ### MCP Server
  - Model Context Protocol integration
  - RAG-ready for AI assistants
  - Search tools and index management

  ## Architecture
  - Pure functional design
  - Registry Pattern for extensibility
  - Comprehensive test coverage (396 tests passing)

  ## Packages
  - **@sylphx/coderag**: Core search library
  - **@sylphx/coderag-mcp**: MCP server for AI integration

## 0.2.0

### Minor Changes

- c67a1ff: # 🎉 Initial Release v0.1.0

  ## Core Features

  ### TF-IDF Search Engine
  - Pure functional TF-IDF implementation
  - Incremental updates (166x faster than full rebuild)
  - Keyword-based search with relevance scoring

  ### Vector Search (Semantic)
  - HNSW algorithm for approximate nearest neighbor search
  - OpenAI embeddings integration via Vercel AI SDK
  - Persistent vector index storage

  ### Hybrid Search
  - Weighted combination of TF-IDF + Vector search
  - Configurable search strategies (keyword/semantic/hybrid)
  - LRU cache for query optimization (100x faster cached queries)

  ### Code Tokenization
  - StarCoder2-based tokenizer for improved code understanding
  - Handles camelCase, snake_case, and code identifiers
  - Lightweight fallback tokenizer (no model download required)

  ### Embedding Provider Support
  - OpenAI (official)
  - OpenAI-compatible (OpenRouter, Together AI, Fireworks AI, Ollama)
  - Extensible provider registry for custom implementations
  - Mock provider for testing

  ### Persistent Storage
  - SQLite-based file metadata and index storage
  - Atomic batch operations
  - Migration system for schema updates

  ### MCP Server
  - Model Context Protocol integration
  - Search tools for AI assistants
  - Index management commands

  ## Performance
  - **2.7x faster** initial indexing vs Flow
  - **166x faster** incremental updates vs Flow
  - **100x faster** cached queries vs Flow

  ## Architecture
  - Pure functional design
  - Registry Pattern for extensibility
  - Zero external dependencies for core TF-IDF
  - Comprehensive test coverage (396 tests passing)

  ## Documentation
  - Architecture guides (ARCHITECTURE_EMBEDDINGS.md)
  - Custom provider examples (CUSTOM_PROVIDER_EXAMPLE.md)
  - Provider configuration guide (EMBEDDING_PROVIDERS.md)
  - Deep comparison with Flow (DEEP_COMPARISON.md)
