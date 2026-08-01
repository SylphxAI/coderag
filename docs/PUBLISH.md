# Publish status — Locus

| Field | Value |
| --- | --- |
| Brand | Locus |
| Brand npm | `@sylphx/locus` |
| Transitional MCP npm | `@sylphx/coderag-mcp` |
| Transitional core npm | `@sylphx/coderag` |
| MCP version (tip of expand) | `0.4.2` (re-check with `npm view`) |
| Core version | `0.1.25` (re-check with `npm view`) |
| Registry | transitional **live**; brand via `publish-brand-alias.yml` |
| Auth | GitHub org `NPM_TOKEN` via publish workflows |

## Install

```bash
# preferred brand (after dual-publish)
npx -y @sylphx/locus --root=/abs/path
# transitional still valid during expand
npx -y @sylphx/coderag-mcp --root=/abs/path
```

Workflows: `release.yml` / native release train, `publish-brand-alias.yml`.
