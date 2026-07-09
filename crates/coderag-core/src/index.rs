use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Instant;

use regex::Regex;
use walkdir::WalkDir;

use crate::store::{
    hash_file_bytes, load_file_hashes, load_index, save_file_hashes, save_index, FileHashManifest,
};
use crate::tokenize::{tokenize, unique_terms};
use crate::types::{IndexStats, ScoreComponent};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Chunk {
    pub path: String,
    pub start_line: u32,
    pub end_line: u32,
    pub text: String,
    pub tokens: Vec<String>,
}

#[derive(Debug, Default, Clone, serde::Serialize, serde::Deserialize)]
pub struct SearchIndex {
    pub root: String,
    pub chunks: Vec<Chunk>,
    pub doc_freq: HashMap<String, usize>,
    pub avg_doc_len: f64,
}

const DEFAULT_EXCLUDES: &[&str] = &["node_modules", "dist", "target", ".git"];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IndexMode {
    Full,
    Auto,
}

impl IndexMode {
    pub fn parse(value: &str) -> Self {
        match value {
            "full" => Self::Full,
            _ => Self::Auto,
        }
    }
}

pub fn refresh_index(
    root: &Path,
    max_file_bytes: u64,
    mode: IndexMode,
) -> Result<(SearchIndex, IndexStats), String> {
    if mode == IndexMode::Full {
        return build_index(root, max_file_bytes);
    }

    let started = Instant::now();
    let canonical = root
        .canonicalize()
        .map_err(|e| format!("INVALID_ROOT: {e}"))?;
    let inventory = inventory_files(&canonical, max_file_bytes)?;

    if let (Ok(index), Ok(stored)) = (load_index(&canonical), load_file_hashes(&canonical)) {
        if stored.file_hashes == inventory {
            return Ok((
                index.clone(),
                IndexStats {
                    files_scanned: inventory.len(),
                    chunks_indexed: index.chunks.len(),
                    elapsed_ms: started.elapsed().as_millis() as u64,
                    refresh_mode: "cache_hit".into(),
                    files_changed: 0,
                    files_removed: 0,
                },
            ));
        }

        let mut changed = HashSet::new();
        let mut removed = HashSet::new();

        for (path, hash) in &inventory {
            match stored.file_hashes.get(path) {
                Some(previous) if previous == hash => {}
                _ => {
                    changed.insert(path.clone());
                }
            }
        }

        for path in stored.file_hashes.keys() {
            if !inventory.contains_key(path) {
                removed.insert(path.clone());
            }
        }

        let files_changed = changed.len();
        let files_removed = removed.len();
        let affected: HashSet<String> = changed.union(&removed).cloned().collect();
        let mut index = index;
        index
            .chunks
            .retain(|chunk| !affected.contains(&chunk.path));

        for path in &changed {
            let file_path = canonical.join(path);
            let content = fs::read_to_string(&file_path).unwrap_or_default();
            index.chunks.extend(chunk_file(path, &content));
        }

        rebuild_doc_freq(&mut index);
        let chunks_indexed = index.chunks.len();

        let manifest = FileHashManifest {
            schema_version: crate::store::FILE_HASH_SCHEMA_VERSION.into(),
            root: canonical.to_string_lossy().to_string(),
            file_hashes: inventory.clone(),
        };
        save_index(&canonical, &index)?;
        save_file_hashes(&canonical, &manifest)?;

        return Ok((
            index,
            IndexStats {
                files_scanned: inventory.len(),
                chunks_indexed,
                elapsed_ms: started.elapsed().as_millis() as u64,
                refresh_mode: "incremental".into(),
                files_changed,
                files_removed,
            },
        ));
    }

    build_index(root, max_file_bytes)
}

pub fn inventory_files(root: &Path, max_file_bytes: u64) -> Result<HashMap<String, String>, String> {
    let mut inventory = HashMap::new();

    for entry in WalkDir::new(root).into_iter().filter_map(Result::ok) {
        let path = entry.path();
        if path.is_dir() {
            continue;
        }
        let rel = path.strip_prefix(root).unwrap_or(path);
        let rel_str = rel.to_string_lossy().replace('\\', "/");
        if should_skip(&rel_str) || !is_indexable_extension(&rel_str) {
            continue;
        }
        if let Ok(meta) = fs::metadata(path) {
            if meta.len() > max_file_bytes {
                continue;
            }
        }
        let hash = hash_file_bytes(path)?;
        inventory.insert(rel_str, hash);
    }

    Ok(inventory)
}

fn is_indexable_extension(rel: &str) -> bool {
    rel.ends_with(".ts")
        || rel.ends_with(".tsx")
        || rel.ends_with(".js")
        || rel.ends_with(".rs")
        || rel.ends_with(".md")
}

fn rebuild_doc_freq(index: &mut SearchIndex) {
    index.doc_freq.clear();
    let mut total_len = 0usize;
    for chunk in &index.chunks {
        total_len += chunk.tokens.len();
        for term in unique_terms(&chunk.tokens) {
            *index.doc_freq.entry(term).or_insert(0) += 1;
        }
    }
    index.avg_doc_len = if index.chunks.is_empty() {
        0.0
    } else {
        total_len as f64 / index.chunks.len() as f64
    };
}

pub fn build_index(root: &Path, max_file_bytes: u64) -> Result<(SearchIndex, IndexStats), String> {
    let started = Instant::now();
    let root = root
        .canonicalize()
        .map_err(|e| format!("INVALID_ROOT: {e}"))?;
    let mut index = SearchIndex {
        root: root.to_string_lossy().to_string(),
        ..Default::default()
    };
    let mut files_scanned = 0usize;

    for entry in WalkDir::new(&root).into_iter().filter_map(Result::ok) {
        let path = entry.path();
        if path.is_dir() {
            continue;
        }
        let rel = path.strip_prefix(&root).unwrap_or(path);
        let rel_str = rel.to_string_lossy().replace('\\', "/");
        if should_skip(&rel_str) {
            continue;
        }
        if !is_indexable_extension(&rel_str) {
            continue;
        }
        if let Ok(meta) = fs::metadata(path) {
            if meta.len() > max_file_bytes {
                continue;
            }
        }
        files_scanned += 1;
        let content = fs::read_to_string(path).unwrap_or_default();
        index.chunks.extend(chunk_file(&rel_str, &content));
    }

    let mut total_len = 0usize;
    for chunk in &index.chunks {
        total_len += chunk.tokens.len();
        for term in unique_terms(&chunk.tokens) {
            *index.doc_freq.entry(term).or_insert(0) += 1;
        }
    }
    index.avg_doc_len = if index.chunks.is_empty() {
        0.0
    } else {
        total_len as f64 / index.chunks.len() as f64
    };

    let chunks_indexed = index.chunks.len();
    let inventory = inventory_files(&root, max_file_bytes)?;
    let manifest = FileHashManifest {
        schema_version: crate::store::FILE_HASH_SCHEMA_VERSION.into(),
        root: root.to_string_lossy().to_string(),
        file_hashes: inventory,
    };
    save_file_hashes(&root, &manifest)?;

    Ok((
        index,
        IndexStats {
            files_scanned,
            chunks_indexed,
            elapsed_ms: started.elapsed().as_millis() as u64,
            refresh_mode: "full".into(),
            files_changed: files_scanned,
            files_removed: 0,
        },
    ))
}

fn should_skip(rel: &str) -> bool {
    rel.split('/').any(|part| DEFAULT_EXCLUDES.contains(&part))
}

fn chunk_file(path: &str, content: &str) -> Vec<Chunk> {
    let export_re = Regex::new(r"(?m)^(export\s+)?(async\s+)?function\s+(\w+)").unwrap();
    let lines: Vec<&str> = content.lines().collect();
    let mut spans = Vec::new();
    for cap in export_re.captures_iter(content) {
        let name = cap.get(3).map(|m| m.as_str()).unwrap_or("chunk");
        let start_byte = cap.get(0).map(|m| m.start()).unwrap_or(0);
        let start_line = content[..start_byte].matches('\n').count() as u32 + 1;
        let end_line = (start_line + 12).min(lines.len() as u32);
        spans.push((name, start_line, end_line));
    }

    if spans.is_empty() {
        return vec![Chunk {
            path: path.into(),
            start_line: 1,
            end_line: lines.len().max(1) as u32,
            text: content.to_string(),
            tokens: tokenize(content),
        }];
    }

    spans
        .into_iter()
        .map(|(name, start_line, end_line)| {
            let snippet: String = lines
                .get((start_line as usize).saturating_sub(1)..end_line as usize)
                .unwrap_or(&[])
                .join("\n");
            Chunk {
                path: path.into(),
                start_line,
                end_line,
                text: snippet.clone(),
                tokens: tokenize(&format!("{name} {snippet}")),
            }
        })
        .collect()
}

pub fn search_index(index: &SearchIndex, query: &str, limit: usize) -> Vec<crate::types::SearchHit> {
    let query_terms = tokenize(query);
    if query_terms.is_empty() || index.chunks.is_empty() {
        return vec![];
    }

    let n_docs = index.chunks.len() as f64;
    let k1 = 1.2;
    let b = 0.75;

    let mut scored = Vec::new();
    for chunk in &index.chunks {
        let mut score = 0.0;
        let mut matched = Vec::new();
        let doc_len = chunk.tokens.len() as f64;
        let mut term_freq: HashMap<String, usize> = HashMap::new();
        for token in &chunk.tokens {
            *term_freq.entry(token.clone()).or_insert(0) += 1;
        }

        let mut score_components = Vec::new();
        for term in &query_terms {
            let tf = *term_freq.get(term).unwrap_or(&0) as f64;
            if tf == 0.0 {
                continue;
            }
            matched.push(term.clone());
            let df = *index.doc_freq.get(term).unwrap_or(&1) as f64;
            let idf = ((n_docs - df + 0.5) / (df + 0.5) + 1.0).ln();
            let numerator = tf * (k1 + 1.0);
            let denominator = tf + k1 * (1.0 - b + b * (doc_len / index.avg_doc_len.max(1.0)));
            let bm25 = idf * (numerator / denominator);
            score += bm25;
            score_components.push(ScoreComponent {
                term: term.clone(),
                term_frequency: tf,
                document_frequency: df,
                idf,
                bm25,
            });
        }

        if score > 0.0 {
            scored.push(crate::types::SearchHit {
                path: chunk.path.clone(),
                score,
                matched_terms: matched,
                score_components,
                start_line: Some(chunk.start_line),
                end_line: Some(chunk.end_line),
                snippet: Some(chunk.text.clone()),
            });
        }
    }

    scored.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
    scored.truncate(limit);
    scored
}

pub fn index_path(root: &Path) -> PathBuf {
    root.join(".coderag").join("rust-index.json")
}