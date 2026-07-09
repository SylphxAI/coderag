use std::path::Path;
use std::sync::{Mutex, OnceLock};
use std::time::Instant;

use crate::index::{refresh_index, search_index, IndexMode, SearchIndex};
use crate::store::{load_index, save_index};
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
    let mode = input
        .get("mode")
        .and_then(|v| v.as_str())
        .map(IndexMode::parse)
        .unwrap_or(IndexMode::Auto);

    match refresh_index(Path::new(root), max_file_bytes, mode) {
        Ok((index, stats)) => {
            if let Err(message) = save_index(Path::new(root), &index) {
                return ToolEnvelope::error("INDEX_PERSIST_FAILED", &message);
            }
            if let Ok(mut guard) = index_store().lock() {
                *guard = Some(index);
            }
            ToolEnvelope::ok_index(stats)
        }
        Err(message) => ToolEnvelope::error("INDEX_FAILED", &message),
    }
}

fn resolve_index(root: Option<&str>) -> Result<SearchIndex, ToolEnvelope> {
    if let Ok(guard) = index_store().lock() {
        if let Some(index) = guard.clone() {
            if root.is_none() || root == Some(index.root.as_str()) {
                return Ok(index);
            }
        }
    }

    let Some(root) = root else {
        return Err(ToolEnvelope::error(
            "INDEX_NOT_FOUND",
            "No in-memory Rust index exists. Call coderag_index first or pass root to load a snapshot.",
        ));
    };

    match load_index(Path::new(root)) {
        Ok(index) => {
            if let Ok(mut guard) = index_store().lock() {
                *guard = Some(index.clone());
            }
            Ok(index)
        }
        Err(_) => match refresh_index(Path::new(root), 1_048_576, IndexMode::Auto) {
            Ok((index, _)) => {
                let _ = save_index(Path::new(root), &index);
                if let Ok(mut guard) = index_store().lock() {
                    *guard = Some(index.clone());
                }
                Ok(index)
            }
            Err(message) => Err(ToolEnvelope::error("INDEX_FAILED", &message)),
        },
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

    let root = input.get("root").and_then(|v| v.as_str());
    let index = match resolve_index(root) {
        Ok(index) => index,
        Err(envelope) => return envelope,
    };

    let results = search_index(&index, query, limit);
    ToolEnvelope::ok_search(query, results, started.elapsed().as_millis() as u64)
}