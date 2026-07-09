use serde::{Deserialize, Serialize};

pub const ENGINE_NAME: &str = "coderag-core";
pub const ENGINE_VERSION: &str = "0.1.0";

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchHit {
    pub path: String,
    pub score: f64,
    pub matched_terms: Vec<String>,
    pub start_line: Option<u32>,
    pub end_line: Option<u32>,
    pub snippet: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexStats {
    pub files_scanned: usize,
    pub chunks_indexed: usize,
    pub elapsed_ms: u64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchStats {
    pub elapsed_ms: u64,
    pub route: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolEnvelope {
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub query: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub results: Option<Vec<SearchHit>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub index: Option<IndexStats>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub search: Option<SearchStats>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

impl ToolEnvelope {
    pub fn ok_search(query: &str, results: Vec<SearchHit>, elapsed_ms: u64) -> Self {
        Self {
            status: "ok".into(),
            query: Some(query.into()),
            results: Some(results),
            index: None,
            search: Some(SearchStats {
                elapsed_ms,
                route: "rust-tfidf".into(),
            }),
            code: None,
            message: None,
        }
    }

    pub fn ok_index(stats: IndexStats) -> Self {
        Self {
            status: "ok".into(),
            query: None,
            results: None,
            index: Some(stats),
            search: None,
            code: None,
            message: None,
        }
    }

    pub fn error(code: &str, message: &str) -> Self {
        Self {
            status: "error".into(),
            query: None,
            results: None,
            index: None,
            search: None,
            code: Some(code.into()),
            message: Some(message.into()),
        }
    }
}