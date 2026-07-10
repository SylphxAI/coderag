//! MCP tool parity: codebase_search must match the frozen golden baseline.

use std::path::PathBuf;

use coderag_mcp_server::codebase_search;
use serde_json::json;

fn repo_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..")
}

fn resolve_cli_binary() -> PathBuf {
    for relative in ["target/release/coderag-cli", "target/debug/coderag-cli"] {
        let candidate = repo_root().join(relative);
        if candidate.is_file() {
            return candidate;
        }
    }
    panic!("coderag-cli is not built; run `cargo build --release -p coderag-cli`");
}

fn fixture_root() -> PathBuf {
    repo_root().join("fixtures/benchmark-corpus")
}

#[test]
fn codebase_search_matches_golden_baseline_paths() {
    // SAFETY: test-only single-threaded env mutation.
    unsafe {
        std::env::set_var("CODERAG_RUST_CLI", resolve_cli_binary());
    }

    let root = fixture_root();
    let root_str = root.to_string_lossy();

    let cases = [
        (
            "auth-login",
            "user authentication login",
            "src/auth/login.ts",
        ),
        (
            "db-pool",
            "database connection pool",
            "src/db/pool.ts",
        ),
        (
            "rate-limit",
            "checkRateLimit windowMs",
            "src/api/rate-limit.ts",
        ),
    ];

    for (id, query, expected_top) in cases {
        let result = codebase_search::codebase_search(json!({
            "root": root_str,
            "query": query,
            "limit": 5,
        }))
        .unwrap_or_else(|error| panic!("{id}: codebase_search failed: {error:?}"));

        let structured = result
            .structured_content
            .expect("structured_content should be present");

        assert_eq!(
            structured.get("status").and_then(|value| value.as_str()),
            Some("ok"),
            "{id}: expected ok status"
        );
        assert_eq!(
            structured.get("route").and_then(|value| value.as_str()),
            Some(codebase_search::CODEBASE_SEARCH_ROUTE),
            "{id}: route must be rust-tfidf"
        );

        let results = structured
            .get("results")
            .and_then(|value| value.as_array())
            .expect("results array");
        assert!(!results.is_empty(), "{id}: expected at least one hit");

        let top_path = results[0]
            .get("path")
            .and_then(|value| value.as_str())
            .expect("top hit path");
        assert!(
            top_path.ends_with(expected_top),
            "{id}: expected top hit {expected_top}, got {top_path}"
        );
    }
}