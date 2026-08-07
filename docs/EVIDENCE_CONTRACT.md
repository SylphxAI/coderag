# Evidence contract — Locus

Family envelope v1. Locators: file path, line range, chunk/symbol ids.
Route: hybrid rank path (tfidf/vector/ast as applicable).
Gaps: stale index, unsupported language, empty root.
No `evidence_first` tool. Does not own architecture graph claims (Spine) or FS mutation.

## Implemented family wire fields (v1)

Every tool result includes:

- `envelope_version: "1"`
- `status`, `tool`, `product`, `product_version`
- `route` as `{ engine, path? }`
- `warnings` and `gaps` arrays (may be empty)
- domain payload (often also as top-level twin/results/answer for compatibility)

Schema: `SylphxAI/skills` `schemas/instrument-evidence-envelope.schema.json`.
