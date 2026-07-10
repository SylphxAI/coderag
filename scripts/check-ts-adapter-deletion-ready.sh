#!/usr/bin/env bash
# Post-deletion gate for transport/stdio-ts-adapter.
# Fails if TS stdio adapter files or opt-in routing remain after ts_deleted.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LEDGER="$ROOT/docs/specs/coderag-migration-ledger.json"
TS_ENTRY="$ROOT/packages/mcp-server/src/index.ts"
TS_DIST="$ROOT/packages/mcp-server/dist/index.js"
BIN="$ROOT/bin/coderag-mcp"
PKG_BIN="$ROOT/packages/mcp-server/bin/coderag-mcp"

require_ledger_state() {
	local capability="$1"
	local expected="$2"
	node - "$LEDGER" "$capability" "$expected" <<'NODE'
const [ledgerPath, capability, expected] = process.argv.slice(2);
const ledger = JSON.parse(require("node:fs").readFileSync(ledgerPath, "utf8"));
const entry = ledger.capabilities.find((cap) => cap.id === capability);
if (!entry) {
  console.error(`[check-ts-adapter-deleted] missing capability ${capability}`);
  process.exit(1);
}
if (entry.state !== expected) {
  console.error(
    `[check-ts-adapter-deleted] ${capability} is ${entry.state}; expected ${expected}`
  );
  process.exit(1);
}
NODE
}

echo "[check-ts-adapter-deleted] verifying transport/stdio-ts-adapter retirement in ${LEDGER}"

require_ledger_state "transport/stdio-ts-adapter" "ts_deleted"

node - "$LEDGER" <<'NODE'
const [ledgerPath] = process.argv.slice(2);
const ledger = JSON.parse(require("node:fs").readFileSync(ledgerPath, "utf8"));
const http = ledger.capabilities.find((cap) => cap.id === "transport/web-mcp-http");
const rustAuthorityStates = new Set(["rust_impl", "authority_rust"]);
if (!http || !rustAuthorityStates.has(http.state)) {
  console.error(
    `[check-ts-adapter-deleted] transport/web-mcp-http is ${http?.state ?? "missing"}; expected rust_impl or authority_rust`
  );
  process.exit(1);
}
NODE

if [[ -f "${TS_ENTRY}" ]]; then
	echo "[check-ts-adapter-deleted] packages/mcp-server/src/index.ts must be deleted when transport/stdio-ts-adapter is ts_deleted" >&2
	exit 1
fi

if [[ -f "${TS_DIST}" ]]; then
	echo "[check-ts-adapter-deleted] packages/mcp-server/dist/index.js must be deleted when transport/stdio-ts-adapter is ts_deleted" >&2
	exit 1
fi

for bin_path in "${BIN}" "${PKG_BIN}"; do
	if [[ ! -f "${bin_path}" ]]; then
		echo "[check-ts-adapter-deleted] missing ${bin_path}" >&2
		exit 1
	fi

	if grep -q 'use_ts_transport' "${bin_path}"; then
		echo "[check-ts-adapter-deleted] ${bin_path} must not retain TS stdio opt-in after ts_deleted" >&2
		exit 1
	fi

	if grep -q 'CODERAG_MCP_TRANSPORT:-}" == "ts"' "${bin_path}"; then
		echo "[check-ts-adapter-deleted] ${bin_path} must not route CODERAG_MCP_TRANSPORT=ts after ts_deleted" >&2
		exit 1
	fi

	if grep -q 'packages/mcp-server/dist/index.js' "${bin_path}"; then
		echo "[check-ts-adapter-deleted] ${bin_path} must not launch node TS stdio adapter after ts_deleted" >&2
		exit 1
	fi
done

echo "[check-ts-adapter-deleted] PASS — transport/stdio-ts-adapter retired; Rust rmcp is sole MCP transport"