# Tool surface — Locus

Policy: **few, powerful, obvious** tools. Prefer the primary search tool first.

| Tool / surface | Role |
| --- | --- |
| `codebase_search` | Primary hybrid retrieval (index + ranked AST chunks) |
| CLI `locus` | Brand CLI / MCP launcher |
| CLI `coderag-mcp` | Transitional launcher (same binary path) |
| SDK `@sylphx/coderag` | Programmatic library |

## Rules

1. Do not add near-duplicate tools that only differ by vanity naming.
2. Engine-internal aliases (`coderag_search`, `coderag_index`) must not confuse public README — lead with `codebase_search`.
3. Schema fields should be agent-obvious; fail closed on unsafe roots.
4. Composition with Spine/Citra/… is via public contracts, not monorepo imports.
