# MCP Server Overview

## What is the Model Context Protocol?

The Model Context Protocol (MCP) is an open standard for connecting AI assistants to external tools and data sources. It enables AI applications like Claude Desktop, Cursor, and VS Code to access custom functionality through a standardized interface.

MCP uses a client-server architecture where:
- **MCP Clients** are AI applications (Claude Desktop, Cursor, etc.)
- **MCP Servers** provide tools and data to the client
- **Tools** are functions the AI can invoke to accomplish tasks

## What is CodeRAG MCP?

CodeRAG MCP (`@sylphx/coderag-mcp`) is an MCP server that provides intelligent codebase search capabilities to AI assistants. It enables AI to search and understand your codebase using hybrid TF-IDF and optional vector embeddings.

**Key Benefits:**

- **Zero Dependencies**: No Docker, no databases, no external services required
- **Fast**: <50ms search latency, instant startup with cached index
- **Offline**: Works entirely offline (except optional vector search)
- **Smart**: Hybrid TF-IDF + optional OpenAI embeddings for semantic understanding
- **Automatic**: Auto-indexes on startup, watches for file changes

## How CodeRAG MCP Works

CodeRAG MCP runs as a background process that your AI assistant communicates with via standard input/output. When you ask the AI to search your codebase, it calls the MCP server, which performs the search and returns relevant code snippets.

**Architecture:**

```
┌─────────────────┐
│  AI Assistant   │  (Claude Desktop, Cursor, etc.)
│  (MCP Client)   │
└────────┬────────┘
         │ MCP Protocol (stdio)
         │
┌────────▼────────┐
│   CodeRAG MCP   │  Provides codebase_search tool
│   MCP Server    │
└────────┬────────┘
         │
┌────────▼────────┐
│   .coderag/     │  SQLite index cache
│   index.db      │
└─────────────────┘
```

**Workflow:**

1. **Startup**: Server indexes your codebase on first run (1000-2000 files/sec)
2. **Caching**: Index stored in `.coderag/` folder for instant subsequent startups
3. **Watching**: Automatically detects file changes and updates index incrementally
4. **Search**: AI calls `codebase_search` tool with natural language or keyword queries
5. **Results**: Server returns ranked code snippets in LLM-optimized markdown format

## Available Tool: codebase_search

CodeRAG MCP provides a single tool: `codebase_search`

**Search Modes:**

1. **Keyword Search** (default): TF-IDF ranking with code-aware tokenization
   - Use specific terms, function names, error messages
   - Example: "getUserById authentication"

2. **Semantic Search** (with OPENAI_API_KEY): AI embeddings + TF-IDF fusion
   - Use natural language descriptions
   - Example: "code that handles user login with JWT tokens"

**Key Features:**

- **Fast Ranking**: Hybrid TF-IDF with StarCoder2 tokenizer (4.7MB, trained on code)
- **Smart Filtering**: Filter by file extension, path pattern, or exclude paths
- **Context-Aware**: Returns code snippets with line numbers and syntax highlighting
- **AST Chunking**: Splits code at semantic boundaries (functions, classes, etc.)
- **LLM-Optimized Output**: Minimal token usage, maximum content density

## Use Cases with AI Assistants

**Before Implementation:**

```
Human: "Add JWT authentication to the API"
AI: Uses codebase_search("authentication JWT") to find existing auth patterns
AI: Implements new feature following existing patterns
```

**Code Understanding:**

```
Human: "How does error handling work in this project?"
AI: Uses codebase_search("error handling try catch") to find examples
AI: Explains the error handling patterns used
```

**Debugging:**

```
Human: "Why is the database connection failing?"
AI: Uses codebase_search("database connection retry") to find relevant code
AI: Identifies issue and suggests fix
```

**Refactoring:**

```
Human: "Extract common validation logic into a utility"
AI: Uses codebase_search("validation schema") to find all validation code
AI: Creates utility and updates references
```

## Performance Characteristics

| Metric | Value |
|--------|-------|
| Initial indexing | 1000-2000 files/sec |
| Startup with cache | <100ms |
| Search latency | <50ms |
| Memory per 1000 files | ~1-2 MB |
| Tokenizer size | 4.7MB (StarCoder2) |

## Supported Languages

AST-based chunking with semantic boundary detection:

| Category | Languages |
|----------|-----------|
| **JavaScript** | JavaScript, TypeScript, JSX, TSX |
| **Systems** | Python, Go, Java, C, Rust |
| **Markup** | Markdown, HTML, XML |
| **Data/Config** | JSON, YAML, TOML, INI |
| **Other** | Protobuf |

**Embedded Code Support**: Automatically parses code blocks in Markdown files and `<script>`/`<style>` tags in HTML.

## Next Steps

- [Installation Guide](./installation.md) - Install and run CodeRAG MCP
- [Configuration Guide](./configuration.md) - Configure for your AI assistant
- [Tools Reference](./tools.md) - Detailed tool documentation
- [IDE Integration](./ide-integration.md) - Setup for specific IDEs
