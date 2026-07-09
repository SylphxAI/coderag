# SOTA Family Roadmap

Status: adoption plan
Owner: CodeRAG
Scope: repo-local future plan and its role in the SylphxAI MCP family
Decision record: `docs/adr/ADR-66-mcp-family-sota-roadmap.md`

## Family Role

CodeRAG is the code evidence retrieval engine for the MCP family. It returns the
right code snippets, files, symbols, and context packs quickly enough for agents
to reason before editing.

It owns retrieval, ranking, indexing, chunking, persistence, embeddings, and the
`codebase_search` MCP package. It does not own architecture graph semantics,
filesystem writes, document extraction, or model deliberation.

## Family Fit

| Project | Relationship |
| --- | --- |
| Architecture Reader MCP | Uses CodeRAG as a retrieval substrate when graph coverage needs source candidates. Architecture Reader owns architecture graph claims. |
| Filesystem MCP | Applies safe reads and writes. CodeRAG indexes and searches code but does not mutate files. |
| Reader MCPs | Extract non-code evidence from PDFs, images, and videos. CodeRAG may index generated text only through explicit user-controlled inputs. |
| Consultant MCP | Reviews retrieval strategy, ranking decisions, and architectural tradeoffs when high-stakes changes need external challenge. |
| Smart Reader MCP | Routes non-code files; CodeRAG stays focused on repository text and source code retrieval. |

## SOTA End State

CodeRAG should become the default local code retrieval engine for agents:
fast, deterministic, explainable, offline-first, and able to mix lexical,
semantic, symbol, AST, dependency, recency, and ownership signals.

The final product is not "search results as text." It is an evidence engine
that explains why a result was returned and how fresh the indexed evidence is.

## Runtime Direction

The current TypeScript/Bun implementation remains the compatibility surface.
The SOTA target is Rust for scanning, indexing, ranking, persistence, snippet
extraction, incremental updates, and MCP serving.

The Rust MCP server should use `modelcontextprotocol/rust-sdk` / `rmcp` while
preserving the existing `codebase_search` public contract. TypeScript can remain
for generated client types, compatibility wrappers, and package transition
tests, but it is not the target MCP adapter runtime.

WASM can be used for portable tokenization or sandboxed analyzers only where
benchmarks prove the tradeoff. Native Rust remains the default for hot paths.

## Roadmap

### Phase 0: Contract And Evaluation

- Freeze `codebase_search` request and response semantics.
- Add result evidence fields: file, line range, symbol, route, score components,
  freshness, and warnings.
- Add retrieval eval fixtures with expected files and ranges.
- Publish the current performance baseline as measured output, not prose.

### Phase 1: Rust Index Core

- Build Rust primitives for repository walking, hashing, chunk persistence,
  lexical ranking, and snippet extraction.
- Add a Rust MCP server facade for the frozen `codebase_search` contract.
- Keep TypeScript package compatibility as a wrapper or generated client layer,
  not as the long-term MCP server.
- Add deterministic snapshot tests and cache invalidation tests.
- Add install diagnostics for missing native engine packages.

### Phase 2: Hybrid Ranking

- Add symbol and AST-aware ranking signals.
- Add optional embedding routes behind explicit cache and degraded-mode policy.
- Add score explainability fields in every result.
- Add monorepo package, ownership, test proximity, and recency signals.

### Phase 3: Agent Context Packs

- Add task modes for explain, edit, review, test, migration, and incident
  workflows.
- Deduplicate repeated snippets and collapse low-value boilerplate.
- Provide compact context packs that Architecture Reader and Consultant MCP can
  consume without re-querying the repo.

### Phase 4: Native Distribution And Public Benchmarking

- Publish platform-specific optional binary packages.
- Add standalone binaries and `doctor` diagnostics.
- Publish benchmark fixtures for cold index, warm search, incremental update,
  memory ceiling, and output determinism.

## Star And Adoption Strategy

The README should make the first win immediate: install, point at a repo, ask a
natural code question, and receive cited code evidence in one MCP call. The
positioning should emphasize local speed, explainable ranking, no required
external service, and direct value to coding agents.

## Validation Gates

- Retrieval evals prove expected evidence files and line ranges.
- Ranking changes include before/after fixture results.
- Index snapshots are deterministic.
- Optional embeddings never hide degraded lexical fallback.
- Native install succeeds across supported platforms without network
  postinstall binary downloads.
