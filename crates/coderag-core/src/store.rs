use std::fs;
use std::path::Path;

use crate::index::{index_path, SearchIndex};

pub const INDEX_SCHEMA_VERSION: &str = "0.1.0";

#[derive(Debug, serde::Serialize, serde::Deserialize)]
struct PersistedIndex {
    schema_version: String,
    root: String,
    index: SearchIndex,
}

pub fn save_index(root: &Path, index: &SearchIndex) -> Result<(), String> {
    let path = index_path(root);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|err| format!("INDEX_PERSIST_FAILED: {err}"))?;
    }

    let snapshot = PersistedIndex {
        schema_version: INDEX_SCHEMA_VERSION.into(),
        root: index.root.clone(),
        index: index.clone(),
    };
    let bytes = serde_json::to_vec(&snapshot).map_err(|err| format!("INDEX_PERSIST_FAILED: {err}"))?;
    fs::write(&path, bytes).map_err(|err| format!("INDEX_PERSIST_FAILED: {err}"))?;
    Ok(())
}

pub fn load_index(root: &Path) -> Result<SearchIndex, String> {
    let path = index_path(root);
    let bytes = fs::read(&path).map_err(|err| format!("INDEX_NOT_FOUND: {err}"))?;
    let snapshot: PersistedIndex =
        serde_json::from_slice(&bytes).map_err(|err| format!("INDEX_LOAD_FAILED: {err}"))?;

    if snapshot.schema_version != INDEX_SCHEMA_VERSION {
        return Err(format!(
            "INDEX_VERSION_MISMATCH: expected {INDEX_SCHEMA_VERSION}, got {}",
            snapshot.schema_version
        ));
    }

    let canonical = root
        .canonicalize()
        .map_err(|err| format!("INVALID_ROOT: {err}"))?
        .to_string_lossy()
        .to_string();

    if snapshot.root != canonical {
        return Err("INDEX_ROOT_MISMATCH: persisted snapshot belongs to a different repository root.".into());
    }

    Ok(snapshot.index)
}