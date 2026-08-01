# Local-first frontier (Locus)

## Principles (hard)

1. **Less dependency** — default path must not require cloud APIs, vector DBs, or ML npm wheels  
2. **Zero config** — `npx @sylphx/locus --root=…` works offline with local TF-IDF  
3. **Local first, cloud optional** — embeddings / remote providers only when user configures them  
4. **Speed / size / performance** — prefer single native MCP binary; avoid dual full stacks  
5. **Rust first** — MCP + retrieval engine native; fail-closed without TS stdio fallback  
6. **Simple but powerful** — one primary agent tool: `codebase_search`

## What is true today (evidence)

| Layer | Status | Evidence |
| --- | --- | --- |
| MCP default | **Rust-first** | `bin/coderag-mcp` launches native `coderag-mcp-server`; no TS stdio fallback |
| Zero-config search | **Yes** | Local TF-IDF / AST chunk path; no API key |
| Package size (MCP) | **~10 MB unpacked** | primarily staged native `coderag-cli` + `coderag-mcp-server` |
| TS core `@sylphx/coderag` | **Overweight vs principle** | hard deps include `@huggingface/transformers`, `@ai-sdk/openai`, `ai`, `drizzle-orm`, `@libsql/client`, plus many `@sylphx/synth-*` optionalDeps |
| Cloud optional | **Partial** | OpenAI / HF present as *library* deps even when MCP path does not need them |

## Target architecture (Final Decision direction)

```
Agent ──MCP──► locus (native rmcp) ──► coderag-cli (Rust TF-IDF/AST)
                                              │
SDK (optional thin) ──► same Rust engine OR pure-Rust crate bindings
                                              │
Optional cloud ── only if user sets provider config (peer/optional dep)
```

### Non-negotiable targets

1. **MCP install path** remains zero-config, local TF-IDF, no API key.  
2. **SDK package** must not force HF transformers / OpenAI SDK on every install:  
   - move `@huggingface/transformers`, `@ai-sdk/openai`, `ai`, LanceDB to **optionalPeers** or a separate `@sylphx/locus-vector` package  
   - keep pure index/search SDK thin (or document “MCP-only recommended”)  
3. **One concept:** find the right **code chunk** with path/line evidence — not architecture graph (that is Spine).  
4. **One public tool** lead: `codebase_search` (engine aliases internal only).  
5. **Size:** prefer platform optionalDependencies for natives (Citra pattern) over shipping multi-arch blobs in one tarball when possible; keep install path simple.

## Peer anchors (learn, do not clone)

| Peer | What to absorb | What not to become |
| --- | --- | --- |
| 100% Rust codegraph MCP peers | Native graph/search speed; few tools; SQLite local | 14+ vanity tools; LLM-required summaries as authority |
| Cloud RAG stacks | Hybrid quality when configured | Default Docker/vector DB tax |
| grep/ripgrep | Speed + zero deps | Literal-only results |

## Zero-config usage (canonical)

```bash
npx -y @sylphx/locus --root=/absolute/path/to/project
# tool: codebase_search { "query": "auth login", "limit": 5 }
```

## Honest residual (as of 2026-08-01)

- MCP path is local-first.  
- **TS SDK dependency graph is not yet “less dependency” gold** — slimming is P0 product work, not marketing.  
- Brand/transitional version skew may exist during expand–contract; see PUBLISH.md.
