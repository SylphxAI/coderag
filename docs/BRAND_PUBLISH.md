# Locus — brand npm publish (expand–contract)

**Publish authority:** this repository only.

| Field | Value |
| --- | --- |
| Brand | **Locus** |
| Canonical brand npm id | `@sylphx/locus` |
| Transitional MCP npm id | `@sylphx/coderag-mcp` |
| Transitional core npm id | `@sylphx/coderag` (library SDK; not dual-published as brand unless needed) |
| Marketplace title | Locus (`server.json`) |

## Policy (expand → contract)

1. **One codebase / one version** — never two products.
2. **Expand:** dual-publish `@sylphx/coderag-mcp@X.Y.Z` and `@sylphx/locus@X.Y.Z` (same artifacts).
3. **Contract (later):** `npm deprecate` transitional MCP id toward brand; keep bins as long as cheap.
4. Workflow: `.github/workflows/publish-brand-alias.yml` (org `NPM_TOKEN`).

## User install

```bash
# preferred brand
npx -y @sylphx/locus --root=/absolute/path/to/project
# transitional still valid during expand
npx -y @sylphx/coderag-mcp --root=/absolute/path/to/project
```

Bins (both point at the same launcher):

- `locus`
- `coderag-mcp`

## Authority

No central Instruments monorepo. Brand alias ships only from this product repo.
