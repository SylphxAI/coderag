---
"@sylphx/coderag-mcp": patch
"@sylphx/coderag-mcp-darwin-arm64": patch
"@sylphx/coderag-mcp-darwin-x64": patch
"@sylphx/coderag-mcp-linux-x64-gnu": patch
"@sylphx/coderag-mcp-linux-arm64-gnu": patch
---

Ship `coderag-cli` alongside `coderag-mcp-server` in multi-arch platform optionalDependency packages so clean npm install can complete `tools/call codebase_search` without a monorepo Rust build. cli_bridge resolves sibling CLI next to the MCP native binary.
