# ADR-66: Adopt CodeRAG MCP Family SOTA Roadmap

Date: 2026-07-09
Status: Proposed in PR #66
Slug: mcp-family-sota-roadmap

## Context

CodeRAG is the code retrieval engine in the SylphxAI MCP family. It needs a
repo-local roadmap that preserves its ownership of search, indexing, ranking,
chunking, embeddings, persistence, and `codebase_search` while clarifying how
it supports architecture, reader, filesystem, and consultation workflows.

## Decision

Adopt `docs/roadmap/sota-family-roadmap.md` as the local roadmap for CodeRAG's
family role.

CodeRAG owns code evidence retrieval. It should evolve toward a Rust indexing
and ranking core with a stable public TypeScript/Bun package surface during
migration.

## Consequences

- Architecture graph semantics stay in Architecture Reader MCP.
- File mutations stay in Filesystem MCP.
- Non-code media extraction stays in Reader MCPs.
- Future ranking and indexing work must include retrieval evals, evidence
  locators, freshness, and benchmark gates.

## Verification

- Roadmap added at `docs/roadmap/sota-family-roadmap.md`.
- README and PROJECT link to the roadmap.
- Docs-only validation: `git diff --check`.
