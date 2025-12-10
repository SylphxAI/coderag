# Installation Guide

## Quick Start with npx

The fastest way to run CodeRAG MCP is using `npx`:

```bash
npx @sylphx/coderag-mcp --root=/path/to/your/project
```

This command:
- Downloads and runs the latest version
- Indexes the specified codebase
- Starts the MCP server
- Watches for file changes

**When to use npx:**
- Quick testing or one-time use
- Always want the latest version
- Don't want to install globally

## Global Installation

Install CodeRAG MCP globally for faster startup:

```bash
npm install -g @sylphx/coderag-mcp
```

Then run:

```bash
coderag-mcp --root=/path/to/your/project
```

**When to use global install:**
- Faster startup (no download on each run)
- Stable version for production use
- Multiple projects on the same machine

## CLI Arguments

### `--root=<path>`

Specify the codebase root directory to index.

```bash
npx @sylphx/coderag-mcp --root=/Users/you/projects/my-app
```

**Default:** Current working directory

**Notes:**
- Path can be absolute or relative
- Directory must exist and be readable
- Creates `.coderag/` folder inside this directory

### `--max-size=<bytes>`

Maximum file size to index (in bytes).

```bash
npx @sylphx/coderag-mcp --root=/path/to/project --max-size=2097152
```

**Default:** `1048576` (1 MB)

**Common Values:**
- 512 KB: `--max-size=524288`
- 1 MB: `--max-size=1048576` (default)
- 2 MB: `--max-size=2097152`
- 5 MB: `--max-size=5242880`

**When to adjust:**
- Increase for codebases with large auto-generated files
- Decrease for faster indexing on resource-constrained machines
- Files larger than this limit are skipped during indexing

### --no-auto-index

Disable automatic indexing on startup.

```bash
npx @sylphx/coderag-mcp --root=/path/to/project --no-auto-index
```

**Default:** Auto-indexing enabled

**When to use:**
- Manual control over indexing timing
- Testing server functionality without indexing
- Very large codebases where indexing takes time

**Note:** You must manually trigger indexing by calling the `codebase_search` tool, which will index on first search.

## Environment Variables

CodeRAG MCP supports environment variables for configuration.

### OPENAI_API_KEY

Enable semantic search with OpenAI embeddings.

```bash
export OPENAI_API_KEY=sk-...
npx @sylphx/coderag-mcp --root=/path/to/project
```

**Effect:**
- Switches from keyword search to semantic search mode
- Uses `text-embedding-3-small` by default
- Enables natural language queries

**Without this variable:**
- Uses keyword-only search (TF-IDF)
- Still very effective for code search
- No external API calls

### OPENAI_BASE_URL

Use OpenAI-compatible embedding endpoints (OpenRouter, Together AI, etc.).

```bash
export OPENAI_API_KEY=your-api-key
export OPENAI_BASE_URL=https://openrouter.ai/api/v1
npx @sylphx/coderag-mcp --root=/path/to/project
```

**Use Cases:**
- OpenRouter for multi-provider access
- Together AI for faster/cheaper embeddings
- Local embedding servers (e.g., text-embeddings-inference)
- Azure OpenAI endpoints

### EMBEDDING_MODEL

Specify custom embedding model.

```bash
export OPENAI_API_KEY=sk-...
export EMBEDDING_MODEL=text-embedding-3-large
npx @sylphx/coderag-mcp --root=/path/to/project
```

**Default:** `text-embedding-3-small`

**Supported OpenAI Models:**
- `text-embedding-3-small` (1536 dims, default)
- `text-embedding-3-large` (3072 dims, higher quality)
- `text-embedding-ada-002` (1536 dims, legacy)

**Custom Models:**
- Specify any model name for OpenAI-compatible endpoints
- Must also set `EMBEDDING_DIMENSIONS` for custom models

### EMBEDDING_DIMENSIONS

Override embedding dimensions for custom models.

```bash
export OPENAI_API_KEY=your-key
export OPENAI_BASE_URL=https://api.together.xyz/v1
export EMBEDDING_MODEL=togethercomputer/m2-bert-80M-8k-retrieval
export EMBEDDING_DIMENSIONS=768
npx @sylphx/coderag-mcp --root=/path/to/project
```

**When to use:**
- Custom embedding models with non-standard dimensions
- Automatically detected for standard OpenAI models

## MCP Configuration Examples

### Basic Setup (Keyword Search)

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

### With Semantic Search

```json
{
  "mcpServers": {
    "coderag": {
      "command": "npx",
      "args": ["-y", "@sylphx/coderag-mcp", "--root=/path/to/project"],
      "env": {
        "OPENAI_API_KEY": "sk-..."
      }
    }
  }
}
```

### Multiple Projects

```json
{
  "mcpServers": {
    "coderag-frontend": {
      "command": "npx",
      "args": ["-y", "@sylphx/coderag-mcp", "--root=/path/to/frontend"]
    },
    "coderag-backend": {
      "command": "npx",
      "args": ["-y", "@sylphx/coderag-mcp", "--root=/path/to/backend"]
    }
  }
}
```

### Custom Settings

```json
{
  "mcpServers": {
    "coderag": {
      "command": "npx",
      "args": [
        "-y",
        "@sylphx/coderag-mcp",
        "--root=/path/to/project",
        "--max-size=2097152",
        "--no-auto-index"
      ],
      "env": {
        "OPENAI_API_KEY": "sk-...",
        "EMBEDDING_MODEL": "text-embedding-3-large"
      }
    }
  }
}
```

## Verifying Installation

After adding CodeRAG MCP to your configuration:

1. **Restart your AI assistant** (Claude Desktop, Cursor, etc.)

2. **Check server logs:**
   - Claude Desktop: Check `~/Library/Logs/Claude/` (macOS) or `%APPDATA%\Claude\logs\` (Windows)
   - Cursor: Check console output in Developer Tools
   - Look for "Starting MCP Codebase Search Server" message

3. **Test search:**
   - Ask your AI: "Search the codebase for authentication"
   - AI should use the `codebase_search` tool
   - Results should appear in markdown format

## Troubleshooting

**Server doesn't start:**
- Check that Node.js is installed (`node --version`)
- Verify the `--root` path exists and is readable
- Check MCP config file syntax (valid JSON)

**Search returns no results:**
- Wait for initial indexing to complete (check logs)
- Verify files exist in the specified `--root` directory
- Check that file extensions are supported

**Semantic search not working:**
- Verify `OPENAI_API_KEY` is set correctly
- Check OpenAI API quota and permissions
- Look for "Semantic search enabled" in server logs

**Indexing is slow:**
- Reduce `--max-size` to skip large files
- Check for large auto-generated files (e.g., `dist/`, `build/`)
- Consider adding `.coderagignore` file (future feature)

## Next Steps

- [Configuration Guide](./configuration.md) - Configure for your AI assistant
- [Tools Reference](./tools.md) - Learn about the codebase_search tool
- [IDE Integration](./ide-integration.md) - Setup for specific IDEs
