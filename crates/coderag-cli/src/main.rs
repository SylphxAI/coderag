use std::io::{self, Read};

use coderag_core::handle_tool;
use serde::Deserialize;

#[derive(Debug, Deserialize)]
struct CliRequest {
    tool: String,
    input: serde_json::Value,
}

fn main() {
    let mut raw = String::new();
    if io::stdin().read_to_string(&mut raw).is_err() || raw.trim().is_empty() {
        eprintln!("coderag-cli expects JSON on stdin: {{\"tool\":\"...\",\"input\":{{...}}}}");
        std::process::exit(2);
    }

    let request: CliRequest = match serde_json::from_str(&raw) {
        Ok(value) => value,
        Err(err) => {
            eprintln!("Invalid JSON request: {err}");
            std::process::exit(2);
        }
    };

    let envelope = handle_tool(&request.tool, request.input);
    println!("{}", serde_json::to_string(&envelope).expect("serialize envelope"));
}