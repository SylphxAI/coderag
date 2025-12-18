# @sylphx/codebase-search-mcp

## 0.3.33 (2025-12-18)

### 🐛 Bug Fixes

- **core:** critical memory leak in pendingFileChanges (#51) ([3c83d15](https://github.com/SylphxAI/coderag/commit/3c83d15a9734413eb86724f45779d9661edfae84))

## 0.3.32 (2025-12-10)

### 📦 Dependencies

- Updated `@sylphx/coderag` to 0.1.23

## 0.3.31 (2025-12-10)

### 📦 Dependencies

- Updated `@sylphx/coderag` to 0.1.22

## 0.3.30 (2025-12-10)

### 📦 Dependencies

- Updated `@sylphx/coderag` to 0.1.21

## 0.3.29 (2025-12-10)

### 📦 Dependencies

- Updated `@sylphx/coderag` to 0.1.21

## 0.3.28 (2025-12-10)

### ✨ Features

- **core:** replace better-sqlite3 with libsql for WASM compatibility (#40) ([e568f66](https://github.com/SylphxAI/coderag/commit/e568f666de7e69eac1f6f1e231e7a406d11e4f41))

## 0.3.27 (2025-12-05)

### ♻️ Refactoring

- **mcp-server:** migrate from Zod to Vex ([fe908cb](https://github.com/SylphxAI/coderag/commit/fe908cba0ce2a425d1f01ad8a67d287ac6ad39fb))

### 🔧 Chores

- **deps:** upgrade @sylphx/mcp-server-sdk to ^2.1.0 ([0370bc3](https://github.com/SylphxAI/coderag/commit/0370bc3a703796b47c50daca312c9733db1e35a1))

## 0.3.26 (2025-11-29)

### ✨ Features

- **core:** use chunk-based progress tracking ([a6d7570](https://github.com/SylphxAI/coderag/commit/a6d7570df3488668ac520e454bebbe75c47739a1))

## 0.3.25 (2025-11-29)

### 🐛 Bug Fixes

- **mcp:** improve output format with truncation handling ([40f6698](https://github.com/SylphxAI/coderag/commit/40f669838e324b7bcd6a7c53d9eef60f35fa92bd))

### 📚 Documentation

- update READMEs with LLM-optimized output format and add Rust support ([d0e4023](https://github.com/SylphxAI/coderag/commit/d0e40232284881e5d2cb091afde2a1a2d315d738))

## 0.3.24 (2025-11-29)

### 📦 Dependencies

- Updated `@sylphx/coderag` to 0.1.18

## 0.3.23 (2025-11-28)

### ♻️ Refactoring

- **mcp:** optimize search output format for LLM consumption ([0d31ae5](https://github.com/SylphxAI/coderag/commit/0d31ae53e668d477a4b575be568e3467cb5c4c1b))

## 0.3.22 (2025-11-28)

### ✨ Features

- **core:** implement chunk-level indexing for BM25 search ([ff4c51b](https://github.com/SylphxAI/coderag/commit/ff4c51ba743df9e1dd7a828dc8b250ef6acd5f0e))

## 0.3.21 (2025-11-28)

### 📦 Dependencies

- Updated `@sylphx/coderag` to 0.1.16

## 0.3.20 (2025-11-28)

### ✨ Features

- **core:** improve snippet extraction with block-based approach ([4258a9d](https://github.com/SylphxAI/coderag/commit/4258a9d9af65bae345947da83a1b39326b659a38))

## 0.3.19 (2025-11-28)

### 📦 Dependencies

- Updated `@sylphx/coderag` to 0.1.14

## 0.3.18 (2025-11-28)

### 📦 Dependencies

- Updated `@sylphx/coderag` to 0.1.14

## 0.3.17 (2025-11-28)

### 📦 Dependencies

- Updated `@sylphx/coderag` to 0.1.13

## 0.3.16 (2025-11-28)

### 📦 Dependencies

- Updated `@sylphx/coderag` to 0.1.12

## 0.3.15 (2025-11-28)

### 📦 Dependencies

- Updated `@sylphx/coderag` to 0.1.11

## 0.3.14 (2025-11-28)

### 🐛 Bug Fixes

- **mcp:** start indexing before server.start() to run concurrently ([00bba86](https://github.com/SylphxAI/coderag/commit/00bba86be87ac9d1cc7e08e7272853579a9a7e82))

## 0.3.13 (2025-11-28)

### 🐛 Bug Fixes

- **mcp:** track indexing state to show appropriate status messages ([ac9756d](https://github.com/SylphxAI/coderag/commit/ac9756dd6842f9c8b937d35961d7deacf9a94baf))

## 0.3.12 (2025-11-28)

### 🐛 Bug Fixes

- **mcp:** improve indexing progress display and logging ([2fc8d5c](https://github.com/SylphxAI/coderag/commit/2fc8d5c5faccc02a5a5c7d1bfc0f27c0d24d2748))

## 0.3.11 (2025-11-28)

### 🐛 Bug Fixes

- **mcp:** show "indexing starting" instead of error when index not ready ([70bc32c](https://github.com/SylphxAI/coderag/commit/70bc32ccf2a70e2e514897e0e8341320cea6470a))

## 0.3.10 (2025-11-28)

### ✨ Features

- **mcp:** start server before indexing (non-blocking) ([07e436f](https://github.com/SylphxAI/coderag/commit/07e436f76df903599e1ba2b6ad92239cb8b09603))

## 0.3.9 (2025-11-28)

### 📦 Dependencies

- Updated `@sylphx/coderag` to 0.1.10

## 0.3.8 (2025-11-28)

### 📦 Dependencies

- Updated `@sylphx/coderag` to 0.1.9

## 0.3.7 (2025-11-27)

### 📦 Dependencies

- Updated `@sylphx/coderag` to 0.1.8

## 0.3.6 (2025-11-27)

### 📦 Dependencies

- Updated `@sylphx/coderag` to 0.1.7

## 0.3.5 (2025-11-27)

### 🐛 Bug Fixes

- **deps:** update @sylphx/mcp-server-sdk to 1.1.2 ([f3dc312](https://github.com/SylphxAI/coderag/commit/f3dc312bcb599642a7b7d23b7596661e1b30fd06))

## 0.3.4 (2025-11-27)

### ✨ Features

- **mcp:** add semantic search with OpenAI embeddings, TF-IDF fallback ([799861c](https://github.com/SylphxAI/coderag/commit/799861c108110f26681dcd6480f4795d108b28cf))

### 🐛 Bug Fixes

- **ci:** build packages before npm publish ([9c65abc](https://github.com/SylphxAI/coderag/commit/9c65abca7b99a413a7eb650f7eb01b2ca640eae4))

### 🔧 Chores

- upgrade @sylphx/bump to 1.0.0 and revert workarounds ([7c54ad9](https://github.com/SylphxAI/coderag/commit/7c54ad916910664bf52f69b363b6533fbb634425))

## 0.3.3 (2025-11-27)

### 🐛 Bug Fixes

- **mcp-server:** use ^0.1.5 for @sylphx/coderag to fix workspace:* resolution ([9ba44b7](https://github.com/SylphxAI/coderag/commit/9ba44b713c76ee54775752d447a5683b9368f72e))
- simplify prepack to just build own package ([87a7e95](https://github.com/SylphxAI/coderag/commit/87a7e951219554b8a42ee7c6b61965fe264c0fa8))

## 0.3.2 (2025-11-27)

### 🐛 Bug Fixes

- use bunx turbo in prepack for CI compatibility ([301fdec](https://github.com/SylphxAI/coderag/commit/301fdecf1d917fb90de96e15f870edbc2f4f7a1e))
- add prepack scripts with turbo for proper builds ([59fafd1](https://github.com/SylphxAI/coderag/commit/59fafd15ad3759d2ceaeee2a207b8bb1dfa1601f))

## 0.3.1 (2025-11-27)

### 🐛 Bug Fixes

- remove prepack scripts - let bump handle builds ([cfeebc7](https://github.com/SylphxAI/coderag/commit/cfeebc78d09903d8a920c002ad00c4177f45e537))
- **mcp-server:** revert to workspace:* for co-release with core ([1b3f62b](https://github.com/SylphxAI/coderag/commit/1b3f62b71d911171bb22922887743162b2a075ee))
- **mcp-server:** build core package before mcp-server in prepack ([7ea0c64](https://github.com/SylphxAI/coderag/commit/7ea0c64a16a41ca35a010f0d73911bb5791d2326))
- **mcp-server:** use workspace:^ for @sylphx/coderag dependency ([cb73c7b](https://github.com/SylphxAI/coderag/commit/cb73c7baeb682e856c3463f05a25f7bdb5836b9e))
- **mcp-server:** require @sylphx/coderag@^0.1.3 for LanceDB support (#5) ([2983c4e](https://github.com/SylphxAI/coderag/commit/2983c4e0d039359d13ba59d7777a22eec25cdda6))

## 0.3.0 (2025-11-27)

### ✨ Features

- **mcp-server:** add exports field and tests to reach 98% health ([bb4b7cb](https://github.com/SylphxAI/coderag/commit/bb4b7cb02a3e0ece0ac738cb9a3c63752be3a863))

### ♻️ Refactoring

- **mcp-server:** migrate to @sylphx/mcp-server-sdk ([a2183b2](https://github.com/SylphxAI/coderag/commit/a2183b20467f0a1123e0995d1df1c6f6b39b4414))

### 📚 Documentation

- **mcp:** add multi-tool setup instructions ([7516082](https://github.com/SylphxAI/coderag/commit/75160826409235677de297a54432dcf4245b98c0))
- update all READMEs with current package names and features ([fe7b08f](https://github.com/SylphxAI/coderag/commit/fe7b08fc0cccf482e38a1840aa929ad24219883a))

### 💅 Styles

- apply biome formatting to package.json ([cde2403](https://github.com/SylphxAI/coderag/commit/cde24033e02b1e800521f83de94eef44e3f37fe7))

### 🔧 Chores

- **deps:** update @sylphx/mcp-server-sdk to 1.1.1 ([0ca6dd7](https://github.com/SylphxAI/coderag/commit/0ca6dd7ff027f332a16a36a4fb935f6e19427f51))
- **deps:** update @sylphx/mcp-server-sdk to 0.2.1 ([517ab4a](https://github.com/SylphxAI/coderag/commit/517ab4a7d806d4c05df7ab1875ee18672562ae21))
- update @sylphx/biome-config to 0.4.0 and add extends ([ba5e30f](https://github.com/SylphxAI/coderag/commit/ba5e30f9b2862a559ec350c8e5e80f98e6ca8112))
- add prepack scripts to build before publish ([79ca05f](https://github.com/SylphxAI/coderag/commit/79ca05fb4b20aebd9c4ccc4610fd3a468de0cb13))
- update biome config and apply formatting ([467acdb](https://github.com/SylphxAI/coderag/commit/467acdb8c6c4f5b18e39147f05fde70317b1e64d))
- remove banned dependencies and add prepublishOnly script ([ce6a23a](https://github.com/SylphxAI/coderag/commit/ce6a23a35203f18b4b3e8d635a71845b1af98efa))

## 0.2.0 (2025-11-27)

### ✨ Features

- **mcp-server:** add exports field and tests to reach 98% health ([bb4b7cb](https://github.com/SylphxAI/coderag/commit/bb4b7cb02a3e0ece0ac738cb9a3c63752be3a863))

### ♻️ Refactoring

- **mcp-server:** migrate to @sylphx/mcp-server-sdk ([a2183b2](https://github.com/SylphxAI/coderag/commit/a2183b20467f0a1123e0995d1df1c6f6b39b4414))

### 🔧 Chores

- update biome config and apply formatting ([467acdb](https://github.com/SylphxAI/coderag/commit/467acdb8c6c4f5b18e39147f05fde70317b1e64d))
- remove banned dependencies and add prepublishOnly script ([ce6a23a](https://github.com/SylphxAI/coderag/commit/ce6a23a35203f18b4b3e8d635a71845b1af98efa))

## 0.1.0

### Minor Changes

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

### Patch Changes

- Updated dependencies [bff0e19]
- Updated dependencies [0e8e81a]
  - @sylphx/coderag@0.1.0

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

### Patch Changes

- Updated dependencies [c67a1ff]
  - @sylphx/coderag@0.2.0
