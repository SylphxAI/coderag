# @sylphx/coderag-mcp-darwin-x64

## 0.4.1

### Patch Changes

- 3695510: Ship multi-arch native MCP binaries via optionalDependencies platform packages (darwin-arm64, darwin-x64, linux-x64-gnu, linux-arm64-gnu). Arch-aware bin wrapper fails closed on wrong-arch or missing native; no TS fallback.
