//! Explicit shipped routing table for coderag primary tools.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ToolRoute {
    RustCore,
    LegacyOptIn,
}

pub fn route_for_tool(tool: &str) -> Option<ToolRoute> {
    match tool {
        "codebase_search" | "coderag_index" | "coderag_search" => Some(ToolRoute::RustCore),
        _ => None,
    }
}

pub fn is_rust_core_tool(tool: &str) -> bool {
    matches!(route_for_tool(tool), Some(ToolRoute::RustCore))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_primary_tools_to_explicit_routes() {
        assert_eq!(route_for_tool("codebase_search"), Some(ToolRoute::RustCore));
        assert_eq!(route_for_tool("coderag_search"), Some(ToolRoute::RustCore));
        assert_eq!(route_for_tool("coderag_index"), Some(ToolRoute::RustCore));
    }
}