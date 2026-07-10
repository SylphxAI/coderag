//! TRUE differential parity: TS rust-engine oracle vs Rust rmcp stdio tools/call.
//!
//! Bounded slice entrypoints (rej-010 cycle29):
//! - `tool_codebase_search_differential_matches_ts_oracle` — S4 codebase_search retrieval
//! - `transport_stdio_rust_rmcp_differential_matches_ts_oracle` — S5 rmcp stdio transport
//!
//! Fail-closed — no SKIP-as-pass. Oracle subprocess must succeed before comparison.
//! See scripts/run-coderag-differential.sh and rej-010 pilot re-audit.

const TOOL_SLICE: &str = "tool/codebase_search";
const TRANSPORT_SLICE: &str = "transport/stdio-rust-rmcp";

use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{ChildStdout, Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;

use serde::Deserialize;
use serde_json::{json, Value};

static REQUEST_ID: AtomicU64 = AtomicU64::new(1);

fn repo_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..")
}

fn baseline_fixture_path() -> PathBuf {
    repo_root().join("fixtures/golden-retrieval-baseline.json")
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

fn resolve_mcp_binary() -> PathBuf {
    for relative in [
        "target/release/coderag-mcp-server",
        "target/debug/coderag-mcp-server",
        "bin/native/coderag-mcp-server",
    ] {
        let candidate = repo_root().join(relative);
        if candidate.is_file() {
            return candidate;
        }
    }
    panic!("coderag-mcp-server is not built; run `cargo build --release -p coderag-mcp-server`");
}

#[derive(Debug, Deserialize)]
struct OracleCase {
    id: String,
    slice: String,
    domain: String,
    input: OracleInput,
    output: OracleOutput,
}

#[derive(Debug, Deserialize)]
struct OracleInput {
    root: String,
    query: String,
    limit: u64,
}

#[derive(Debug, Deserialize)]
struct OracleOutput {
    status: String,
    route: String,
    paths: Vec<String>,
    #[serde(rename = "minResults")]
    min_results: usize,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OracleCorpus {
    corpus_version: u32,
    fixture_corpus_hash: String,
    profile: String,
    route: String,
    corpus_root: String,
    cases: Vec<OracleCase>,
}

fn load_oracle_from_env_or_subprocess() -> OracleCorpus {
    if let Ok(path) = std::env::var("CODERAG_ORACLE_JSON") {
        let raw = std::fs::read_to_string(&path)
            .unwrap_or_else(|error| panic!("read oracle json at {path}: {error}"));
        return serde_json::from_str(&raw).expect("parse oracle json from env path");
    }

    let script = repo_root().join("scripts/differential/codebase-search-oracle.ts");
    let output = Command::new("bun")
        .arg("run")
        .arg(&script)
        .current_dir(repo_root())
        .output()
        .unwrap_or_else(|error| panic!("spawn TS oracle at {}: {error}", script.display()));

    assert!(
        output.status.success(),
        "TS oracle failed:\nstdout: {}\nstderr: {}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );

    serde_json::from_slice(&output.stdout).expect("oracle output must be valid JSON")
}

struct StdioMcpClient {
    child: std::process::Child,
    stdin: std::process::ChildStdin,
    stdout: BufReader<ChildStdout>,
    initialized: bool,
}

impl StdioMcpClient {
    fn spawn() -> Self {
        let cli = resolve_cli_binary();
        let mcp = resolve_mcp_binary();

        let mut child = Command::new(&mcp)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .env("CODERAG_RUST_CLI", &cli)
            .spawn()
            .unwrap_or_else(|error| panic!("spawn rmcp stdio server at {}: {error}", mcp.display()));

        let stdout = child
            .stdout
            .take()
            .expect("rmcp stdio server stdout");
        let stdin = child.stdin.take().expect("rmcp stdio server stdin");

        let mut client = Self {
            child,
            stdin,
            stdout: BufReader::new(stdout),
            initialized: false,
        };

        client.initialize_session();
        client
    }

    fn write_message(&mut self, message: &Value) {
        let payload = serde_json::to_string(message).expect("serialize MCP message");
        writeln!(self.stdin, "{payload}").expect("write MCP message to stdin");
        self.stdin.flush().expect("flush MCP stdin");
    }

    fn read_response(&mut self, id: u64) -> Value {
        let deadline = std::time::Instant::now() + Duration::from_secs(60);
        let mut line = String::new();

        loop {
            if std::time::Instant::now() > deadline {
                panic!("timed out waiting for MCP response id={id}");
            }

            line.clear();
            match self.stdout.read_line(&mut line) {
                Ok(0) => panic!("rmcp stdio server closed stdout while waiting for id={id}"),
                Ok(_) => {}
                Err(error) => panic!("read rmcp stdio stdout: {error}"),
            }

            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }

            let payload: Value = serde_json::from_str(trimmed)
                .unwrap_or_else(|error| panic!("parse MCP stdout line `{trimmed}`: {error}"));

            if payload.get("id").and_then(Value::as_u64) == Some(id) {
                return payload;
            }
        }
    }

    fn send_request(&mut self, method: &str, params: Value) -> Value {
        let id = REQUEST_ID.fetch_add(1, Ordering::Relaxed);
        self.write_message(&json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": method,
            "params": params,
        }));
        self.read_response(id)
    }

    fn send_notification(&mut self, method: &str, params: Value) {
        self.write_message(&json!({
            "jsonrpc": "2.0",
            "method": method,
            "params": params,
        }));
    }

    fn is_initialized(&self) -> bool {
        self.initialized
    }

    fn initialize_session(&mut self) {
        if self.initialized {
            return;
        }

        let response = self.send_request(
            "initialize",
            json!({
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": { "name": "stdio-differential", "version": "1.0.0" },
            }),
        );

        let server_info = response
            .pointer("/result/serverInfo/name")
            .and_then(Value::as_str)
            .unwrap_or_default();
        assert_eq!(
            server_info, "coderag-mcp",
            "initialize must identify coderag-mcp rmcp server"
        );

        self.send_notification("notifications/initialized", json!({}));
        self.initialized = true;
    }

    fn call_codebase_search(&mut self, root: &str, query: &str, limit: u64) -> Value {
        let response = self.send_request(
            "tools/call",
            json!({
                "name": "codebase_search",
                "arguments": {
                    "root": root,
                    "query": query,
                    "limit": limit,
                },
            }),
        );

        response
            .get("result")
            .cloned()
            .unwrap_or_else(|| panic!("tools/call missing result: {response}"))
    }
}

impl Drop for StdioMcpClient {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

fn relative_paths(root: &str, results: &[Value]) -> Vec<String> {
    let prefix = format!("{root}/");
    results
        .iter()
        .filter_map(|hit| hit.get("path").and_then(Value::as_str))
        .map(|path| {
            if path.starts_with(&prefix) {
                path[prefix.len()..].to_string()
            } else {
                path.to_string()
            }
        })
        .collect()
}

fn assert_oracle_metadata(oracle: &OracleCorpus) {
    assert_eq!(oracle.corpus_version, 1);
    assert_eq!(oracle.profile, "coderag-retrieval-parity-v1");
    assert_eq!(oracle.route, "rust-tfidf");
    assert!(
        baseline_fixture_path().is_file(),
        "missing frozen baseline fixture"
    );
    assert!(
        !oracle.fixture_corpus_hash.is_empty(),
        "oracle must emit fixtureCorpusHash"
    );
}

fn cases_for_slice<'a>(oracle: &'a OracleCorpus, slice: &str) -> Vec<&'a OracleCase> {
    oracle
        .cases
        .iter()
        .filter(|case| case.slice == slice)
        .collect()
}

fn compare_codebase_search_case(client: &mut StdioMcpClient, case: &OracleCase) {
    assert_eq!(case.domain, "codebase_search");

    let result = client.call_codebase_search(&case.input.root, &case.input.query, case.input.limit);

    assert!(
        result.get("isError").and_then(Value::as_bool) != Some(true),
        "stdio tools/call error for {}: {result}",
        case.id
    );

    let structured = result
        .get("structuredContent")
        .expect("structuredContent present");

    assert_eq!(
        structured.get("status").and_then(Value::as_str),
        Some(case.output.status.as_str()),
        "status mismatch for {}",
        case.id
    );
    assert_eq!(
        structured.get("route").and_then(Value::as_str),
        Some(case.output.route.as_str()),
        "route mismatch for {}",
        case.id
    );

    let results = structured
        .get("results")
        .and_then(Value::as_array)
        .expect("results array");
    assert!(
        results.len() >= case.output.min_results,
        "{}: expected >= {} hits, got {}",
        case.id,
        case.output.min_results,
        results.len()
    );

    let paths = relative_paths(&case.input.root, results);
    assert_eq!(
        paths, case.output.paths,
        "stdio codebase_search differential mismatch for {}",
        case.id
    );
}

fn run_bounded_slice(slice: &str, min_cases: usize, assert_transport: bool) {
    let oracle = load_oracle_from_env_or_subprocess();
    assert_oracle_metadata(&oracle);

    let cases = cases_for_slice(&oracle, slice);
    assert!(
        cases.len() >= min_cases,
        "slice {slice} must have at least {min_cases} oracle cases, got {}",
        cases.len()
    );

    let mut client = StdioMcpClient::spawn();
    if assert_transport {
        assert!(
            client.is_initialized(),
            "transport slice requires rmcp initialize handshake before tools/call"
        );
    }

    for case in cases {
        compare_codebase_search_case(&mut client, case);
    }
}

#[test]
fn tool_codebase_search_differential_matches_ts_oracle() {
    run_bounded_slice(TOOL_SLICE, 3, false);
}

#[test]
fn transport_stdio_rust_rmcp_differential_matches_ts_oracle() {
    run_bounded_slice(TRANSPORT_SLICE, 3, true);
}

#[test]
fn stdio_codebase_search_differential_matches_ts_oracle() {
    let oracle = load_oracle_from_env_or_subprocess();
    assert_oracle_metadata(&oracle);

    let mut client = StdioMcpClient::spawn();
    for case in &oracle.cases {
        compare_codebase_search_case(&mut client, case);
    }
}