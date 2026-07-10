use coderag_mcp_server::{cli_bridge, http_transport, CoderagMcp, SERVER_VERSION};
use rmcp::ServiceExt;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    if std::env::args().nth(1).as_deref() == Some("doctor") {
        eprintln!(
            "coderag-mcp Rust MCP server {SERVER_VERSION} ({})",
            coderag_core::ENGINE_NAME
        );
        if let Some(cli) = cli_bridge::resolve_cli_binary() {
            eprintln!("engine cli: {}", cli.display());
        } else {
            eprintln!("engine cli: unavailable (run `bun run build:rust`)");
        }
        return Ok(());
    }

    if http_transport::transport_from_env().is_some() {
        return http_transport::serve_http(http_transport::HttpConfig::from_env()).await;
    }

    let service = CoderagMcp::new().serve(rmcp::transport::stdio()).await?;
    service.waiting().await?;
    Ok(())
}