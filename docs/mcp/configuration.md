# Configuration Guide

This guide covers how to configure CodeRAG MCP for different AI assistants and use cases.

## Claude Desktop Configuration

Claude Desktop is Anthropic's official desktop application for Claude AI.

### Configuration File Location

**macOS:**
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Windows:**
```
%APPDATA%\Claude\claude_desktop_config.json
```

**Linux:**
```
~/.config/Claude/claude_desktop_config.json
```

### Basic Configuration

Edit `claude_desktop_config.json`:

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

Replace `/path/to/project` with your project's absolute path.

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

### Advanced Configuration

```json
{
  "mcpServers": {
    "coderag": {
      "command": "npx",
      "args": [
        "-y",
        "@sylphx/coderag-mcp",
        "--root=/path/to/project",
        "--max-size=2097152"
      ],
      "env": {
        "OPENAI_API_KEY": "sk-...",
        "EMBEDDING_MODEL": "text-embedding-3-large"
      }
    }
  }
}
```

### Applying Changes

1. Save `claude_desktop_config.json`
2. Quit Claude Desktop completely
3. Restart Claude Desktop
4. Server starts automatically on first tool use

## Cursor Configuration

Cursor is an AI-powered code editor built on VS Code.

### Configuration File Location

**macOS:**
```
~/.cursor/mcp.json
```

**Windows:**
```
%USERPROFILE%\.cursor\mcp.json
```

**Linux:**
```
~/.cursor/mcp.json
```

### Basic Configuration

Create or edit `~/.cursor/mcp.json`:

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

### Workspace-Relative Path

Use current workspace folder:

```json
{
  "mcpServers": {
    "coderag": {
      "command": "npx",
      "args": ["-y", "@sylphx/coderag-mcp", "--root=${workspaceFolder}"]
    }
  }
}
```

Note: `${workspaceFolder}` support depends on Cursor's MCP implementation. If unsupported, use absolute paths.

### Applying Changes

1. Save `mcp.json`
2. Restart Cursor
3. Server starts when MCP client initializes

## VS Code Configuration

VS Code supports MCP through extensions like Continue.

### Using Continue Extension

Install the [Continue extension](https://marketplace.visualstudio.com/items?itemName=Continue.continue) from VS Code Marketplace.

**Configuration File Location:**

**macOS/Linux:**
```
~/.continue/config.json
```

**Windows:**
```
%USERPROFILE%\.continue\config.json
```

Edit `config.json` to add MCP servers:

```json
{
  "mcpServers": {
    "coderag": {
      "command": "npx",
      "args": ["-y", "@sylphx/coderag-mcp", "--root=${workspaceFolder}"]
    }
  }
}
```

### Workspace Configuration

Create `.vscode/mcp.json` in your project:

```json
{
  "mcp": {
    "servers": {
      "coderag": {
        "command": "npx",
        "args": ["-y", "@sylphx/coderag-mcp", "--root=${workspaceFolder}"]
      }
    }
  }
}
```

This configuration is project-specific and checked into version control.

### Applying Changes

1. Save configuration file
2. Reload VS Code window (Cmd/Ctrl+R)
3. Continue extension loads MCP servers automatically

## Windsurf Configuration

Windsurf is an AI-powered development environment.

### Configuration File Location

**macOS:**
```
~/.codeium/windsurf/mcp_config.json
```

**Windows:**
```
%USERPROFILE%\.codeium\windsurf\mcp_config.json
```

**Linux:**
```
~/.codeium/windsurf/mcp_config.json
```

### Basic Configuration

Create or edit `mcp_config.json`:

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

### Applying Changes

1. Save `mcp_config.json`
2. Restart Windsurf
3. Server initializes on startup

## Multiple Project Setup

Configure multiple CodeRAG instances for different projects.

### Separate Servers per Project

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
    },
    "coderag-mobile": {
      "command": "npx",
      "args": ["-y", "@sylphx/coderag-mcp", "--root=/path/to/mobile"]
    }
  }
}
```

**Benefits:**
- Separate indexes for faster search
- Different configurations per project
- AI can specify which project to search

**Usage:**
```
Human: "Search the frontend codebase for authentication components"
AI: Uses coderag-frontend server
```

### Monorepo Configuration

For monorepos, index the entire repository:

```json
{
  "mcpServers": {
    "coderag-monorepo": {
      "command": "npx",
      "args": ["-y", "@sylphx/coderag-mcp", "--root=/path/to/monorepo"]
    }
  }
}
```

Use path filters in search queries:

```json
{
  "query": "authentication",
  "path_filter": "packages/frontend"
}
```

## Environment-Specific Configuration

### Development Environment

```json
{
  "mcpServers": {
    "coderag": {
      "command": "npx",
      "args": ["-y", "@sylphx/coderag-mcp", "--root=/path/to/project"],
      "env": {
        "OPENAI_API_KEY": "sk-dev-key"
      }
    }
  }
}
```

### Production Environment

```json
{
  "mcpServers": {
    "coderag": {
      "command": "/usr/local/bin/coderag-mcp",
      "args": [
        "--root=/var/www/project",
        "--max-size=5242880",
        "--no-auto-index"
      ],
      "env": {
        "OPENAI_API_KEY": "sk-prod-key",
        "EMBEDDING_MODEL": "text-embedding-3-large"
      }
    }
  }
}
```

## Custom Embedding Providers

### OpenRouter

```json
{
  "mcpServers": {
    "coderag": {
      "command": "npx",
      "args": ["-y", "@sylphx/coderag-mcp", "--root=/path/to/project"],
      "env": {
        "OPENAI_API_KEY": "sk-or-v1-...",
        "OPENAI_BASE_URL": "https://openrouter.ai/api/v1"
      }
    }
  }
}
```

### Together AI

```json
{
  "mcpServers": {
    "coderag": {
      "command": "npx",
      "args": ["-y", "@sylphx/coderag-mcp", "--root=/path/to/project"],
      "env": {
        "OPENAI_API_KEY": "your-together-api-key",
        "OPENAI_BASE_URL": "https://api.together.xyz/v1",
        "EMBEDDING_MODEL": "togethercomputer/m2-bert-80M-8k-retrieval",
        "EMBEDDING_DIMENSIONS": "768"
      }
    }
  }
}
```

### Azure OpenAI

```json
{
  "mcpServers": {
    "coderag": {
      "command": "npx",
      "args": ["-y", "@sylphx/coderag-mcp", "--root=/path/to/project"],
      "env": {
        "OPENAI_API_KEY": "your-azure-key",
        "OPENAI_BASE_URL": "https://your-resource.openai.azure.com/openai/deployments/your-deployment",
        "EMBEDDING_MODEL": "text-embedding-3-small"
      }
    }
  }
}
```

## Performance Tuning

### Large Codebases

For projects with 10,000+ files:

```json
{
  "mcpServers": {
    "coderag": {
      "command": "npx",
      "args": [
        "-y",
        "@sylphx/coderag-mcp",
        "--root=/path/to/large-project",
        "--max-size=524288"
      ]
    }
  }
}
```

**Tips:**
- Reduce `--max-size` to skip large generated files
- Exclude build directories (handled automatically)
- First indexing takes longer, subsequent startups are fast (<100ms)

### Resource-Constrained Environments

For limited memory or CPU:

```json
{
  "mcpServers": {
    "coderag": {
      "command": "npx",
      "args": [
        "-y",
        "@sylphx/coderag-mcp",
        "--root=/path/to/project",
        "--max-size=262144"
      ]
    }
  }
}
```

**Settings:**
- Lower `--max-size` (256 KB)
- Use keyword search only (no OPENAI_API_KEY)
- Index is stored in SQLite for low memory usage

## Configuration Validation

### Check Configuration Syntax

Ensure your JSON configuration is valid:

```bash
# macOS/Linux
cat ~/Library/Application\ Support/Claude/claude_desktop_config.json | python -m json.tool

# Windows PowerShell
Get-Content $env:APPDATA\Claude\claude_desktop_config.json | ConvertFrom-Json
```

### Test Server Manually

Test CodeRAG MCP outside of your AI assistant:

```bash
npx @sylphx/coderag-mcp --root=/path/to/project
```

You should see:
```
[INFO] Starting MCP Codebase Search Server...
[INFO] Codebase root: /path/to/project
[INFO] Max file size: 1.00 MB
[INFO] Auto-index: enabled
[SUCCESS] Indexed 1234 files
[INFO] Watching for file changes...
```

Press Ctrl+C to stop.

## Troubleshooting

**Configuration not loading:**
- Verify JSON syntax (no trailing commas, proper quotes)
- Check file path is correct for your OS
- Restart AI assistant after changes

**Server not starting:**
- Test command manually in terminal
- Check Node.js is installed (`node --version`)
- Verify `--root` path exists

**Multiple servers conflict:**
- Give each server a unique name
- Ensure different `--root` paths
- Check logs for port conflicts

## Next Steps

- [Tools Reference](./tools.md) - Learn about codebase_search parameters
- [IDE Integration](./ide-integration.md) - Detailed setup for specific IDEs
- [Installation Guide](./installation.md) - CLI arguments and environment variables
