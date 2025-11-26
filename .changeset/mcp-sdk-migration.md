---
"@sylphx/coderag-mcp": minor
---

Migrate to @sylphx/mcp-server-sdk for improved developer experience

**Breaking Changes:**
- Replaced `@modelcontextprotocol/sdk` with `@sylphx/mcp-server-sdk` (pure functional, zero dependencies)

**Improvements:**
- ✅ Builder pattern API - cleaner, more ergonomic tool definitions
- ✅ Zero external dependencies (except Zod)
- ✅ Native Zod schema support (no manual JSON schema conversion)
- ✅ Type-safe with first-class TypeScript support
- ✅ Simplified codebase - removed separate tool.ts file

**Migration:**
This is an internal dependency change. No user-facing changes required. The MCP server continues to work identically with the same tool definitions and behavior.
