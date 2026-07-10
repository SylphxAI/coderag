//! TRUE differential parity: TS rust-engine oracle vs Rust rmcp streamable HTTP tools/call.
//!
//! Bounded slice entrypoint (rej-010 cycle37):
//!   - `transport_web_mcp_http_differential_matches_ts_oracle` — codebase_search over HTTP
//!
//! Fail-closed — no SKIP-as-pass. Oracle subprocess must succeed before comparison.
//! See scripts/run-coderag-differential.sh and rej-010.

const HTTP_SLICE: &str = "transport/web-mcp-http";

use std::io::{BufRead, BufReader};
use std::net::TcpListener;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant};

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

fn free_port() -> u16 {
    TcpListener::bind("127.0.0.1:0")
        .expect("bind ephemeral port")
        .local_addr()
        .expect("local addr")
        .port()
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

struct HttpMcpServer {
    child: Child,
    base_url: String,
    session_headers: Vec<(String, String)>,
    initialized: bool,
}

impl HttpMcpServer {
    fn spawn(port: u16) -> Self {
        let cli = resolve_cli_binary();
        let mcp = resolve_mcp_binary();

        let child = Command::new(&mcp)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .env("CODERAG_MCP_TRANSPORT", "http")
            .env("MCP_HTTP_HOST", "127.0.0.1")
            .env("MCP_HTTP_PORT", port.to_string())
            .env("CODERAG_RUST_CLI", &cli)
            .spawn()
            .unwrap_or_else(|error| panic!("spawn rmcp HTTP server at {}: {error}", mcp.display()));

        let mut server = Self {
            child,
            base_url: format!("http://127.0.0.1:{port}/mcp"),
            session_headers: vec![
                ("Content-Type".to_string(), "application/json".to_string()),
                (
                    "Accept".to_string(),
                    "application/json, text/event-stream".to_string(),
                ),
            ],
            initialized: false,
        };

        server.wait_for_ready();
        server.initialize_session();
        server
    }

    fn wait_for_ready(&mut self) {
        let deadline = Instant::now() + Duration::from_secs(30);
        let ready_marker = "Streamable HTTP MCP listening on http://";

        let stderr = self
            .child
            .stderr
            .take()
            .expect("rmcp HTTP server stderr");
        let mut reader = BufReader::new(stderr);
        let mut line = String::new();

        while Instant::now() < deadline {
            line.clear();
            match reader.read_line(&mut line) {
                Ok(0) => std::thread::sleep(Duration::from_millis(50)),
                Ok(_) => {
                    if line.contains(ready_marker) {
                        std::thread::sleep(Duration::from_millis(200));
                        return;
                    }
                }
                Err(error) => panic!("read rmcp HTTP stderr: {error}"),
            }
        }

        panic!("timed out waiting for rmcp HTTP server ready marker");
    }

    fn post_mcp(&mut self, body: &Value) -> (u16, String, Option<String>, Option<String>) {
        let payload = serde_json::to_string(body).expect("serialize MCP body");
        let mut request = ureq::post(&self.base_url);
        for (key, value) in &self.session_headers {
            request = request.set(key, value);
        }
        let response = request
            .send_string(&payload)
            .unwrap_or_else(|error| panic!("HTTP POST to {} failed: {error}", self.base_url));

        let status = response.status();
        let session_id = response.header("mcp-session-id").map(str::to_string);
        let content_type = response.header("content-type").map(str::to_string);
        let body_text = response.into_string().expect("read HTTP response body");
        (status, body_text, session_id, content_type)
    }

    fn parse_mcp_response(&self, content_type: Option<&str>, body: &str) -> Value {
        if content_type.unwrap_or("").contains("application/json") {
            return serde_json::from_str(body).expect("parse JSON MCP response");
        }

        let data_lines: Vec<&str> = body
            .lines()
            .map(str::trim)
            .filter(|line| line.starts_with("data:"))
            .map(|line| line.trim_start_matches("data:").trim())
            .filter(|line| !line.is_empty())
            .collect();

        let payload = data_lines
            .last()
            .unwrap_or_else(|| panic!("no MCP JSON payload in streamable HTTP response: {body}"));
        serde_json::from_str(payload).expect("parse SSE MCP payload")
    }

    fn send_request(&mut self, method: &str, params: Value) -> Value {
        let id = REQUEST_ID.fetch_add(1, Ordering::Relaxed);
        let (status, body, session_id, content_type) = self.post_mcp(&json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": method,
            "params": params,
        }));
        assert_eq!(status, 200, "HTTP MCP request failed: status={status} body={body}");

        if let Some(session_id) = session_id {
            if !self
                .session_headers
                .iter()
                .any(|(name, _)| name.eq_ignore_ascii_case("mcp-session-id"))
            {
                self.session_headers
                    .push(("mcp-session-id".to_string(), session_id));
            }
        }

        self.parse_mcp_response(content_type.as_deref(), &body)
    }

    fn send_notification(&mut self, method: &str, params: Value) {
        let (status, body, _, _) = self.post_mcp(&json!({
            "jsonrpc": "2.0",
            "method": method,
            "params": params,
        }));
        assert!(
            status == 200 || status == 202,
            "HTTP MCP notification failed: status={status} body={body}"
        );
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
                "clientInfo": { "name": "http-differential", "version": "1.0.0" },
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

impl Drop for HttpMcpServer {
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

fn compare_codebase_search_case(client: &mut HttpMcpServer, case: &OracleCase) {
    assert_eq!(case.domain, "codebase_search");

    let result = client.call_codebase_search(&case.input.root, &case.input.query, case.input.limit);

    assert!(
        result.get("isError").and_then(Value::as_bool) != Some(true),
        "HTTP tools/call error for {}: {result}",
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
        "HTTP codebase_search differential mismatch for {}",
        case.id
    );
}

#[test]
fn transport_web_mcp_http_differential_matches_ts_oracle() {
    let oracle = load_oracle_from_env_or_subprocess();
    assert_eq!(oracle.corpus_version, 1);
    assert_eq!(oracle.profile, "coderag-retrieval-parity-v1");
    assert_eq!(oracle.route, "rust-tfidf");
    assert!(
        baseline_fixture_path().is_file(),
        "missing frozen baseline fixture"
    );

    let cases: Vec<_> = oracle
        .cases
        .iter()
        .filter(|case| case.slice == HTTP_SLICE)
        .collect();
    assert!(
        cases.len() >= 3,
        "slice {HTTP_SLICE} must have at least 3 oracle cases, got {}",
        cases.len()
    );

    let port = free_port();
    let mut client = HttpMcpServer::spawn(port);
    assert!(client.initialized, "HTTP transport requires initialize handshake");

    for case in cases {
        compare_codebase_search_case(&mut client, case);
    }
}