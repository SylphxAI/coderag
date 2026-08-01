# Evidence contract — Locus

**Evidence First** means results carry citeable structure. There is **no** MCP tool named `evidence_first`.

## Locators and honesty for this product

- file path
- start/end line (or equivalent range) for each hit
- score / rank explainability when available
- chunk kind (function, class, method, …) when AST-bounded
- index freshness / cache warnings when applicable

## Always include when applicable

- **route**: which engine path produced the payload (e.g. Rust TF-IDF, hybrid)
- **warnings**: missing native binary, unsupported platform, partial index, provider off
- raw ranked chunks over generative rewrite as authority

## Non-goals

- Requiring a cloud model to “confirm” local retrieval facts
- Over-marketing Evidence First without path/line locators on the wire
