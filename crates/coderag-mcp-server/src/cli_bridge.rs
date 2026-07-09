use std::io::Write;
use std::path::PathBuf;
use std::process::{Command, Stdio};

use rmcp::model::CallToolResult;
use serde_json::Value;

#[derive(Debug, serde::Deserialize)]
struct CliSuccess {
    status: String,
    #[serde(flatten)]
    payload: Value,
}

#[derive(Debug, serde::Deserialize)]
struct CliError {
    status: String,
    message: Option<String>,
    code: Option<String>,
}

pub fn resolve_cli_binary() -> Option<PathBuf> {
    if let Ok(path) = std::env::var("CODERAG_RUST_CLI") {
        let candidate = PathBuf::from(path);
        if candidate.is_file() {
            return Some(candidate);
        }
    }

    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            if let Some(package_root) = parent.parent() {
                for candidate in [
                    package_root.join("target/release/coderag-cli"),
                    package_root.join("target/debug/coderag-cli"),
                    package_root.join("bin/native/coderag-cli"),
                ] {
                    if candidate.is_file() {
                        return Some(candidate);
                    }
                }
            }
        }
    }

    for candidate in [
        PathBuf::from("target/release/coderag-cli"),
        PathBuf::from("target/debug/coderag-cli"),
    ] {
        if candidate.is_file() {
            return Some(candidate);
        }
    }

    None
}

pub fn invoke_cli_tool(tool: &str, arguments: Value) -> Result<CallToolResult, rmcp::ErrorData> {
    let cli = resolve_cli_binary().ok_or_else(|| {
        rmcp::ErrorData::invalid_request(
            "coderag-cli is unavailable. Run `bun run build:rust`.",
            None,
        )
    })?;

    let request = serde_json::json!({ "tool": tool, "input": arguments });
    let payload = serde_json::to_string(&request).map_err(|error| {
        rmcp::ErrorData::internal_error(format!("Failed to serialize CLI request: {error}"), None)
    })?;

    let mut child = Command::new(cli)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| {
            rmcp::ErrorData::internal_error(format!("Failed to spawn coderag-cli: {error}"), None)
        })?;

    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(payload.as_bytes()).map_err(|error| {
            rmcp::ErrorData::internal_error(format!("Failed to write CLI request: {error}"), None)
        })?;
    }

    let output = child.wait_with_output().map_err(|error| {
        rmcp::ErrorData::internal_error(format!("coderag-cli failed: {error}"), None)
    })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(rmcp::ErrorData::internal_error(
            format!(
                "coderag-cli exited with status {:?}: {stderr}",
                output.status.code()
            ),
            None,
        ));
    }

    let stdout = String::from_utf8(output.stdout).map_err(|error| {
        rmcp::ErrorData::internal_error(
            format!("coderag-cli returned non-UTF8 output: {error}"),
            None,
        )
    })?;

    let envelope: Value = serde_json::from_str(&stdout).map_err(|error| {
        rmcp::ErrorData::internal_error(format!("coderag-cli returned invalid JSON: {error}"), None)
    })?;

    if envelope.get("status").and_then(Value::as_str) != Some("ok") {
        let message = envelope
            .get("message")
            .and_then(Value::as_str)
            .or_else(|| envelope.get("code").and_then(Value::as_str))
            .unwrap_or("coderag-cli returned an error envelope");
        return Err(rmcp::ErrorData::internal_error(message.to_string(), None));
    }

    Ok(CallToolResult::structured(envelope))
}