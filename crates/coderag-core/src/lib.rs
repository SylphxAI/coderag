//! CodeRAG Rust retrieval core (TF-IDF).

pub mod engine;
pub mod index;
pub mod store;
pub mod tokenize;
pub mod types;

pub use engine::handle_tool;
pub use types::{SearchHit, ENGINE_NAME, ENGINE_VERSION};

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::PathBuf;
    use std::sync::{Mutex, OnceLock};

    fn fixture_index_lock() -> &'static Mutex<()> {
        static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
        LOCK.get_or_init(|| Mutex::new(()))
    }

    fn fixture_root() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../fixtures/benchmark-corpus")
            .canonicalize()
            .expect("fixture corpus")
    }

    fn with_fixture_index_lock<T>(f: impl FnOnce() -> T) -> T {
        let _guard = fixture_index_lock()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        f()
    }

    #[test]
    fn indexes_fixture_corpus() {
        with_fixture_index_lock(|| {
            let (index, stats) = index::build_index(&fixture_root(), 1_048_576).expect("index");
            assert!(stats.chunks_indexed > 0);
            assert!(!index.chunks.is_empty());
        });
    }

    #[test]
    fn persists_and_reloads_index_snapshot() {
        with_fixture_index_lock(|| {
            // Isolate persist/reload from the shared fixture path so concurrent
            // workspace tests cannot observe a truncated rust-index.json.
            let tmp = std::env::temp_dir().join(format!(
                "coderag-core-persist-reload-{}",
                std::process::id()
            ));
            let _ = fs::remove_dir_all(&tmp);
            fs::create_dir_all(&tmp).expect("tmp root");
            // Minimal corpus: one indexable source file is enough for round-trip.
            fs::write(tmp.join("sample.ts"), "export function authenticate() { return true }\n")
                .expect("sample");
            let (index, _) = index::build_index(&tmp, 1_048_576).expect("index");
            store::save_index(&tmp, &index).expect("save");
            let loaded = store::load_index(&tmp).expect("load");
            assert_eq!(loaded.chunks.len(), index.chunks.len());
            assert_eq!(loaded.root, index.root);
            let _ = fs::remove_dir_all(&tmp);
        });
    }

    #[test]
    fn finds_auth_login_for_authentication_query() {
        with_fixture_index_lock(|| {
            let (index, _) = index::build_index(&fixture_root(), 1_048_576).expect("index");
            let hits = index::search_index(&index, "user authentication login", 5);
            assert!(!hits.is_empty());
            assert!(hits.iter().any(|hit| hit.path.contains("auth/login")));
        });
    }

    #[test]
    fn auto_mode_returns_cache_hit_when_inventory_is_unchanged() {
        with_fixture_index_lock(|| {
            let root = fixture_root();
            let first =
                index::refresh_index(&root, 1_048_576, index::IndexMode::Full).expect("index");
            let second =
                index::refresh_index(&root, 1_048_576, index::IndexMode::Auto).expect("refresh");
            assert_eq!(first.1.refresh_mode, "full");
            assert_eq!(second.1.refresh_mode, "cache_hit");
            assert_eq!(first.0.chunks.len(), second.0.chunks.len());
        });
    }

    #[test]
    fn search_hits_include_score_components() {
        with_fixture_index_lock(|| {
            let (index, _) = index::build_index(&fixture_root(), 1_048_576).expect("index");
            let hits = index::search_index(&index, "user authentication login", 1);
            assert!(!hits.is_empty());
            assert!(!hits[0].score_components.is_empty());
            assert!(hits[0].score_components.iter().any(|part| part.bm25 > 0.0));
        });
    }

    #[test]
    fn symbol_chunks_include_function_provenance() {
        with_fixture_index_lock(|| {
            let (index, _) = index::build_index(&fixture_root(), 1_048_576).expect("index");
            let symbol_chunks: Vec<_> = index
                .chunks
                .iter()
                .filter(|chunk| chunk.symbol_name.is_some())
                .collect();
            assert!(
                !symbol_chunks.is_empty(),
                "expected symbol-aware chunks in benchmark corpus"
            );
            assert!(symbol_chunks
                .iter()
                .any(|chunk| chunk.chunk_type == "function"));

            let hits = index::search_index(&index, "authenticate", 5);
            assert!(hits.iter().any(|hit| {
                hit.chunk_type.as_deref() == Some("function")
                    && hit.symbol_name.as_deref() == Some("authenticate")
            }));
        });
    }
}