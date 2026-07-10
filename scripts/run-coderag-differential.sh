#!/usr/bin/env bash
# coderag codebase_search + stdio transport differential parity — TS rust-engine oracle vs Rust rmcp.
# Fail-closed: requires bun + built Rust artifacts (no SKIP-as-pass).
# See PARITY-VERIFICATION-STANDARD.md, DECISION-001 / rej-010.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRATCH="${SCRATCH_DIR:-/tmp/coderag-stdio-differential}"
mkdir -p "$SCRATCH"
LOG="$SCRATCH/differential.log"
ARTIFACT="$SCRATCH/verification.json"
ORACLE_JSON="$SCRATCH/oracle.json"
SLICE_FILTER="all"
: >"$LOG"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --slice)
      SLICE_FILTER="${2:-}"
      shift 2
      ;;
    *)
      echo "::error::unknown argument: $1" | tee -a "$LOG"
      exit 1
      ;;
  esac
done

case "$SLICE_FILTER" in
  all|tool/codebase_search|transport/stdio-rust-rmcp|transport/web-mcp-http) ;;
  *)
    echo "::error::invalid --slice value: $SLICE_FILTER" | tee -a "$LOG"
    exit 1
    ;;
esac

cd "$REPO_ROOT"

if ! command -v bun >/dev/null 2>&1; then
  echo "::error::bun required for coderag differential parity — no SKIP-as-pass" | tee -a "$LOG"
  exit 1
fi

echo "=== coderag codebase_search + stdio + HTTP differential parity $(date -Iseconds) ===" | tee -a "$LOG"

echo "--- build Rust artifacts ---" | tee -a "$LOG"
cargo build --release -p coderag-core -p coderag-cli -p coderag-mcp-server 2>&1 | tee -a "$LOG"

echo "--- check-no-ts-stdio-backend gate ---" | tee -a "$LOG"
bash "$REPO_ROOT/scripts/check-no-ts-stdio-backend.sh" 2>&1 | tee -a "$LOG"

echo "--- check-no-ts-http-backend gate ---" | tee -a "$LOG"
bash "$REPO_ROOT/scripts/check-no-ts-http-backend.sh" 2>&1 | tee -a "$LOG"

echo "--- check-no-ts-codebase-search gate ---" | tee -a "$LOG"
bash "$REPO_ROOT/scripts/check-no-ts-codebase-search.sh" 2>&1 | tee -a "$LOG"

echo "--- TS rust-engine baseline oracle ---" | tee -a "$LOG"
bun run "$REPO_ROOT/scripts/differential/codebase-search-oracle.ts" >"$ORACLE_JSON" 2>>"$LOG"

run_rust_slice_test() {
  local label="$1"
  local test_name="$2"
  echo "--- Rust bounded slice: $label ---" | tee -a "$LOG"
  CODERAG_ORACLE_JSON="$ORACLE_JSON" \
    cargo test -p coderag-mcp-server --test stdio_codebase_search_differential "$test_name" -- --nocapture 2>&1 | tee -a "$LOG"
}

run_http_slice_test() {
  local label="$1"
  local test_name="$2"
  echo "--- Rust bounded slice: $label ---" | tee -a "$LOG"
  CODERAG_ORACLE_JSON="$ORACLE_JSON" \
    cargo test -p coderag-mcp-server --test http_codebase_search_differential "$test_name" -- --nocapture 2>&1 | tee -a "$LOG"
}

case "$SLICE_FILTER" in
  tool/codebase_search)
    run_rust_slice_test "tool/codebase_search" tool_codebase_search_differential_matches_ts_oracle
    ;;
  transport/stdio-rust-rmcp)
    run_rust_slice_test "transport/stdio-rust-rmcp" transport_stdio_rust_rmcp_differential_matches_ts_oracle
    ;;
  transport/web-mcp-http)
    run_http_slice_test "transport/web-mcp-http" transport_web_mcp_http_differential_matches_ts_oracle
    ;;
  all)
    run_rust_slice_test "tool/codebase_search" tool_codebase_search_differential_matches_ts_oracle
    run_rust_slice_test "transport/stdio-rust-rmcp" transport_stdio_rust_rmcp_differential_matches_ts_oracle
    run_http_slice_test "transport/web-mcp-http" transport_web_mcp_http_differential_matches_ts_oracle
    echo "--- Rust differential test (full corpus) ---" | tee -a "$LOG"
    CODERAG_ORACLE_JSON="$ORACLE_JSON" \
      cargo test -p coderag-mcp-server --test stdio_codebase_search_differential stdio_codebase_search_differential_matches_ts_oracle -- --nocapture 2>&1 | tee -a "$LOG"
    ;;
esac

CANDIDATE_SHA="${CANDIDATE_SHA:-$(git -C "$REPO_ROOT" rev-parse HEAD 2>/dev/null || echo unknown)}"
BASELINE_TS_SHA="$(git -C "$REPO_ROOT" log -1 --format=%H -- packages/mcp-server/src/rust-engine.ts fixtures/golden-retrieval-baseline.json 2>/dev/null || echo unknown)"
RUST_SHA="$CANDIDATE_SHA"
BEHAVIOR_SPEC_HASH="$(sha256sum "$REPO_ROOT/fixtures/golden-retrieval-baseline.json" 2>/dev/null | awk '{print $1}' || echo missing)"
FIXTURE_CORPUS_HASH="$(jq -r '.fixtureCorpusHash' "$ORACLE_JSON")"
CASE_COUNT="$(jq '.cases | length' "$ORACLE_JSON")"
TOOL_CASE_COUNT="$(jq '[.cases[] | select(.slice == "tool/codebase_search")] | length' "$ORACLE_JSON")"
STDIO_CASE_COUNT="$(jq '[.cases[] | select(.slice == "transport/stdio-rust-rmcp")] | length' "$ORACLE_JSON")"
HTTP_CASE_COUNT="$(jq '[.cases[] | select(.slice == "transport/web-mcp-http")] | length' "$ORACLE_JSON")"

jq -n \
  --arg verifiedAt "$(date -Iseconds)" \
  --arg candidateSha "$CANDIDATE_SHA" \
  --arg baselineTsSha "$BASELINE_TS_SHA" \
  --arg rustCandidateSha "$RUST_SHA" \
  --arg behaviorSpecHash "$BEHAVIOR_SPEC_HASH" \
  --arg fixtureCorpusHash "$FIXTURE_CORPUS_HASH" \
  --arg sliceFilter "$SLICE_FILTER" \
  --argjson caseCount "$CASE_COUNT" \
  --argjson toolCaseCount "$TOOL_CASE_COUNT" \
  --argjson stdioCaseCount "$STDIO_CASE_COUNT" \
  --argjson httpCaseCount "$HTTP_CASE_COUNT" \
  '{
    schemaVersion: 2,
    slice: (if $sliceFilter == "all" then "tool/codebase_search|transport/stdio-rust-rmcp|transport/web-mcp-http" else $sliceFilter end),
    sliceFilter: $sliceFilter,
    status: "differential_green",
    verifiedAt: $verifiedAt,
    lastComparedMainSha: $candidateSha,
    mergeGroupSha: $candidateSha,
    baselineTsSha: $baselineTsSha,
    rustCandidateSha: $rustCandidateSha,
    behaviorSpecHash: $behaviorSpecHash,
    fixtureCorpusHash: $fixtureCorpusHash,
    caseCount: $caseCount,
    toolCaseCount: $toolCaseCount,
    stdioCaseCount: $stdioCaseCount,
    httpCaseCount: $httpCaseCount,
    harness: "scripts/run-coderag-differential.sh",
    differentialTest: "crates/coderag-mcp-server/tests/stdio_codebase_search_differential.rs#tool_codebase_search_differential_matches_ts_oracle; transport_stdio_rust_rmcp_differential_matches_ts_oracle; crates/coderag-mcp-server/tests/http_codebase_search_differential.rs#transport_web_mcp_http_differential_matches_ts_oracle; stdio_codebase_search_differential_matches_ts_oracle",
    boundedSlices: {
      "tool/codebase_search": "crates/coderag-mcp-server/tests/stdio_codebase_search_differential.rs#tool_codebase_search_differential_matches_ts_oracle",
      "transport/stdio-rust-rmcp": "crates/coderag-mcp-server/tests/stdio_codebase_search_differential.rs#transport_stdio_rust_rmcp_differential_matches_ts_oracle",
      "transport/web-mcp-http": "crates/coderag-mcp-server/tests/http_codebase_search_differential.rs#transport_web_mcp_http_differential_matches_ts_oracle"
    },
    oracle: "scripts/differential/codebase-search-oracle.ts",
    gate: "scripts/check-no-ts-stdio-backend.sh; scripts/check-no-ts-http-backend.sh; scripts/check-no-ts-codebase-search.sh"
  }' >"$ARTIFACT"

echo "coderag-differential: OK (cases=$CASE_COUNT tool=$TOOL_CASE_COUNT stdio=$STDIO_CASE_COUNT http=$HTTP_CASE_COUNT corpus=$FIXTURE_CORPUS_HASH)" | tee -a "$LOG"
echo "verification artifact: $ARTIFACT" | tee -a "$LOG"