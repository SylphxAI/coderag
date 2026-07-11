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
	python3 - "$LEDGER" "$capability" "$expected" <<'PY'
import json
import sys

ledger_path, capability, expected = sys.argv[1:4]
with open(ledger_path, encoding="utf-8") as handle:
    ledger = json.load(handle)
entry = next((cap for cap in ledger.get("capabilities", []) if cap.get("id") == capability), None)
if entry is None:
    print(f"[check-ts-adapter-deleted] missing capability {capability}", file=sys.stderr)
    sys.exit(1)
if entry.get("state") != expected:
    print(
        f"[check-ts-adapter-deleted] {capability} is {entry.get('state')}; expected {expected}",
        file=sys.stderr,
    )
    sys.exit(1)
PY
}

echo "[check-ts-adapter-deleted] verifying transport/stdio-ts-adapter retirement in ${LEDGER}"

require_ledger_state "transport/stdio-ts-adapter" "ts_deleted"

python3 - "$LEDGER" <<'PY'
import json
import sys

ledger_path = sys.argv[1]
with open(ledger_path, encoding="utf-8") as handle:
    ledger = json.load(handle)
http = next(
    (cap for cap in ledger.get("capabilities", []) if cap.get("id") == "transport/web-mcp-http"),
    None,
)
rust_authority_states = {"rust_impl", "authority_rust", "ts_deleted"}
if http is None or http.get("state") not in rust_authority_states:
    state = http.get("state") if http else "missing"
    print(
        f"[check-ts-adapter-deleted] transport/web-mcp-http is {state}; expected rust_impl, authority_rust, or ts_deleted",
        file=sys.stderr,
    )
    sys.exit(1)
PY

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
