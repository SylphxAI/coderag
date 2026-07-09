use std::collections::HashSet;

pub fn tokenize(text: &str) -> Vec<String> {
    let mut tokens = Vec::new();
    let mut current = String::new();
    for ch in text.chars() {
        if ch.is_ascii_alphanumeric() || ch == '_' {
            current.push(ch.to_ascii_lowercase());
        } else if !current.is_empty() {
            if current.len() > 1 {
                tokens.push(current.clone());
            }
            current.clear();
        }
    }
    if !current.is_empty() && current.len() > 1 {
        tokens.push(current);
    }
    tokens
}

pub fn unique_terms(tokens: &[String]) -> HashSet<String> {
    tokens.iter().cloned().collect()
}