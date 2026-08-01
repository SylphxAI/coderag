# Publish status — Locus

| Field | Value |
| --- | --- |
| Brand | Locus |
| Brand npm | `@sylphx/locus` |
| Brand version (live) | `0.4.3` |
| Transitional MCP npm | `@sylphx/coderag-mcp` |
| Transitional MCP version (live) | `0.4.2` |
| Transitional core npm | `@sylphx/coderag` |
| Core version (live) | `0.1.25` |
| Registry | **live** (expand–contract) |
| Auth | GitHub org `NPM_TOKEN` via publish workflows |

## Install

```bash
# preferred brand
npx -y @sylphx/locus --root=/abs/path
# transitional still valid during expand
npx -y @sylphx/coderag-mcp --root=/abs/path
```

## Expand note

Brand `0.4.3` was dual-published from transitional artifacts `0.4.2` after npm reserved
(but did not publicly serve) `@sylphx/locus@0.4.2`. Next MCP release should align versions
on both ids (same X.Y.Z). Workflow supports optional `brand_version` for burned versions.

Workflows: `release.yml` / native release train, `publish-brand-alias.yml`.
