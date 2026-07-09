use std::path::Path;
use std::sync::{Mutex, OnceLock};
use std::time::Instant;

use crate::index::{build_index, search_index, SearchIndex};
use crate::types::ToolEnvelope;

static INDEX: OnceLock<Mutex<Option<SearchIndex>>> = OnceLock::new();

fn index_store() -> &'static Mutex<Option<SearchIndex>> {
    INDEX.get_or_init(|| Mutex::new(None))
}

pub fn handle_tool(tool: &str, input: serde_json::Value) -> ToolEnvelope {
    match tool {
        "coderag_index" => coderag_index(input),
        "coderag_search" => coderag_search(input),
        _ => ToolEnvelope::error("UNSUPPORTED_TOOL", &format!("Unknown tool: {tool}")),
    }
}

fn coderag_index(input: serde_json::Value) -> ToolEnvelope {
    let root = match input.get("root").and_then(|v| v.as_str()) {
        Some(value) => value,
        None => return ToolEnvelope::error("INVALID_ROOT", "Missing required field: root"),
    };
    let max_file_bytes = input
        .get("maxFileBytes")
        .and_then(|v| v.as_u64())
        .unwrap_or(1_048_576);

    match build_index(Path::new(root), max_file_bytes) {
        Ok((index, stats)) => {
            if let Ok(mut guard) = index_store().lock() {
                *guard = Some(index);
            }
            ToolEnvelope::ok_index(stats)
        }
        Err(message) => ToolEnvelope::error("INDEX_FAILED", &message),
    }
}

fn coderag_search(input: serde_json::Value) -> ToolEnvelope {
    let started = Instant::now();
    let query = match input.get("query").and_then(|v| v.as_str()) {
        Some(value) => value,
        None => return ToolEnvelope::error("INVALID_QUERY", "Missing required field: query"),
    };
    let limit = input
        .get("limit")
        .and_then(|v| v.as_u64())
        .unwrap_or(10) as usize;

    let index = match index_store().lock() {
        Ok(guard) => guard.clone(),
        Err(_) => None,
    };

    let Some(index) = index else {
        let root = input.get("root").and_then(|v| v.as_str());
        if let Some(root) = root {
            if let Ok((built, _)) = build_index(Path::new(root), 1_048_576) {
                let results = search_index(&built, query, limit);
                return ToolEnvelope::ok_search(query, results, started.elapsed().as_millis() as u64);
            }
        }
        return ToolEnvelope::error(
            "INDEX_NOT_FOUND",
            "No in-memory Rust index exists. Call coderag_index first.",
        );
    };

    let results = search_index(&index, query, limit);
    ToolEnvelope::ok_search(query, results, started.elapsed().as_millis() as u64)
}