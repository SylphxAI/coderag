# Locus — competitive positioning

## Job

Local-first hybrid **code chunk** retrieval for agents (MCP + SDK + CLI).

## Wedge

Zero-config local hybrid search that returns **AST-bounded chunks with locators**, not whole-file grep dumps or cloud-only RAG stacks.

## Local-first

Default path needs no API key, no Docker vector DB, no remote index.

## Peer anchors (learn; do not clone)

| Peer / class | Gap we exploit |
| --- | --- |
| grep / ripgrep | Literal only; whole files/lines; no semantic rank |
| Cloud RAG / hosted code index | Setup tax, network, cold start; not zero-config local |
| Generic file RAG MCPs | Often file/window chunks without AST boundaries + explainable score |
| IDE-only search | Not portable MCP/SDK for arbitrary agents |
| **Spine** (sibling) | Architecture graph, not chunk retrieval — complementary, not competitor clone |

## Non-goals

- Becoming a cloud SaaS wrapper as the default path
- Multi-product monorepo for star aggregation
- Replacing architecture map tools (that is Spine)

## Boundaries

- **Locus** finds the right **implementation chunk**.
- **Spine** answers path / trace / impact on the **architecture graph**.

## Zero-config CTA

```bash
npx -y @sylphx/locus --root=/absolute/path/to/project
```

Live **@sylphx/locus@0.5.2**. Bare MCP stdio for agents.
