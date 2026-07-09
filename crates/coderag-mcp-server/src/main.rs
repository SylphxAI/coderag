use coderag_mcp_server::{cli_bridge, CoderagMcp, SERVER_VERSION};
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

    let service = CoderagMcp::new().serve(rmcp::transport::stdio()).await?;
    service.waiting().await?;
    Ok(())
}