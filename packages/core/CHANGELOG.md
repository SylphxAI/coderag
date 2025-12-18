# @sylphx/codebase-search

## 0.1.25 (2025-12-18)

### 🐛 Bug Fixes

- **core:** maxFileSize option not respected in index() and add comprehensive indexer tests ([61fc201](https://github.com/SylphxAI/coderag/commit/61fc20101efcac9e786190ff6b6da88c51f8b351))

## 0.1.24 (2025-12-18)

### 🐛 Bug Fixes

- **core:** critical memory leak in pendingFileChanges (#51) ([3c83d15](https://github.com/SylphxAI/coderag/commit/3c83d15a9734413eb86724f45779d9661edfae84))

## 0.1.23 (2025-12-10)

### 🐛 Bug Fixes

- **core:** use explicit version constraints for synth packages (#48) ([814a356](https://github.com/SylphxAI/coderag/commit/814a3567539e0c51389e7c866a4ababee2f64b4d))

## 0.1.22 (2025-12-10)

### ✨ Features

- **core:** upgrade synth parsers to WASM for cross-platform support (#44) ([e589110](https://github.com/SylphxAI/coderag/commit/e589110b985f730f127edede3e37158d4868e8c3))

### 📚 Documentation

- **core:** document WASM parser async requirement (#46) ([197f868](https://github.com/SylphxAI/coderag/commit/197f8688e1f4fc255d93e90006d63a5dcbb99364))

## 0.1.21 (2025-12-10)

### ✨ Features

- **core:** upgrade synth parsers to WASM for cross-platform support (#44) ([e589110](https://github.com/SylphxAI/coderag/commit/e589110b985f730f127edede3e37158d4868e8c3))

### 🐛 Bug Fixes

- **core:** move native deps to optionalDependencies for npx compatibility (#42) ([2580a7a](https://github.com/SylphxAI/coderag/commit/2580a7aac2cdde0a9ccfb4eb9ca9d5ea5898177c))

## 0.1.21 (2025-12-10)

### 🐛 Bug Fixes

- **core:** move native deps to optionalDependencies for npx compatibility (#42) ([2580a7a](https://github.com/SylphxAI/coderag/commit/2580a7aac2cdde0a9ccfb4eb9ca9d5ea5898177c))

## 0.1.20 (2025-12-10)

### ✨ Features

- **core:** replace better-sqlite3 with libsql for WASM compatibility (#40) ([e568f66](https://github.com/SylphxAI/coderag/commit/e568f666de7e69eac1f6f1e231e7a406d11e4f41))

## 0.1.19 (2025-11-29)

### ✨ Features

- **core:** use chunk-based progress tracking ([a6d7570](https://github.com/SylphxAI/coderag/commit/a6d7570df3488668ac520e454bebbe75c47739a1))

### 📚 Documentation

- update READMEs with LLM-optimized output format and add Rust support ([d0e4023](https://github.com/SylphxAI/coderag/commit/d0e40232284881e5d2cb091afde2a1a2d315d738))

## 0.1.18 (2025-11-29)

### 🐛 Bug Fixes

- **core:** correct markdown listItem boundary type ([0024435](https://github.com/SylphxAI/coderag/commit/002443591c571f0ab0baeacee12f00bce47cc9c5))

### 🔧 Chores

- **core:** add synth-md-gfm dependency (table support pending fix) ([cf345fc](https://github.com/SylphxAI/coderag/commit/cf345fc116984167b6a92fb980d80e815eb99765))

## 0.1.17 (2025-11-28)

### ✨ Features

- **core:** add multi-language AST support with config-driven registry ([c2a6e68](https://github.com/SylphxAI/coderag/commit/c2a6e68141b7e094567add6112f5a44bedec8e2d))
- **core:** update embedding/vector search to use chunk-level indexing ([5580d0b](https://github.com/SylphxAI/coderag/commit/5580d0b9fdfc0d2b2a26ba2d8a0362e80f034141))
- **core:** implement chunk-level indexing for BM25 search ([ff4c51b](https://github.com/SylphxAI/coderag/commit/ff4c51ba743df9e1dd7a828dc8b250ef6acd5f0e))

## 0.1.16 (2025-11-28)

### 🐛 Bug Fixes

- **core:** improve snippet scoring to prioritize unique matched terms ([1e4d474](https://github.com/SylphxAI/coderag/commit/1e4d4749877d76f48d72b55e152a771b37240b22))

## 0.1.15 (2025-11-28)

### ✨ Features

- **core:** improve snippet extraction with block-based approach ([4258a9d](https://github.com/SylphxAI/coderag/commit/4258a9d9af65bae345947da83a1b39326b659a38))

## 0.1.14 (2025-11-28)

### ✨ Features

- **core:** upgrade search from TF-IDF to BM25 ([3fbad14](https://github.com/SylphxAI/coderag/commit/3fbad14e775c3b413cd4c3af4b70d1086842b928))

### 🔧 Chores

- trigger release for mcp-server 0.3.17 ([fcb02f3](https://github.com/SylphxAI/coderag/commit/fcb02f3cf67ab5097d3bea942f003c0f52462339))

## 0.1.14 (2025-11-28)

### ✨ Features

- **core:** upgrade search from TF-IDF to BM25 ([3fbad14](https://github.com/SylphxAI/coderag/commit/3fbad14e775c3b413cd4c3af4b70d1086842b928))

### 🔧 Chores

- trigger release for mcp-server 0.3.17 ([fcb02f3](https://github.com/SylphxAI/coderag/commit/fcb02f3cf67ab5097d3bea942f003c0f52462339))

## 0.1.13 (2025-11-28)

### ✨ Features

- **core:** add incremental diff detection for stale indexes ([84c878b](https://github.com/SylphxAI/coderag/commit/84c878b1827ea57f227f9fd37f538e8b06c25355))
- **core:** move storage to ~/.coderag with project isolation ([cd4a7f3](https://github.com/SylphxAI/coderag/commit/cd4a7f355d5045dc6b386f4f41d28869d2dcaf55))

### 🐛 Bug Fixes

- **core:** true incremental TF-IDF updates without loading all files ([c99467d](https://github.com/SylphxAI/coderag/commit/c99467d9f47ee54eb9b6a50f85beac2f7978ef89))

### 🔧 Chores

- **core:** auto-cleanup old .codebase-search folders ([91a218c](https://github.com/SylphxAI/coderag/commit/91a218c5d9c7772a545e29ffeae80bcd57ead656))

## 0.1.12 (2025-11-28)

### ⚡️ Performance

- **core:** add SQL-based search for low memory mode ([e7b49d4](https://github.com/SylphxAI/coderag/commit/e7b49d40d9953cb956544f484e528e61c75cccf4))
- **core:** add batch file processing for memory optimization ([d241428](https://github.com/SylphxAI/coderag/commit/d241428ab9e6048fa040d786ac04a875d4252ad0))
- **core:** optimize search CPU and memory usage ([cbfb4d9](https://github.com/SylphxAI/coderag/commit/cbfb4d995a859585aae32d676356dd7d7ad8492e))

## 0.1.11 (2025-11-28)

### 🐛 Bug Fixes

- **core:** deduplicate query tokens to avoid repeated matchedTerms ([5a2ed8d](https://github.com/SylphxAI/coderag/commit/5a2ed8dcf2e7b00c8f6011f97de4c19e1e069bc9))

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
