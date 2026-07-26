# coderag — local agent notes only

Static engineering and delivery standards load from the active Skills runtime
([SylphxAI/skills](https://github.com/SylphxAI/skills) is binding instruction
SSOT). Doctrine and Mission Control are retired historical lineage and must not
be loaded as current instruction authority.

Local truth: `PROJECT.md`, `.doctrine/project.json` when present.

## Boundary hazards

- Never commit secrets, tokens, `.env` files, or credentials.

## Local commands

- `bun run typecheck`
- `bun run test`
- `bun run lint`
- `bun run build`
- `cargo test --workspace`
- Prefer the **narrowest** affected check before full workspace runs.
- Report layers honestly: local diff · trunk FF · deploy · prod proof (do not collapse).

## Validation notes

- Prefer the **narrowest** affected check before full workspace runs.
- Report layers honestly: local diff · trunk FF · deploy · prod proof (do not collapse).

## Backend false-authority fence

Work: wi_01KYFN6993PMG8WD00Q51AE231

If this repository has completed a **Rust backend** cutover:

1. Production backend behavior authority is the Rust crate/binary/service path declared in `sylphx.toml` / deploy manifests / package `bin` native path / Docker ENTRYPOINT.
2. Residual TypeScript service trees or alternate TS engines are **not** product authority unless explicitly proven still on the live path.
3. Do not "fix production" by editing residual TypeScript and assuming deploy/runtime will pick it up.
4. Prefer deleting residual TS backend trees after Rust sole proof; keep history in Git.
5. Intentional TypeScript frontends, npm packaging wrappers, and native-binding surfaces may remain.

### Repo-specific note

Rust crates own retrieval/MCP server core; residual TS packages are not production authority without publish proof.
