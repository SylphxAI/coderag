# Publish status — Locus

| Field | Value |
| --- | --- |
| Brand | Locus |
| Canonical npm | `@sylphx/locus` |
| Source tip version | `0.5.2` |
| Live npm (main package) | check `npm view @sylphx/locus version` — may lag source tip |
| Core library | `@sylphx/coderag` |
| Natives | `@sylphx/locus-<platform>` |
| Auth | GitHub org `NPM_TOKEN` via publish workflows |

## Install (brand-sole)

```bash
npx -y @sylphx/locus --root=/abs/path
```

Do **not** install `@sylphx/coderag-mcp` — transitional id is retired as a public CTA.

## Publish

1. Ensure main tip is brand-sole (`@sylphx/locus` package name, `locus` bin only).
2. Prefer multi-arch for full native coverage:
   ```bash
   gh workflow run 'Publish Locus MCP multi-arch' --repo SylphxAI/coderag -f confirm=PUBLISH
   ```
3. Or linux-x64 + main package only:
   ```bash
   gh workflow run 'Publish MCP npm' --repo SylphxAI/coderag -f confirm=PUBLISH
   ```
4. Prove registry plane separately from source merge:
   ```bash
   npm view @sylphx/locus version bin optionalDependencies
   npm view @sylphx/locus-linux-x64-gnu version
   ```

Dual-publish brand-alias workflow is retired.

