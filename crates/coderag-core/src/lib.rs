//! CodeRAG Rust retrieval core (TF-IDF).

pub mod engine;
pub mod index;
pub mod tokenize;
pub mod types;

pub use engine::handle_tool;
pub use types::{SearchHit, ENGINE_NAME, ENGINE_VERSION};

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn fixture_root() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../fixtures/benchmark-corpus")
            .canonicalize()
            .expect("fixture corpus")
    }

    #[test]
    fn indexes_fixture_corpus() {
        let (index, stats) = index::build_index(&fixture_root(), 1_048_576).expect("index");
        assert!(stats.chunks_indexed > 0);
        assert!(!index.chunks.is_empty());
    }

    #[test]
    fn finds_auth_login_for_authentication_query() {
        let (index, _) = index::build_index(&fixture_root(), 1_048_576).expect("index");
        let hits = index::search_index(&index, "user authentication login", 5);
        assert!(!hits.is_empty());
        assert!(hits.iter().any(|hit| hit.path.contains("auth/login")));
    }
}