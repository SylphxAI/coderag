use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

use sha2::{Digest, Sha256};

use crate::index::{index_path, SearchIndex};

pub const INDEX_SCHEMA_VERSION: &str = "0.1.0";
pub const FILE_HASH_SCHEMA_VERSION: &str = "0.1.0";

#[derive(Debug, serde::Serialize, serde::Deserialize)]
struct PersistedIndex {
    schema_version: String,
    root: String,
    index: SearchIndex,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct FileHashManifest {
    pub schema_version: String,
    pub root: String,
    pub file_hashes: HashMap<String, String>,
}

pub fn file_hashes_path(root: &Path) -> PathBuf {
    root.join(".coderag").join("file-hashes.json")
}

pub fn hash_file_bytes(path: &Path) -> Result<String, String> {
    let bytes = fs::read(path).map_err(|err| format!("HASH_FAILED: {err}"))?;
    Ok(format!("{:x}", Sha256::digest(bytes)))
}

pub fn save_file_hashes(root: &Path, manifest: &FileHashManifest) -> Result<(), String> {
    let path = file_hashes_path(root);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|err| format!("HASH_PERSIST_FAILED: {err}"))?;
    }
    let bytes =
        serde_json::to_vec_pretty(manifest).map_err(|err| format!("HASH_PERSIST_FAILED: {err}"))?;
    fs::write(path, bytes).map_err(|err| format!("HASH_PERSIST_FAILED: {err}"))?;
    Ok(())
}

pub fn load_file_hashes(root: &Path) -> Result<FileHashManifest, String> {
    let path = file_hashes_path(root);
    let bytes = fs::read(&path).map_err(|err| format!("HASH_NOT_FOUND: {err}"))?;
    let manifest: FileHashManifest =
        serde_json::from_slice(&bytes).map_err(|err| format!("HASH_LOAD_FAILED: {err}"))?;

    if manifest.schema_version != FILE_HASH_SCHEMA_VERSION {
        return Err(format!(
            "HASH_VERSION_MISMATCH: expected {FILE_HASH_SCHEMA_VERSION}, got {}",
            manifest.schema_version
        ));
    }

    let canonical = root
        .canonicalize()
        .map_err(|err| format!("INVALID_ROOT: {err}"))?
        .to_string_lossy()
        .to_string();

    if manifest.root != canonical {
        return Err("HASH_ROOT_MISMATCH: persisted hash manifest belongs to a different repository root.".into());
    }

    Ok(manifest)
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