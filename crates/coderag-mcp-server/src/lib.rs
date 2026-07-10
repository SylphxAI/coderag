pub mod cli_bridge;
pub mod codebase_search;
pub mod http_transport;
pub mod tool_routes;

use rmcp::{
    handler::server::router::tool::ToolRouter,
    handler::server::wrapper::Parameters,
    model::{Implementation, ServerCapabilities, ServerInfo},
    tool, tool_handler, tool_router, ErrorData, ServerHandler,
};
use serde_json::Value;

pub const SERVER_NAME: &str = "coderag-mcp";
pub const SERVER_VERSION: &str = "0.3.33";
pub const SERVER_INSTRUCTIONS: &str =
    "CodeRAG MCP server (Rust rmcp transport). Use codebase_search for deterministic Rust TF-IDF retrieval with score explainability.";

#[derive(Clone)]
pub struct CoderagMcp {
    pub tool_router: ToolRouter<Self>,
}

impl CoderagMcp {
    pub fn new() -> Self {
        Self {
            tool_router: Self::tool_router(),
        }
    }
}

#[tool_router]
impl CoderagMcp {
    #[tool(
        description = "Search the codebase with Rust TF-IDF retrieval. Returns ranked hits with path, score, matched terms, and score components."
    )]
    pub fn codebase_search(
        &self,
        Parameters(args): Parameters<Value>,
    ) -> Result<rmcp::model::CallToolResult, ErrorData> {
        codebase_search::codebase_search(args)
    }
}

#[tool_handler]
impl ServerHandler for CoderagMcp {
    fn get_info(&self) -> ServerInfo {
        ServerInfo {
            protocol_version: rmcp::model::ProtocolVersion::default(),
            capabilities: ServerCapabilities::builder().enable_tools().build(),
            server_info: Implementation {
                name: SERVER_NAME.into(),
                title: None,
                version: SERVER_VERSION.into(),
                description: Some(
                    "Rust-native MCP server for coderag (modelcontextprotocol/rust-sdk rmcp)".into(),
                ),
                icons: None,
                website_url: Some("https://github.com/SylphxAI/coderag".into()),
            },
            instructions: Some(SERVER_INSTRUCTIONS.into()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::CoderagMcp;
    use std::fs;
    use std::path::PathBuf;

    #[test]
    fn rmcp_server_sources_route_codebase_search_through_rust_core() {
        let src_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("src");
        let lib_rs = fs::read_to_string(src_dir.join("lib.rs")).expect("read lib.rs");
        let production_lib = lib_rs.split("#[cfg(test)]").next().unwrap_or(&lib_rs);
        assert!(production_lib.contains("codebase_search::codebase_search"));

        let routes = fs::read_to_string(src_dir.join("tool_routes.rs")).expect("read tool_routes");
        assert!(routes.contains("codebase_search"));
        assert!(routes.contains("RustCore"));
    }

    #[test]
    fn exposes_codebase_search_tool_surface() {
        let tools = CoderagMcp::new().tool_router.list_all();
        let names: Vec<_> = tools.iter().map(|tool| tool.name.to_string()).collect();
        assert!(names.contains(&"codebase_search".to_string()));
    }
}