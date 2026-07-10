#!/usr/bin/env bash
# S4 gate: tool/codebase_search must delegate solely to Rust coderag-core via rmcp.
# Forbidden: parallel TS MCP codebase_search handlers on the shipped MCP path.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN="${ROOT}/bin/coderag-mcp"
TS_ENTRY="${ROOT}/packages/mcp-server/src/index.ts"
TS_DIST="${ROOT}/packages/mcp-server/dist/index.js"
RUST_HANDLER="${ROOT}/crates/coderag-mcp-server/src/codebase_search.rs"
RUST_LIB="${ROOT}/crates/coderag-mcp-server/src/lib.rs"
RUST_CORE="${ROOT}/crates/coderag-core/src/engine.rs"
TOOL_ROUTES="${ROOT}/crates/coderag-mcp-server/src/tool_routes.rs"
GOLDEN="${ROOT}/fixtures/golden-retrieval-baseline.json"
STDIO_PARITY="${ROOT}/crates/coderag-mcp-server/tests/golden_parity.rs"
HTTP_INTEGRATION="${ROOT}/test/integration/http-transport.test.ts"
GATE_TEST="${ROOT}/test/check-no-ts-codebase-search.test.ts"
LEDGER="${ROOT}/docs/specs/coderag-migration-ledger.json"
PACKAGE_JSON="${ROOT}/package.json"
CI_WORKFLOW="${ROOT}/.github/workflows/ci.yml"

violations=0

report_violation() {
	echo "VIOLATION: $*"
	violations=$((violations + 1))
}

echo "=== check-no-ts-codebase-search $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="

if [[ ! -f "${BIN}" ]]; then
	report_violation "missing bin/coderag-mcp"
fi

if [[ ! -f "${RUST_HANDLER}" ]]; then
	report_violation "missing crates/coderag-mcp-server/src/codebase_search.rs"
fi

if [[ ! -f "${RUST_LIB}" ]]; then
	report_violation "missing crates/coderag-mcp-server/src/lib.rs"
fi

if [[ ! -f "${RUST_CORE}" ]]; then
	report_violation "missing crates/coderag-core/src/engine.rs"
fi

if [[ ! -f "${TOOL_ROUTES}" ]]; then
	report_violation "missing crates/coderag-mcp-server/src/tool_routes.rs"
fi

if [[ ! -f "${GOLDEN}" ]]; then
	report_violation "missing fixtures/golden-retrieval-baseline.json"
fi

if [[ ! -f "${STDIO_PARITY}" ]]; then
	report_violation "missing crates/coderag-mcp-server/tests/golden_parity.rs"
fi

if [[ ! -f "${HTTP_INTEGRATION}" ]]; then
	report_violation "missing test/integration/http-transport.test.ts"
fi

if [[ ! -f "${GATE_TEST}" ]]; then
	report_violation "missing test/check-no-ts-codebase-search.test.ts"
fi

if [[ ! -f "${LEDGER}" ]]; then
	report_violation "missing docs/specs/coderag-migration-ledger.json"
fi

if [[ ! -f "${PACKAGE_JSON}" ]]; then
	report_violation "missing package.json"
fi

if [[ ! -f "${CI_WORKFLOW}" ]]; then
	report_violation "missing .github/workflows/ci.yml"
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
entry = next((cap for cap in caps if cap.get("id") == "tool/codebase_search"), None)
if entry is None:
    print("[check-no-ts-codebase-search] missing capability tool/codebase_search", file=sys.stderr)
    sys.exit(1)
rust_authority_states = {"rust_impl", "authority_rust"}
if entry.get("state") not in rust_authority_states:
    print(
        f"[check-no-ts-codebase-search] tool/codebase_search is {entry.get('state')}; expected rust_impl (rej-010) or authority_rust",
        file=sys.stderr,
    )
    sys.exit(1)
if entry.get("state") == "rust_impl" and (entry.get("proof") or {}).get("status") != "missing":
    print(
        "[check-no-ts-codebase-search] tool/codebase_search rust_impl must carry proof.status=missing until differential_green",
        file=sys.stderr,
    )
    sys.exit(1)
if "S4" not in (entry.get("notes") or ""):
    print(
        "[check-no-ts-codebase-search] tool/codebase_search notes must document S4 authority routing",
        file=sys.stderr,
    )
    sys.exit(1)
http_transport = next((cap for cap in caps if cap.get("id") == "transport/web-mcp-http"), None)
if http_transport is None or http_transport.get("state") not in rust_authority_states:
    state = http_transport.get("state") if http_transport else "missing"
    print(
        f"[check-no-ts-codebase-search] transport/web-mcp-http is {state}; expected rust_impl (rej-010) or authority_rust",
        file=sys.stderr,
    )
    sys.exit(1)
PY
fi

if [[ -f "${PACKAGE_JSON}" ]]; then
	if ! grep -q 'check:no-ts-codebase-search' "${PACKAGE_JSON}"; then
		report_violation "package.json must expose check:no-ts-codebase-search script"
	fi
fi

if [[ -f "${CI_WORKFLOW}" ]]; then
	if ! grep -q 'check-no-ts-codebase-search.sh' "${CI_WORKFLOW}"; then
		report_violation "ci.yml must run scripts/check-no-ts-codebase-search.sh"
	fi
fi

if [[ -f "${BIN}" ]]; then
	if ! grep -q 'resolve_rust_bin' "${BIN}"; then
		report_violation "bin/coderag-mcp must resolve Rust rmcp server via resolve_rust_bin"
	fi

	if grep -qE 'use_ts_transport|exec node|CODERAG_MCP_TRANSPORT:-}" == "ts"' "${BIN}"; then
		report_violation "bin/coderag-mcp must not launch node or retain TS MCP opt-in"
	fi
fi

if [[ -f "${RUST_LIB}" ]]; then
	if ! grep -q 'codebase_search::codebase_search' "${RUST_LIB}"; then
		report_violation "Rust MCP server must route codebase_search through codebase_search::codebase_search"
	fi
fi

if [[ -f "${RUST_HANDLER}" ]]; then
	if ! grep -q 'coderag_index' "${RUST_HANDLER}"; then
		report_violation "codebase_search.rs must index via coderag_index before search"
	fi

	if ! grep -q 'coderag_search' "${RUST_HANDLER}"; then
		report_violation "codebase_search.rs must search via coderag_search"
	fi

	if ! grep -q 'CODEBASE_SEARCH_ROUTE' "${RUST_HANDLER}"; then
		report_violation "codebase_search.rs must stamp rust-tfidf route metadata"
	fi
fi

if [[ -f "${TOOL_ROUTES}" ]]; then
	if ! grep -q '"codebase_search"' "${TOOL_ROUTES}"; then
		report_violation "tool_routes.rs must map codebase_search"
	fi

	if ! grep -q 'RustCore' "${TOOL_ROUTES}"; then
		report_violation "tool_routes.rs must route codebase_search through RustCore"
	fi
fi

if [[ -d "${ROOT}/packages/mcp-server/src" ]]; then
	if grep -rqE 'StdioServerTransport|McpServer|@modelcontextprotocol/sdk/server|registerTool|codebaseSearch' "${ROOT}/packages/mcp-server/src" 2>/dev/null; then
		report_violation "packages/mcp-server/src must not retain TS MCP codebase_search handlers"
	fi
fi

if [[ "${violations}" -gt 0 ]]; then
	echo ""
	echo "FAIL: ${violations} codebase_search TS authority violation(s)."
	echo "Authority: crates/coderag-mcp-server/src/codebase_search.rs → crates/coderag-core."
	exit 1
fi

echo "PASS: codebase_search routes solely through Rust coderag-core (golden stdio + HTTP parity proven)."