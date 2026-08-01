<div align="center">

# Locus

<p align="center">
  <img src="https://mark.sylphx.com/api/v1/banner?type=glass&theme=tokyonight&text=locus&desc=Local-first+hybrid+code+search+for+agents+%E2%80%94+AST+chunks%2C+TF-IDF%2C+optional+vectors&height=200&animation=rise&credit=0" alt="Locus — Sylphx Mark banner" width="100%" />
</p>

### Your agent searched the codebase. **Did it find the right code?**

**Locus** (repository `coderag`, transitional packages `@sylphx/coderag` / `@sylphx/coderag-mcp`) —
local-first hybrid code search for AI assistants. One MCP call indexes your repo and returns
**semantic AST chunks** — functions, classes, and methods — not noisy grep dumps or slow cloud pipelines.

[![npm brand](https://img.shields.io/npm/v/@sylphx/locus?style=flat-square&label=locus)](https://www.npmjs.com/package/@sylphx/locus)
[![npm mcp](https://img.shields.io/npm/v/@sylphx/coderag-mcp?style=flat-square&label=coderag-mcp)](https://www.npmjs.com/package/@sylphx/coderag-mcp)
[![npm core](https://img.shields.io/npm/v/@sylphx/coderag?style=flat-square&label=core)](https://www.npmjs.com/package/@sylphx/coderag)
[![CI](https://img.shields.io/github/actions/workflow/status/SylphxAI/coderag/ci.yml?style=flat-square)](https://github.com/SylphxAI/coderag/actions)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)

**Local-first** · **MCP + CLI + SDK** · **Hybrid TF-IDF + Vector** · **Rust rmcp** · **Evidence locators**

[⭐ Star this repo](https://github.com/SylphxAI/coderag) if agents should find code with evidence, not guess from keyword hits.
· [Quick start](#quick-start) · [See it work](#see-it-work) · [Why not grep alone?](#why-not-grep-alone)
· [Product docs](#product-docs) · [Roadmap](docs/roadmap/sota-family-roadmap.md)

This repository is product SSOT. Sibling agent tools live in separate repos
(Citra · Iris · Cue · Prism · Spine · Lookout).

</div>

---

## Product docs

| Doc | Purpose |
| --- | --- |
| [docs/POSITIONING.md](docs/POSITIONING.md) | Strategic positioning (Locus vs Spine) |
| [docs/COMPETITIVE.md](docs/COMPETITIVE.md) | Peer anchors and wedge |
| [docs/EVIDENCE_CONTRACT.md](docs/EVIDENCE_CONTRACT.md) | Evidence = result contract (not a tool name) |
| [docs/TOOL_SURFACE.md](docs/TOOL_SURFACE.md) | Few clear tools policy |
| [docs/LOCAL_FIRST_FRONTIER.md](docs/LOCAL_FIRST_FRONTIER.md) | Local-first / zero-config / Rust-first |
| [docs/PRODUCT_INDEPENDENCE.md](docs/PRODUCT_INDEPENDENCE.md) | This repo is SSOT |
| [docs/BRAND_PUBLISH.md](docs/BRAND_PUBLISH.md) | Expand–contract brand npm ids |
| [docs/IPPB.md](docs/IPPB.md) | Independent public product bar |
| [docs/PUBLISH.md](docs/PUBLISH.md) | npm/git publish status |

## Locus vs Spine

| | **Locus** | **Spine** |
| --- | --- | --- |
| Job | Find the right **code chunk** | Map **architecture** (path / trace / impact) |
| Repo | [coderag](https://github.com/SylphxAI/coderag) | [architecture-reader-mcp](https://github.com/SylphxAI/architecture-reader-mcp) |
| Primary tool | `codebase_search` | `architecture_*` |
| Brand npm | `@sylphx/locus` | `@sylphx/spine` |

## The problem

Agents search codebases thousands of times per session. Most paths give you one
of two bad outcomes:

1. **grep/ripgrep** — fast, but literal. Misses `authenticateUser` when you ask
   for "login flow". Returns whole files, not the function you need.
2. **Cloud RAG** — semantic, but needs Docker, vector DBs, embedding APIs, and
   10–30s cold starts before the first search.

The model still guesses which snippet matters. Wrong chunk → wrong patch → wasted
context.

**Locus is built for the moment your agent needs the right code block, not a
directory of keyword hits.**

## Why not grep alone?

| | grep/ripgrep | Cloud RAG | Locus |
| --- | --- | --- | --- |
| **Semantic understanding** | ❌ Literal match | ✅ Embeddings | ✅ TF-IDF + optional vectors |
| **Zero external deps** | ✅ | ❌ Vector DB + embed API | ✅ Local by default |
| **Offline support** | ✅ | ❌ | ✅ |
| **Result shape** | Whole files / lines | Often whole files | AST chunks (functions, classes) |
| **Agent setup** | Shell tool | Docker + services | `npx @sylphx/locus` |

Search latency and indexing throughput: reproduce with
[`bun run benchmark:public-proof`](#benchmark-proof) — do not trust hand-waved
ms claims.

Full comparison: [how search works](docs/guide/how-search-works.md).

## See it work

**Install once. Point at your repo.**

```bash
claude mcp add locus -- npx @sylphx/locus --root=/absolute/path/to/project
# transitional (expand–contract still valid):
# claude mcp add coderag -- npx @sylphx/coderag-mcp --root=/absolute/path/to/project
```

Search with the `codebase_search` tool:

```json
{
  "query": "user authentication login",
  "limit": 5,
  "file_extensions": [".ts", ".tsx"],
  "exclude_paths": ["node_modules", "dist"]
}
```

Returns ranked chunks — not entire files:

```markdown
# Search: "user authentication login" (3 results)

## src/auth/login.ts:1-12
```typescript
export async function authenticate(username: string, password: string) {
  const user = await findUserByEmail(username)
  return validatePassword(user, password)
}
```
```

## Why agents use it

| Need | What you get |
| --- | --- |
| Find implementation | AST chunks at semantic boundaries (functions, classes, methods) |
| Keyword + meaning | Hybrid TF-IDF with optional OpenAI embeddings |
| Fast iteration | Local index, incremental updates, file watching |
| Low setup | MCP server via `npx` — no Docker or ChromaDB required |
| Ship with proof | ~200 tests, reproducible public benchmark script |

## Quick Start

### Claude Code (recommended)

```bash
claude mcp add locus -- npx @sylphx/locus --root=/absolute/path/to/project
# transitional (expand–contract still valid):
# claude mcp add coderag -- npx @sylphx/coderag-mcp --root=/absolute/path/to/project
```

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "coderag": {
      "command": "npx",
      "args": ["-y", "@sylphx/coderag-mcp", "--root=/absolute/path/to/project"]
    }
  }
}
```

### Any MCP Client

```bash
npx @sylphx/coderag-mcp --root=/absolute/path/to/project
```

Need Cursor, VS Code, Windsurf, or library usage? See the
[installation guide](docs/guide/installation.md) and [MCP docs](docs/mcp/overview.md).

### As a Library

```bash
bun add @sylphx/coderag
```

```typescript
import { CodebaseIndexer, PersistentStorage } from '@sylphx/coderag'

const storage = new PersistentStorage({ codebaseRoot: './my-project' })
const indexer = new CodebaseIndexer({ codebaseRoot: './my-project', storage })

await indexer.index({ watch: true })
const results = await indexer.search('authentication logic', { limit: 10 })
```

---

## MCP Tool: `codebase_search`

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `query` | string | — | Search query (required) |
| `limit` | number | 10 | Max results |
| `include_content` | boolean | true | Include code snippets |
| `file_extensions` | string[] | — | Filter by extension |
| `path_filter` | string | — | Filter by path pattern |
| `exclude_paths` | string[] | — | Exclude paths |

Full tool reference: [docs/mcp/tools.md](docs/mcp/tools.md).

---

## Benchmark Proof

Performance claims in this README are backed only by the checked-in public
benchmark script — not hand-waved marketing numbers.

```bash
bun run benchmark:public-proof
```

The script indexes `fixtures/benchmark-corpus/` (30 TypeScript files), runs
hybrid TF-IDF search 20 times (3 warmup), and prints indexing throughput plus
search p50/min/max latency.

See [benchmark proof](docs/benchmark.md) for methodology and latest reproduced
results.

---

## Packages

| Package | Description | Install |
| --- | --- | --- |
| [@sylphx/coderag](packages/core) | Core search library | `npm i @sylphx/coderag` |
| [@sylphx/coderag-mcp](packages/mcp-server) | MCP server for AI assistants | `npx @sylphx/coderag-mcp` |

---

## Documentation

| Topic | Link |
| --- | --- |
| Docs site | [coderag.sylphx.com](https://coderag.sylphx.com) |
| Getting started | [docs/guide/getting-started.md](docs/guide/getting-started.md) |
| MCP server | [docs/mcp/overview.md](docs/mcp/overview.md) |
| How search works | [docs/guide/how-search-works.md](docs/guide/how-search-works.md) |
| Benchmark proof | [docs/benchmark.md](docs/benchmark.md) |
| Stop code-search guessing | [docs/articles/stop-code-search-guessing.md](docs/articles/stop-code-search-guessing.md) |
| API reference | [docs/api/overview.md](docs/api/overview.md) |

---

## Security model

- **Root confinement** — `--root` pins indexing and search to one repository tree.
- **Exclude paths** — `exclude_paths` and default ignores skip `node_modules`, build output, and VCS metadata.
- **Local-first** — TF-IDF indexing runs on your machine; embeddings are optional and caller-configured.
- **Evidence fields** — results include file path, line range, symbol, score route, and index freshness for verification.

Example MCP request: [`examples/codebase-search-request.json`](examples/codebase-search-request.json).

---

## Development

```bash
git clone https://github.com/SylphxAI/coderag.git
cd coderag
bun install
bun run build
bun test
```

Useful checks:

```bash
bun run lint
bun run typecheck
bun run docs:build
bun run benchmark:public-proof
```

---

## Help this reach more builders

If wrong code snippets have wasted your agent context, your edits, or your trust
in search results, you are exactly who this project is for.

**[⭐ Star the repo](https://github.com/SylphxAI/coderag)** — it is the fastest
way to help more agent builders find chunk-level code search. Share it in your
MCP client setup, team wiki, or agent stack README.

### Discovery (in progress)

| Channel | Status |
| --- | --- |
| [Official MCP Registry](https://registry.modelcontextprotocol.io/) | Not listed yet — no `server.json` publish workflow in this repo |
| [Glama MCP directory](https://glama.ai/mcp/servers) | Not listed yet |
| [mcpservers.org submit](https://mcpservers.org/submit) | Not listed yet — free web-form submission |
| [mcp.so](https://mcp.so) | Not listed yet |

Know another MCP directory? [Open an issue](https://github.com/SylphxAI/coderag/issues/new) with the link.

---

## License

MIT © [SylphxAI](https://github.com/SylphxAI)
