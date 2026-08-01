# Publish status — Locus

| Field | Value |
| --- | --- |
| Brand | Locus |
| Brand npm | `@sylphx/locus` |
| Transitional MCP npm | `@sylphx/coderag-mcp` |
| Transitional core npm | `@sylphx/coderag` |
| MCP transitional version | `0.4.2` (re-check with `npm view`) |
| Brand npm version | may lead during expand if a version is burned (see dual-publish `brand_version`) |
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
