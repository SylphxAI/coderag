# Stop Your Agent From Guessing Which Code Snippet Matters

You asked Claude to fix the login bug. It edited `src/utils/helpers.ts` — a file
that has nothing to do with authentication.

That is not a model failure. It is a **code search workflow failure**.

## What actually went wrong

Most agent stacks search code one of two ways:

1. **grep/ripgrep** — literal match. Fast, but blind to synonyms and intent.
2. **Cloud RAG** — semantic, but heavy setup, cold starts, and whole-file chunks.

Both often return **too much text in the wrong shape**. The model picks a
plausible-looking snippet and runs with it.

## Three failures you cannot fix with a better prompt

| Failure | What the agent sees | What actually happened |
| --- | --- | --- |
| Literal-only match | "No results" or random hits | Query said "login flow", code says `authenticateUser` |
| Whole-file dump | 400 lines of context | Only 12 lines in one function matter |
| Stale index | Old snippet | File changed since last scan; agent patches dead code |

No system prompt fixes the wrong chunk.

## What chunk-level hybrid search changes

CodeRAG indexes at **AST boundaries** — functions, classes, methods — and ranks
with hybrid TF-IDF (plus optional vectors when you want them):

- **Semantic chunks** the agent can read without burning context.
- **Scored results** so the best match surfaces first.
- **Local index** with SQLite persistence and incremental updates.
- **MCP-first** setup — no Docker, ChromaDB, or cloud pipeline required.

The agent still uses a language model. The difference is it works from **the
right code block**, not a directory of keyword accidents.

## Try the fix in 30 seconds

```bash
claude mcp add coderag -- npx @sylphx/coderag-mcp --root=/absolute/path/to/project
```

```json
{
  "query": "user authentication login",
  "limit": 5,
  "exclude_paths": ["node_modules", "dist"]
}
```

Point at your repo. Search returns ranked function-level chunks — not whole
files, not cloud latency.

## Verify the claims

```bash
bun run benchmark:public-proof
```

Reproducible indexing throughput and search latency on a fixed in-repo corpus.
See [benchmark proof](/benchmark) for methodology.

## Share this

- [CodeRAG on GitHub](https://github.com/SylphxAI/coderag)
- [MCP server docs](/mcp/overview)
- [⭐ Star the repo](https://github.com/SylphxAI/coderag) — help other builders stop guessing