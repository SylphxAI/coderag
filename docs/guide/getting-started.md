# Getting Started

## What is Codebase Search?

Codebase Search is an intelligent code search library that combines the precision of TF-IDF keyword search with the semantic understanding of vector embeddings. It's designed to be fast, extensible, and easy to integrate into your development workflow.

## Key Features

### 🔍 Hybrid Search Engine

Combines two complementary search strategies:

- **TF-IDF (Keyword)**: Fast, precise matching for exact terms
- **Vector (Semantic)**: Understanding meaning and context
- **Hybrid**: Weighted combination for best results

### ⚡ High Performance

- **2.7x faster** initial indexing
- **166x faster** incremental updates
- **100x faster** cached queries

### 🎯 Code-Aware Tokenization

Uses StarCoder2 tokenization to properly handle:
- camelCase identifiers
- snake_case naming
- Code-specific patterns

### 🔌 Extensible Architecture

- Registry pattern for custom embedding providers
- Support for OpenAI, OpenRouter, Together AI, Fireworks AI, Ollama
- Mock provider for testing

### 📦 Batteries Included

- MCP server for AI assistant integration
- Persistent storage with SQLite
- Automatic incremental updates
- Query caching

## Installation

See the [Installation Guide](./installation.md) for detailed setup instructions.

## Quick Start

See the [Quick Start Guide](./quick-start.md) to get up and running in 5 minutes.

## Architecture Overview

```
┌─────────────────────────────────────────┐
│         Hybrid Search Engine            │
├─────────────────┬───────────────────────┤
│   TF-IDF        │   Vector Search       │
│   (Keyword)     │   (Semantic)          │
├─────────────────┴───────────────────────┤
│         Code Tokenization               │
│         (StarCoder2)                    │
├─────────────────────────────────────────┤
│      Persistent Storage (SQLite)        │
└─────────────────────────────────────────┘
```

## Next Steps

- [Installation](./installation.md) - Install and configure
- [Quick Start](./quick-start.md) - Build your first search index
- [TF-IDF Search](./tfidf.md) - Learn keyword search
- [Vector Search](./vector-search.md) - Learn semantic search
- [Hybrid Search](./hybrid-search.md) - Combine both strategies
