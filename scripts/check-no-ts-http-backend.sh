#!/usr/bin/env bash
# Rust-First gate: Web MCP HTTP transport must not retain a parallel TS HTTP backend.
# TS stdio adapter is retired (transport/stdio-ts-adapter → ts_deleted).
# Forbidden: Streamable HTTP / fetch MCP server in packages/mcp-server; HTTP bin path via node.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN="${ROOT}/bin/coderag-mcp"
TS_ENTRY="${ROOT}/packages/mcp-server/src/index.ts"
HTTP_TRANSPORT="${ROOT}/crates/coderag-mcp-server/src/http_transport.rs"
GATE_TEST="${ROOT}/test/check-no-ts-http-backend.test.ts"
TS_ADAPTER_GATE="${ROOT}/scripts/check-ts-adapter-deletion-ready.sh"

violations=0

report_violation() {
	echo "VIOLATION: $*"
	violations=$((violations + 1))
}

echo "=== check-no-ts-http-backend $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="

if [[ ! -f "${BIN}" ]]; then
	report_violation "missing bin/coderag-mcp"
fi

if [[ -f "${TS_ENTRY}" ]]; then
	report_violation "packages/mcp-server/src/index.ts must be deleted (transport/stdio-ts-adapter ts_deleted)"
fi

if [[ ! -f "${HTTP_TRANSPORT}" ]]; then
	report_violation "missing crates/coderag-mcp-server/src/http_transport.rs"
fi

if [[ ! -f "${GATE_TEST}" ]]; then
	report_violation "missing test/check-no-ts-http-backend.test.ts"
fi

if [[ ! -f "${TS_ADAPTER_GATE}" ]]; then
	report_violation "missing scripts/check-ts-adapter-deletion-ready.sh"
fi

if [[ -f "${BIN}" ]]; then
	if ! grep -q 'resolve_rust_bin' "${BIN}"; then
		report_violation "bin/coderag-mcp must resolve Rust rmcp server via resolve_rust_bin"
	fi

	if ! grep -q 'CODERAG_MCP_TRANSPORT=http' "${BIN}"; then
		report_violation "bin/coderag-mcp must route CODERAG_MCP_TRANSPORT=http to Rust"
	fi

	if grep -qE 'http.*node|exec node|use_ts_transport|CODERAG_MCP_TRANSPORT:-}" == "ts"' "${BIN}"; then
		report_violation "bin/coderag-mcp must not launch node or retain TS stdio opt-in"
	fi
fi

if [[ -f "${HTTP_TRANSPORT}" ]]; then
	if ! grep -q 'StreamableHttpService' "${HTTP_TRANSPORT}"; then
		report_violation "Rust http_transport.rs must expose StreamableHttpService"
	fi

	if ! grep -q 'health_check' "${HTTP_TRANSPORT}"; then
		report_violation "Rust http_transport.rs must expose /mcp/health"
	fi
fi

if [[ "${violations}" -gt 0 ]]; then
	echo ""
	echo "FAIL: ${violations} Web MCP HTTP TS authority violation(s)."
	echo "Authority: crates/coderag-mcp-server/src/http_transport.rs via bin/coderag-mcp."
	exit 1
fi

echo "PASS: Web MCP HTTP transport delegates solely to Rust rmcp (no parallel TS HTTP backend)."