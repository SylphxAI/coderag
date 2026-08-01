# Local-first frontier (Locus)

## Principles (hard)

1. **Less dependency** — no required cloud vector DB or embedding API for default path  
2. **Zero config** — `npx @sylphx/locus --root=…` works offline with local TF-IDF  
3. **Local first, cloud optional** — optional OpenAI (or other) embeddings only when configured  
4. **Speed / size / performance** — Rust rmcp path for search; platform optionalDependencies  
5. **Rust first** — MCP server is fail-closed native; no TS stdio fallback  

## Extraction / retrieval stack (priority)

| Layer | Default | Optional |
| --- | --- | --- |
| Index + TF-IDF | **Rust** local | — |
| AST chunking | local parsers (multi-language) | Synth where integrated |
| Vector hybrid | off | user-provided embedding provider |
| Persistence | local store | — |

## Zero-config usage

```bash
npx -y @sylphx/locus --root=/absolute/path/to/project
# transitional
npx -y @sylphx/coderag-mcp --root=/absolute/path/to/project
```

Optional frontier (still non-authority for default claims):

```bash
# only if user wants hybrid vector — requires their own provider config
export CODERAG_EMBEDDING_…   # product-documented env only; never required
```

## Not in default path (keeps size/speed)

- No mandatory Docker / Qdrant / Weaviate  
- No mandatory cloud embedding bill  
- No remote index service as product default  
