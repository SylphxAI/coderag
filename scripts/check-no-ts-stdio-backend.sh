#!/usr/bin/env bash
# S5 gate: default MCP stdio transport must delegate solely to Rust rmcp.
# TS stdio adapter is retired (transport/stdio-ts-adapter → ts_deleted).
# Forbidden: parallel TS stdio MCP server in packages/mcp-server; bin stdio path via node.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN="${ROOT}/bin/coderag-mcp"
PKG_BIN="${ROOT}/packages/mcp-server/bin/coderag-mcp"
TS_ENTRY="${ROOT}/packages/mcp-server/src/index.ts"
TS_DIST="${ROOT}/packages/mcp-server/dist/index.js"
RUST_MAIN="${ROOT}/crates/coderag-mcp-server/src/main.rs"
STDIO_GATE="${ROOT}/scripts/check-no-ts-stdio-backend.sh"
GATE_TEST="${ROOT}/test/check-no-ts-stdio-backend.test.ts"
TS_ADAPTER_GATE="${ROOT}/scripts/check-ts-adapter-deletion-ready.sh"
LEDGER="${ROOT}/docs/specs/coderag-migration-ledger.json"
STDIO_PARITY="${ROOT}/crates/coderag-mcp-server/tests/golden_parity.rs"
GOLDEN="${ROOT}/fixtures/golden-retrieval-baseline.json"
PACKAGE_JSON="${ROOT}/package.json"
CI_WORKFLOW="${ROOT}/.github/workflows/ci.yml"

violations=0

report_violation() {
	echo "VIOLATION: $*"
	violations=$((violations + 1))
}

echo "=== check-no-ts-stdio-backend $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="

if [[ ! -f "${BIN}" ]]; then
	report_violation "missing bin/coderag-mcp"
fi

if [[ ! -f "${PKG_BIN}" ]]; then
	report_violation "missing packages/mcp-server/bin/coderag-mcp"
fi

if [[ ! -f "${STDIO_GATE}" ]]; then
	report_violation "missing scripts/check-no-ts-stdio-backend.sh"
fi

if [[ ! -f "${GATE_TEST}" ]]; then
	report_violation "missing test/check-no-ts-stdio-backend.test.ts"
fi

if [[ ! -f "${TS_ADAPTER_GATE}" ]]; then
	report_violation "missing scripts/check-ts-adapter-deletion-ready.sh"
fi

if [[ ! -f "${LEDGER}" ]]; then
	report_violation "missing docs/specs/coderag-migration-ledger.json"
fi

if [[ ! -f "${RUST_MAIN}" ]]; then
	report_violation "missing crates/coderag-mcp-server/src/main.rs"
fi

if [[ ! -f "${STDIO_PARITY}" ]]; then
	report_violation "missing crates/coderag-mcp-server/tests/golden_parity.rs"
fi

if [[ ! -f "${GOLDEN}" ]]; then
	report_violation "missing fixtures/golden-retrieval-baseline.json"
fi

if [[ -f "${TS_ENTRY}" ]]; then
	report_violation "packages/mcp-server/src/index.ts must be deleted (transport/stdio-ts-adapter ts_deleted)"
fi

if [[ -f "${TS_DIST}" ]]; then
	report_violation "packages/mcp-server/dist/index.js must be deleted (transport/stdio-ts-adapter ts_deleted)"
fi

if [[ -f "${LEDGER}" ]]; then
python3 - "${LEDGER}" <<'PY'
import json
import sys

ledger_path = sys.argv[1]
with open(ledger_path, encoding="utf-8") as handle:
    ledger = json.load(handle)
caps = ledger.get("capabilities", [])
stdio_rust = next((cap for cap in caps if cap.get("id") == "transport/stdio-rust-rmcp"), None)
ts_adapter = next((cap for cap in caps if cap.get("id") == "transport/stdio-ts-adapter"), None)
if stdio_rust is None:
    print("[check-no-ts-stdio-backend] missing capability transport/stdio-rust-rmcp", file=sys.stderr)
    sys.exit(1)
if ts_adapter is None:
    print("[check-no-ts-stdio-backend] missing capability transport/stdio-ts-adapter", file=sys.stderr)
    sys.exit(1)
rust_authority_states = {"rust_impl", "authority_rust", "ts_deleted"}
if stdio_rust.get("state") not in rust_authority_states:
    print(
        f"[check-no-ts-stdio-backend] transport/stdio-rust-rmcp is {stdio_rust.get('state')}; expected rust_impl, authority_rust, or ts_deleted",
        file=sys.stderr,
    )
    sys.exit(1)
allowed_proof = {"missing", "differential_green", "canary_green", "caught_up"}
proof_status = (stdio_rust.get("proof") or {}).get("status")
if stdio_rust.get("state") in {"rust_impl", "ts_deleted"} and proof_status not in allowed_proof:
    print(
        f"[check-no-ts-stdio-backend] transport/stdio-rust-rmcp state={stdio_rust.get('state')} proof.status={proof_status!r}; "
        f"expected one of {sorted(allowed_proof)}",
        file=sys.stderr,
    )
    sys.exit(1)
if "S5" not in (stdio_rust.get("notes") or ""):
    print(
        "[check-no-ts-stdio-backend] transport/stdio-rust-rmcp notes must document S5 authority routing",
        file=sys.stderr,
    )
    sys.exit(1)
if ts_adapter.get("state") != "ts_deleted":
    print(
        f"[check-no-ts-stdio-backend] transport/stdio-ts-adapter is {ts_adapter.get('state')}; expected ts_deleted",
        file=sys.stderr,
    )
    sys.exit(1)
PY
fi

if [[ -f "${PACKAGE_JSON}" ]]; then
	if ! grep -q 'check:no-ts-stdio-backend' "${PACKAGE_JSON}"; then
		report_violation "package.json must expose check:no-ts-stdio-backend script"
	fi
fi

if [[ -f "${CI_WORKFLOW}" ]]; then
	if ! grep -q 'check-no-ts-stdio-backend.sh' "${CI_WORKFLOW}"; then
		report_violation "ci.yml must run scripts/check-no-ts-stdio-backend.sh"
	fi
fi

for bin_path in "${BIN}" "${PKG_BIN}"; do
	if [[ ! -f "${bin_path}" ]]; then
		continue
	fi

	if ! grep -q 'resolve_rust_bin' "${bin_path}"; then
		report_violation "${bin_path} must resolve Rust rmcp server via resolve_rust_bin"
	fi

	if ! grep -q 'printf.*stdio' "${bin_path}"; then
		report_violation "${bin_path} must default transport to stdio"
	fi

	if grep -qE 'use_ts_transport|exec node|CODERAG_MCP_TRANSPORT:-}" == "ts"' "${bin_path}"; then
		report_violation "${bin_path} must not launch node or retain TS stdio opt-in"
	fi
done

if [[ -f "${RUST_MAIN}" ]]; then
	if ! grep -q 'transport::stdio' "${RUST_MAIN}"; then
		report_violation "Rust MCP server must expose rmcp stdio transport"
	fi
fi

if [[ -d "${ROOT}/packages/mcp-server/src" ]]; then
	if grep -rqE 'StdioServerTransport|McpServer|@modelcontextprotocol/sdk/server' "${ROOT}/packages/mcp-server/src" 2>/dev/null; then
		report_violation "packages/mcp-server/src must not retain TS stdio MCP server transport"
	fi
fi

if [[ "${violations}" -gt 0 ]]; then
	echo ""
	echo "FAIL: ${violations} MCP stdio TS authority violation(s)."
	echo "Authority: crates/coderag-mcp-server/src/main.rs via bin/coderag-mcp."
	exit 1
fi

echo "PASS: MCP stdio transport delegates solely to Rust rmcp (golden codebase_search parity proven)."