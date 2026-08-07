# Locus — brand-sole publish

| Field | Value |
| --- | --- |
| Canonical npm | `@sylphx/locus` |
| bin | `locus` only |
| MCP | `io.github.SylphxAI/locus` |
| Native optionalDependencies | `@sylphx/locus-<platform>` version-locked to product |
| Core library (not install CTA) | `@sylphx/coderag` |
| Retired transitional MCP id | `@sylphx/coderag-mcp` (do not install; do not dual-publish) |

```bash
npx -y @sylphx/locus --root=/absolute/path/to/project
```

## Publish workflows

| Workflow | Purpose |
| --- | --- |
| `Publish MCP npm` | Publish linux-x64-gnu native (if missing) + `@sylphx/locus` from main tip |
| `Publish Locus MCP multi-arch` | Build all platform natives, publish natives + `@sylphx/locus` |
| `Publish brand alias` | **Retired** — fails closed (no dual-publish) |
| `Publish core npm` | Publish `@sylphx/coderag` library only |

Dispatch with `confirm=PUBLISH` (except retired alias workflow).

Auth: org `NPM_TOKEN` via GitHub Actions only.

