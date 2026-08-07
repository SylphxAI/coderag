# Locus — positioning

## One-liner

**Locus**: Local-first hybrid code search for agents — find the right AST chunk, not a grep dump.

## Why agents use this

Agents need the **implementation site** of a behavior: function, class, method. Locus indexes a repo
locally, ranks hybrid TF-IDF (+ optional vectors), and returns citeable chunks with path and line ranges.

## Not Spine

| Product | Job |
| --- | --- |
| **Locus** (`coderag`) | Find the right **code chunk** (semantic / hybrid retrieval) |
| **Spine** (`architecture-reader-mcp`) | Map **architecture**: path, trace, impact, boundaries |

Compose both via public MCP/SDK contracts. Do not merge products.

## Surfaces

| Surface | Role |
| --- | --- |
| MCP | Agent tools over stdio (`codebase_search`) |
| CLI | Human/scriptable brand bin (`locus`) |
| SDK | `@sylphx/coderag` programmatic library for apps and dogfood |

## Primary tools

- `codebase_search` — primary agent retrieval (index + search envelope)

Transitional aliases may exist in the engine (`coderag_search`, `coderag_index`) but
public agent UX leads with **one clear tool**.

## Evidence

See [EVIDENCE_CONTRACT.md](./EVIDENCE_CONTRACT.md).

## Independence

See [PRODUCT_INDEPENDENCE.md](./PRODUCT_INDEPENDENCE.md).

## Competitive

See [COMPETITIVE.md](./COMPETITIVE.md).

## Completion bar

See [IPPB.md](./IPPB.md).
