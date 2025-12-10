# IDE Integration Guide

This guide provides step-by-step setup instructions for using CodeRAG MCP with different AI-powered development tools.

## Claude Desktop

Claude Desktop is Anthropic's official desktop application for Claude AI.

### Prerequisites

- Claude Desktop installed ([download here](https://claude.ai/download))
- Node.js installed (v16 or later)

### Setup Steps

1. **Locate Configuration File**

   **macOS:**
   ```bash
   open ~/Library/Application\ Support/Claude/
   ```

   **Windows:**
   ```powershell
   explorer %APPDATA%\Claude
   ```

   **Linux:**
   ```bash
   cd ~/.config/Claude/
   ```

2. **Edit claude_desktop_config.json**

   Create or edit `claude_desktop_config.json`:

   ```json
   {
     "mcpServers": {
       "coderag": {
         "command": "npx",
         "args": ["-y", "@sylphx/coderag-mcp", "--root=/path/to/your/project"]
       }
     }
   }
   ```

   Replace `/path/to/your/project` with your project's absolute path.

3. **Restart Claude Desktop**

   Quit Claude Desktop completely and restart it.

4. **Verify Setup**

   In Claude Desktop, ask: "Search the codebase for authentication"

   Claude should use the `codebase_search` tool and return results.

### Enable Semantic Search

Add your OpenAI API key to enable natural language queries:

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

Configure multiple CodeRAG instances:

```json
{
  "mcpServers": {
    "frontend": {
      "command": "npx",
      "args": ["-y", "@sylphx/coderag-mcp", "--root=/path/to/frontend"]
    },
    "backend": {
      "command": "npx",
      "args": ["-y", "@sylphx/coderag-mcp", "--root=/path/to/backend"]
    }
  }
}
```

Tell Claude which project to search:
```
"Search the frontend codebase for authentication components"
```

### Troubleshooting

**Server doesn't start:**
- Check logs: `~/Library/Logs/Claude/mcp*.log` (macOS)
- Verify Node.js is installed: `node --version`
- Test manually: `npx @sylphx/coderag-mcp --root=/path/to/project`

**No results returned:**
- Wait for initial indexing (check logs)
- Verify project path exists
- Try a broader search query

## Cursor

Cursor is an AI-powered code editor built on VS Code.

### Prerequisites

- Cursor installed ([download here](https://cursor.sh))
- Node.js installed (v16 or later)

### Setup Steps

1. **Locate Configuration File**

   **macOS:**
   ```bash
   mkdir -p ~/.cursor
   touch ~/.cursor/mcp.json
   ```

   **Windows:**
   ```powershell
   New-Item -Path "$env:USERPROFILE\.cursor" -ItemType Directory -Force
   New-Item -Path "$env:USERPROFILE\.cursor\mcp.json" -ItemType File
   ```

   **Linux:**
   ```bash
   mkdir -p ~/.cursor
   touch ~/.cursor/mcp.json
   ```

2. **Edit mcp.json**

   Add CodeRAG MCP configuration:

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

3. **Restart Cursor**

   Close and reopen Cursor.

4. **Verify Setup**

   Ask Cursor's AI: "Search the codebase for authentication"

   The AI should invoke the `codebase_search` tool.

### Per-Workspace Configuration

Create `.cursor/mcp.json` in your project root:

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

**Benefits:**
- Configuration travels with project
- Team members get same setup
- No hardcoded paths

**Note:** `${workspaceFolder}` support depends on Cursor's MCP implementation. If unsupported, use relative paths or absolute paths.

### Troubleshooting

**MCP servers not loading:**
- Verify JSON syntax (use a JSON validator)
- Check Cursor's developer console for errors
- Ensure Node.js is in PATH

**Slow startup:**
- First run indexes the codebase (may take time)
- Subsequent startups are fast (<100ms)

## VS Code with Continue

VS Code supports MCP through the Continue extension.

### Prerequisites

- VS Code installed
- [Continue extension](https://marketplace.visualstudio.com/items?itemName=Continue.continue) installed
- Node.js installed (v16 or later)

### Setup Steps

1. **Install Continue Extension**

   In VS Code:
   - Open Extensions (Cmd/Ctrl+Shift+X)
   - Search for "Continue"
   - Click Install

2. **Locate Configuration File**

   **macOS/Linux:**
   ```bash
   mkdir -p ~/.continue
   ```

   **Windows:**
   ```powershell
   New-Item -Path "$env:USERPROFILE\.continue" -ItemType Directory -Force
   ```

3. **Edit Continue Config**

   Open `~/.continue/config.json` (create if doesn't exist):

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

4. **Reload VS Code**

   Press Cmd/Ctrl+R to reload the window.

5. **Verify Setup**

   Open Continue chat panel and ask: "Search the codebase for authentication"

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

This allows project-specific MCP configuration.

### Troubleshooting

**Continue doesn't see MCP servers:**
- Verify extension is installed and enabled
- Check `~/.continue/config.json` syntax
- Reload VS Code window

**Server fails to start:**
- Test command manually in terminal
- Check Continue output panel for errors
- Ensure `--root` path exists

## Windsurf

Windsurf is an AI-powered development environment by Codeium.

### Prerequisites

- Windsurf installed ([download here](https://codeium.com/windsurf))
- Node.js installed (v16 or later)

### Setup Steps

1. **Locate Configuration File**

   **macOS:**
   ```bash
   mkdir -p ~/.codeium/windsurf
   touch ~/.codeium/windsurf/mcp_config.json
   ```

   **Windows:**
   ```powershell
   New-Item -Path "$env:USERPROFILE\.codeium\windsurf" -ItemType Directory -Force
   New-Item -Path "$env:USERPROFILE\.codeium\windsurf\mcp_config.json" -ItemType File
   ```

   **Linux:**
   ```bash
   mkdir -p ~/.codeium/windsurf
   touch ~/.codeium/windsurf/mcp_config.json
   ```

2. **Edit mcp_config.json**

   Add CodeRAG configuration:

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

3. **Restart Windsurf**

   Close and reopen Windsurf.

4. **Verify Setup**

   Ask Windsurf AI: "Search the codebase for authentication"

### Workspace-Specific Configuration

For project-specific setup, adjust the `--root` path:

```json
{
  "mcpServers": {
    "coderag-project1": {
      "command": "npx",
      "args": ["-y", "@sylphx/coderag-mcp", "--root=/path/to/project1"]
    },
    "coderag-project2": {
      "command": "npx",
      "args": ["-y", "@sylphx/coderag-mcp", "--root=/path/to/project2"]
    }
  }
}
```

### Troubleshooting

**Server not visible:**
- Check `mcp_config.json` syntax
- Verify directory structure
- Restart Windsurf

**Indexing takes too long:**
- Reduce `--max-size`: `"--max-size=524288"` (512KB)
- Check for large generated files
- Monitor logs for progress

## Claude Code

Claude Code is Anthropic's CLI tool for Claude AI.

### Prerequisites

- Claude Code CLI installed
- Node.js installed (v16 or later)

### Setup Steps

1. **Add MCP Server**

   ```bash
   claude mcp add coderag -- npx -y @sylphx/coderag-mcp --root=/path/to/project
   ```

2. **Verify Configuration**

   ```bash
   claude mcp list
   ```

   Should show `coderag` server.

3. **Test Search**

   ```bash
   claude chat "Search the codebase for authentication"
   ```

### Update Server

```bash
claude mcp remove coderag
claude mcp add coderag -- npx -y @sylphx/coderag-mcp --root=/path/to/project
```

### Troubleshooting

**Server not found:**
- Run `claude mcp list` to verify
- Check `~/.config/claude/mcp.json` (macOS/Linux) or `%APPDATA%\Claude\mcp.json` (Windows)

## Other MCP Clients

CodeRAG MCP works with any MCP-compatible client. General setup pattern:

### Generic MCP Configuration

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

### Known Compatible Clients

- **Claude Desktop** - Official Anthropic client
- **Cursor** - AI code editor
- **Continue** - VS Code extension
- **Windsurf** - Codeium IDE
- **Claude Code** - CLI tool
- **Zed** - Modern code editor (MCP support coming)
- **Custom MCP Clients** - Any client implementing MCP protocol

### Integration Steps

1. Locate client's MCP configuration file (usually `~/.client-name/mcp.json`)
2. Add CodeRAG server entry
3. Restart client
4. Test with codebase search query

## Advanced Integration Patterns

### Dynamic Project Selection

Configure multiple projects and let AI choose:

```json
{
  "mcpServers": {
    "web-frontend": {
      "command": "npx",
      "args": ["-y", "@sylphx/coderag-mcp", "--root=/projects/web-frontend"]
    },
    "web-backend": {
      "command": "npx",
      "args": ["-y", "@sylphx/coderag-mcp", "--root=/projects/web-backend"]
    },
    "mobile-app": {
      "command": "npx",
      "args": ["-y", "@sylphx/coderag-mcp", "--root=/projects/mobile"]
    }
  }
}
```

Usage:
```
"Search the web-backend codebase for API authentication"
```

### Environment-Specific Configuration

Development and production environments:

```json
{
  "mcpServers": {
    "coderag-dev": {
      "command": "npx",
      "args": ["-y", "@sylphx/coderag-mcp", "--root=/dev/project"],
      "env": {
        "OPENAI_API_KEY": "sk-dev-..."
      }
    },
    "coderag-prod": {
      "command": "/usr/local/bin/coderag-mcp",
      "args": ["--root=/var/www/project", "--max-size=5242880"],
      "env": {
        "OPENAI_API_KEY": "sk-prod-..."
      }
    }
  }
}
```

### Monorepo Setup

Index entire monorepo with path filtering:

```json
{
  "mcpServers": {
    "monorepo": {
      "command": "npx",
      "args": ["-y", "@sylphx/coderag-mcp", "--root=/path/to/monorepo"]
    }
  }
}
```

Use path filters in queries:
```json
{
  "query": "authentication",
  "path_filter": "packages/backend"
}
```

## Performance Optimization

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
        "--max-size=262144"
      ]
    }
  }
}
```

**Settings:**
- `--max-size=262144` (256 KB) skips large files
- First indexing: 10-60 seconds
- Subsequent startups: <100ms
- Search: <50ms

### Resource-Constrained Environments

For limited memory/CPU:

```json
{
  "mcpServers": {
    "coderag": {
      "command": "npx",
      "args": [
        "-y",
        "@sylphx/coderag-mcp",
        "--root=/path/to/project",
        "--max-size=131072"
      ]
    }
  }
}
```

**Settings:**
- `--max-size=131072` (128 KB)
- No `OPENAI_API_KEY` (keyword search only)
- SQLite-based storage (low memory)

## Debugging Integration Issues

### Enable Detailed Logging

Most MCP clients log server output. Check these locations:

**Claude Desktop:**
- macOS: `~/Library/Logs/Claude/`
- Windows: `%APPDATA%\Claude\logs\`
- Linux: `~/.config/Claude/logs/`

**Cursor:**
- Developer Tools → Console
- Look for MCP-related messages

**VS Code (Continue):**
- Output panel → Continue
- Check for server startup errors

### Test Server Manually

Run CodeRAG MCP outside the client:

```bash
npx @sylphx/coderag-mcp --root=/path/to/project
```

Expected output:
```
[INFO] Starting MCP Codebase Search Server...
[INFO] Codebase root: /path/to/project
[SUCCESS] Indexed 1234 files
```

If this works but integration doesn't, the issue is with client configuration.

### Common Issues

**Server starts but no results:**
- Wait for indexing to complete
- Check logs for indexing progress
- Verify files exist in `--root` path

**JSON syntax errors:**
- Use JSON validator
- Check for trailing commas
- Ensure proper quote escaping

**Command not found:**
- Verify Node.js is in PATH
- Try absolute path: `/usr/local/bin/node`
- Use global install: `npm install -g @sylphx/coderag-mcp`

## Best Practices

### Configuration Management

**Use Version Control:**
- Check in `.vscode/mcp.json` or `.cursor/mcp.json`
- Team members get automatic setup
- Use `${workspaceFolder}` for portability

**Document Setup:**
- Add MCP setup to project README
- Include example queries
- Note required environment variables

### Query Patterns

**Proactive Search:**
```
"Before implementing authentication, search for existing auth patterns"
```

**Exploratory Search:**
```
"Show me how error handling is done in this codebase"
```

**Targeted Search:**
```
"Find all API routes that handle user creation"
```

### Security Considerations

**API Keys:**
- Never commit API keys to version control
- Use environment variables
- Rotate keys regularly

**Sensitive Code:**
- Use `exclude_paths` for sensitive directories
- Consider separate indexes for public/private code
- Review search results before sharing

## Next Steps

- [Tools Reference](./tools.md) - Learn all codebase_search parameters
- [Configuration Guide](./configuration.md) - Advanced configuration options
- [Installation Guide](./installation.md) - CLI arguments and environment variables
