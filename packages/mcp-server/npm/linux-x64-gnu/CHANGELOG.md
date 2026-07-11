# @sylphx/coderag-mcp-linux-x64-gnu

## 0.4.2

### Patch Changes

- 1d37704: Ship `coderag-cli` alongside `coderag-mcp-server` in multi-arch platform optionalDependency packages so clean npm install can complete `tools/call codebase_search` without a monorepo Rust build. cli_bridge resolves sibling CLI next to the MCP native binary.

## 0.4.1

### Patch Changes

- 3695510: Ship multi-arch native MCP binaries via optionalDependencies platform packages (darwin-arm64, darwin-x64, linux-x64-gnu, linux-arm64-gnu). Arch-aware bin wrapper fails closed on wrong-arch or missing native; no TS fallback.
