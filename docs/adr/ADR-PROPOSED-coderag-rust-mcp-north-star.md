# ADR-PROPOSED — CodeRAG Rust MCP North Star + ts_deleted admission

- **Status:** Accepted
- **Date:** 2026-07-11
- **Accepted via:** PR pending (Doctrine ADR# = introducing PR#; renumber after PR open)
- **Packet:** `CODERAG-TS-DELETED-ADMISSION-TICK023`
- **Relates to:** ADR-66 (MCP family SOTA roadmap), fleet COMPLETION-STANDARD, rej-010/011
- **Change class:** `required` for CodeRAG MCP cutover ledger; `advisory` for fleet

## Context

CodeRAG ships an npm MCP package (`@sylphx/coderag-mcp`) whose production consumer
path is a **Rust rmcp** binary (stdio + Streamable HTTP) with multi-arch
`optionalDependencies` platform packages. The TypeScript stdio adapter
(`packages/mcp-server/src/index.ts`) was deleted on main historically; four
in-scope capabilities track the MCP cutover denominator:

| Capability | Prior state (PR #80) | Proof |
|---|---|---|
| `transport/web-mcp-http` | `rust_impl` | `canary_green` + npm tarball digest |
| `transport/stdio-rust-rmcp` | `rust_impl` | `canary_green` + npm tarball digest |
| `tool/codebase_search` | `rust_impl` | `canary_green` + npm tarball digest |
| `transport/stdio-ts-adapter` | `ts_deleted` (pre-existing) | `canary_green` + npm tarball digest |

Evidence package already admitted on main (PR #80 canary bind + tick014
`prod_audit_pass` + independent `ACCEPT_PROD_AUDIT_PASS`):

- npm `@sylphx/coderag-mcp@0.4.1` `gitHead=8fd7a45…`
- `imageDigest` = npm tarball sha256 `1e6f569f0a333230ccfc998432701b31c46b18ebe6c29515026d46cb466a1ff9`
- Differential CI merge_group [29142069368](https://github.com/SylphxAI/coderag/actions/runs/29142069368) — cases=9 (tool=3 stdio=3 http=3)
- Darwin arm64 install + MCP initialize + `tools/list=codebase_search` PASS
- `check-no-ts`×4 ALL PASS (stdio, http, codebase_search, adapter-deletion-ready)

## Decision

### 1. North Star production stack (CodeRAG MCP)

| Layer | North Star | Transitional residual |
| --- | --- | --- |
| MCP stdio transport | Rust `crates/coderag-mcp-server` via `rmcp::transport::stdio()` | none |
| MCP Streamable HTTP | Rust `http_transport.rs` / `StreamableHttpService` | none |
| MCP tool `codebase_search` | Rust `codebase_search.rs` + `coderag-core` | TS `rust-engine.ts` oracle for differential only |
| npm consumer bin | `bin/coderag-mcp` arch-aware, optionalDeps-first, fail-closed | embedded linux ELF fallback under arch gate |
| Platform natives | `@sylphx/coderag-mcp-{darwin-arm64,darwin-x64,linux-x64-gnu,linux-arm64-gnu}` | win32/musl out of declared matrix |
| Library / oracle TS | `packages/core`, `packages/mcp-server/src/{rust-engine,doctor,evidence,search-coordinator}.ts` | **not** MCP production authority |

### 2. Full-denominator `ts_deleted` admission (TICK023)

Because **all four** in-scope caps already carry `proof.status=canary_green` +
`imageDigest` and there is **no TS residual authority** on the MCP hot path
(`check-no-ts`×4 PASS), admit:

```text
state = ts_deleted   for transport/web-mcp-http
state = ts_deleted   for transport/stdio-rust-rmcp
state = ts_deleted   for tool/codebase_search
state = ts_deleted   for transport/stdio-ts-adapter  (pre-existing; retained)
```

Resulting product metrics:

- `ts_deleted = 4 / 4`
- `completion_progress = 1.0` (product capability metric)
- `authority_progress = 1.0`
- `verified_authority_progress = 1.0`

Per-capability `promotionHold.active=false` (evidence-bound release). Freezes
rej-010 / rej-011 are **not** claimed as a generic lift; further claims remain
evidence-bound. **Fleet FCP is not claimed** by this ADR.

### 3. What is explicitly out of claim

- Fleet-wide completion / FCP / control-plane `verified_complete`
- Generic freeze lift for other repos or future authority promotions
- win32 / linux-musl multi-arch expansion
- Cosmetic `serverInfo.version` alignment (P2)
- Deletion of differential oracle TS helpers (retained under non-authority residual)
- Hand-edit of control-plane ledgers from this product PR

## Alternatives considered

| Alternative | Why rejected |
| --- | --- |
| Keep `rust_impl` despite canary_green+no TS authority | Dishonest residual vs COMPLETION-STANDARD A/E; completion stuck at 0 with closed substance |
| Require intermediate `authority_rust` ledger hop | Workbench peer admitted `ts_deleted` directly from canary ladder; proof gate for `ts_deleted` is canary_green+digest, already met |
| Delete oracle/library TS in same PR | Out of scope; oracle needed for differential harness; not MCP authority per check-no-ts |
| Claim fleet FCP | CP ledger reconcile + DECISION-003 gates are separate mechanical steps |

## Consequences

- Product SSOT `docs/specs/coderag-migration-ledger.json` reports full denominator
  `ts_deleted`.
- Gate scripts accept `ts_deleted` as a terminal Rust-authority ledger state
  alongside `rust_impl` / `authority_rust`.
- Control-plane fleet ledger projection may lag until a separate reconcile packet.
- Consumers continue to take Rust-only MCP authority via npm multi-arch packages.

## Verification

- `bash scripts/check-no-ts-{stdio-backend,http-backend,codebase-search}.sh` PASS
- `bash scripts/check-ts-adapter-deletion-ready.sh` PASS
- bun matrix tests for ledger + gates PASS
- npm `@sylphx/coderag-mcp@0.4.1` gitHead + integrity reconfirm
- Differential main_durable evidence retained at bound SHA `8fd7a45…`
