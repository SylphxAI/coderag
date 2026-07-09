# ADR-66: Adopt CodeRAG MCP Family SOTA Roadmap

Date: 2026-07-09
Status: Accepted
Slug: mcp-family-sota-roadmap

## Context

CodeRAG is the code retrieval engine in the SylphxAI MCP family. It needs a
repo-local roadmap that preserves its ownership of search, indexing, ranking,
chunking, embeddings, persistence, and `codebase_search` while clarifying how
it supports architecture, reader, filesystem, and consultation workflows.

## Decision

Adopt `docs/roadmap/sota-family-roadmap.md` as the local roadmap for CodeRAG's
family role.

CodeRAG owns code evidence retrieval. It should evolve toward Rust indexing,
ranking, and MCP serving while preserving the public `codebase_search` contract
during migration.

## Consequences

- Architecture graph semantics stay in Architecture Reader MCP.
- File mutations stay in Filesystem MCP.
- Non-code media extraction stays in Reader MCPs.
- Future ranking and indexing work must include retrieval evals, evidence
  locators, freshness, and benchmark gates.

## Amendment: Rust-Native MCP Runtime

The family runtime direction now targets Rust MCP servers using
`modelcontextprotocol/rust-sdk` / `rmcp`. For CodeRAG, TypeScript can remain as
a compatibility wrapper or generated client surface, but it is not the target
MCP server runtime.

## Verification

- Roadmap added at `docs/roadmap/sota-family-roadmap.md`.
- README and PROJECT link to the roadmap.
- Docs-only validation: `git diff --check`.
