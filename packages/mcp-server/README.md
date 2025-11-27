# @sylphx/coderag-mcp

MCP server for intelligent codebase search - integrates with Claude Desktop.

## Installation

```bash
bun add -g @sylphx/coderag-mcp
```

## Claude Desktop Setup

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "coderag": {
      "command": "coderag-mcp",
      "args": ["--root=/path/to/project"]
    }
  }
}
```

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `--root=<path>` | Current directory | Codebase root path |
| `--max-size=<bytes>` | 1048576 (1MB) | Max file size to index |
| `--no-auto-index` | false | Disable auto-indexing on startup |

## MCP Tool: `codebase_search`

Search project source files with TF-IDF ranking.

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | Yes | - | Search query |
| `limit` | number | No | 10 | Max results |
| `include_content` | boolean | No | true | Include code snippets |
| `file_extensions` | string[] | No | - | Filter by extension |
| `path_filter` | string | No | - | Filter by path |
| `exclude_paths` | string[] | No | - | Exclude paths |

### Example

```json
{
  "query": "authentication",
  "limit": 5,
  "file_extensions": [".ts", ".tsx"],
  "exclude_paths": ["node_modules", "dist"]
}
```

### Response

```markdown
# 🔍 Codebase Search Results

**Query:** "authentication"
**Results:** 3 / 500 files

## 1. `src/auth/login.ts`

- **Score:** 0.87
- **Language:** TypeScript
- **Matched Terms:** authentication, login, user

**Snippet:**
```
15: export async function authenticate(credentials) {
16:   const user = await findUser(credentials.email)
```
```

## Usage Tips

**Good queries:**
- `user authentication login`
- `database connection`
- `React form validation`

**Less effective:**
- Single common words like `function`, `const`
- Very long sentences

## Performance

| Metric | Value |
|--------|-------|
| Startup | 1-5 seconds |
| Search | <50ms |
| Memory | ~1-2 MB per 1000 files |

## Development

```bash
git clone https://github.com/SylphxAI/coderag.git
cd coderag

bun install
bun run build

# Run locally
cd packages/mcp-server
bun run dev
```

## License

MIT

---

**Powered by [Sylphx](https://github.com/SylphxAI)**

Built with [@sylphx/coderag](https://github.com/SylphxAI/coderag) · [@sylphx/mcp-server-sdk](https://github.com/SylphxAI/mcp-server-sdk)
