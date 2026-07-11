---
"@sylphx/coderag-mcp": patch
"@sylphx/coderag-mcp-darwin-arm64": patch
"@sylphx/coderag-mcp-darwin-x64": patch
"@sylphx/coderag-mcp-linux-x64-gnu": patch
"@sylphx/coderag-mcp-linux-arm64-gnu": patch
---

Ship multi-arch native MCP binaries via optionalDependencies platform packages (darwin-arm64, darwin-x64, linux-x64-gnu, linux-arm64-gnu). Arch-aware bin wrapper fails closed on wrong-arch or missing native; no TS fallback.
