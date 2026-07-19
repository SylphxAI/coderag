pub mod cli_bridge;
pub mod codebase_search;
pub mod http_transport;
pub mod tool_routes;

use rmcp::{
    handler::server::router::tool::ToolRouter,
    handler::server::wrapper::Parameters,
    model::{Implementation, ServerCapabilities, ServerInfo},
    schemars, tool, tool_handler, tool_router, ErrorData, ServerHandler,
};
use serde_json::json;

#[derive(Debug, serde::Deserialize, schemars::JsonSchema)]
pub struct CodebaseSearchRequest {
    #[schemars(description = "Repository root path; defaults to CODERAG_ROOT when omitted")]
    pub root: Option<String>,
    #[schemars(description = "Search query")]
    pub query: String,
    #[schemars(description = "Maximum number of results")]
    pub limit: Option<u64>,
}

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
        Parameters(request): Parameters<CodebaseSearchRequest>,
    ) -> Result<rmcp::model::CallToolResult, ErrorData> {
        let mut args = json!({
            "query": request.query,
            "limit": request.limit.unwrap_or(10),
        });
        if let Some(root) = request.root {
            args["root"] = json!(root);
        }
        codebase_search::codebase_search(args)
    }
}

#[tool_handler]
impl ServerHandler for CoderagMcp {
    fn get_info(&self) -> ServerInfo {
        ServerInfo::new(ServerCapabilities::builder().enable_tools().build())
            .with_instructions(SERVER_INSTRUCTIONS)
            .with_server_info(
                Implementation::new(SERVER_NAME, SERVER_VERSION)
                    .with_description(
                        "Rust-native MCP server for coderag (modelcontextprotocol/rust-sdk rmcp)",
                    )
                    .with_website_url("https://github.com/SylphxAI/coderag"),
            )
    }
}

#[cfg(test)]
mod tests {
    use super::CoderagMcp;
    #[test]
    fn exposes_codebase_search_tool_surface() {
        let tools = CoderagMcp::new().tool_router.list_all();
        let names: Vec<_> = tools.iter().map(|tool| tool.name.to_string()).collect();
        assert!(names.contains(&"codebase_search".to_string()));
    }

    #[test]
    fn codebase_search_request_schema_is_generated_for_rmcp_tool() {
        let tools = CoderagMcp::new().tool_router.list_all();
        let tool = tools
            .iter()
            .find(|tool| tool.name == "codebase_search")
            .expect("codebase_search tool");
        let schema = tool.input_schema.as_ref();
        assert!(schema.get("properties").is_some());
        let properties = schema.get("properties").expect("properties");
        assert!(properties.get("query").is_some());
    }
}
