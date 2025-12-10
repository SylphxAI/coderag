# Tools Reference

CodeRAG MCP provides a single tool: `codebase_search`

## codebase_search

Search project source files with hybrid TF-IDF and optional vector ranking.

### Description

**Keyword Mode** (default, without OPENAI_API_KEY):
- TF-IDF ranking with StarCoder2 tokenizer
- Use specific terms, function names, technical keywords
- Example queries: "getUserById", "authentication error", "export const config"

**Semantic Mode** (with OPENAI_API_KEY):
- AI embeddings + TF-IDF fusion
- Natural language queries
- Example queries: "user login flow with JWT", "error handling patterns"

### Input Schema

The tool accepts a JSON object with the following parameters:

#### query (required)

**Type:** `string`

**Description:** Search query

**Keyword Mode:** Use specific terms, function names, or technical keywords
```json
{
  "query": "getUserById authentication"
}
```

**Semantic Mode:** Describe what you're looking for in natural language
```json
{
  "query": "code that handles user login with JWT tokens"
}
```

#### limit (optional)

**Type:** `number`

**Default:** `10`

**Description:** Maximum number of results to return

```json
{
  "query": "authentication",
  "limit": 5
}
```

**Range:** 1-100

**Tips:**
- Use lower limits (5-10) for focused searches
- Use higher limits (20-50) for exploratory searches
- Very high limits may slow down response time

#### include_content (optional)

**Type:** `boolean`

**Default:** `true`

**Description:** Include file content snippets in results

```json
{
  "query": "error handling",
  "include_content": true
}
```

**When to disable:**
- Only need file paths and scores
- Reduce token usage in AI responses
- Faster search for large result sets

#### file_extensions (optional)

**Type:** `string[]`

**Default:** All supported extensions

**Description:** Filter results by file extensions

```json
{
  "query": "authentication",
  "file_extensions": [".ts", ".tsx"]
}
```

**Common Filters:**
- TypeScript: `[".ts", ".tsx"]`
- JavaScript: `[".js", ".jsx"]`
- Python: `[".py"]`
- All JS/TS: `[".js", ".jsx", ".ts", ".tsx"]`
- Config files: `[".json", ".yaml", ".toml"]`

#### path_filter (optional)

**Type:** `string`

**Default:** No filter

**Description:** Filter by path pattern (substring match)

```json
{
  "query": "component",
  "path_filter": "src/components"
}
```

**Examples:**
- `"src/auth"` - Only files in auth directory
- `"components"` - Files with "components" in path
- `"test"` - Only test files
- `"lib/utils"` - Utility files

**Notes:**
- Case-sensitive substring match
- Matches anywhere in file path
- Use forward slashes (/) on all platforms

#### exclude_paths (optional)

**Type:** `string[]`

**Default:** Common build/dependency directories excluded automatically

**Description:** Exclude paths containing these patterns

```json
{
  "query": "config",
  "exclude_paths": ["node_modules", "dist", ".git"]
}
```

**Commonly Excluded:**
- Build outputs: `["dist", "build", "out"]`
- Dependencies: `["node_modules", "vendor"]`
- Version control: `[".git", ".svn"]`
- IDE files: `[".vscode", ".idea"]`

**Notes:**
- Patterns are substring matches
- Case-sensitive
- Multiple patterns combine with OR logic

#### context_lines (optional)

**Type:** `number`

**Default:** `3`

**Description:** Lines of context around each matched line

```json
{
  "query": "function authenticate",
  "context_lines": 5
}
```

**Range:** 0-20

**Effects:**
- `0`: Only matched lines
- `3` (default): Good balance of context
- `10+`: More context, more tokens

#### max_snippet_chars (optional)

**Type:** `number`

**Default:** `2000`

**Description:** Maximum characters per file snippet

```json
{
  "query": "authentication",
  "max_snippet_chars": 1000
}
```

**Tips:**
- Lower values (500-1000): Reduce token usage
- Higher values (3000-5000): More complete code blocks
- Snippets exceeding this limit are truncated with head+tail format

#### max_snippet_blocks (optional)

**Type:** `number`

**Default:** `4`

**Description:** Maximum code blocks per file

```json
{
  "query": "error handling",
  "max_snippet_blocks": 2
}
```

**Range:** 1-10

**Effects:**
- Lower values: Fewer, more focused results per file
- Higher values: More complete coverage of matches

### Output Format

Results are returned in LLM-optimized markdown format with minimal token usage and maximum content density.

#### Basic Output

```markdown
# Search: "authentication" (3 results)

## src/auth/login.ts:15-28
```typescript
15: export async function authenticate(credentials) {
16:   const user = await findUser(credentials.email)
17:   return validatePassword(user, credentials.password)
18: }
```

## src/middleware/auth.ts:42-55
```typescript
42: export const authMiddleware = (req, res, next) => {
43:   const token = req.headers.authorization
44:   if (!token) return res.status(401).send('Unauthorized')
45:   next()
46: }
```
```

#### Embedded Code Blocks

For code embedded in Markdown or HTML:

```markdown
## docs/api.md:66-75 [markdown→typescript]
```typescript
66: ```typescript
67: // Example authentication usage
68: const result = await authenticate({ email, password })
69: ```
```

**Format:** `[source→embedded]`
- `markdown→typescript`: TypeScript code block in Markdown
- `html→javascript`: JavaScript in `<script>` tag

#### Truncated Files

Large files are truncated with head+tail format:

```markdown
## src/utils/large.ts:1-200 [truncated]
```typescript
1: // First 70% of content shown...
2: export function helper() {
...

... [800 chars truncated] ...

...
195: // Last 20% of content shown
196: }
```

**Format:**
- First 70% of max_snippet_chars
- Truncation indicator with char count
- Last 20% of max_snippet_chars

#### No Results

```markdown
# Search: "nonexistent" (0 results)

No matches found. Try different terms or check filters.
Indexed files: 1234
```

#### Indexing In Progress

```markdown
⏳ **Indexing In Progress**

**Progress:** 45%
`█████████░░░░░░░░░░░`

**Chunks:** 1234/2500 | **Files:** 456/1000
**Current:** `src/components/Button.tsx`

💡 Try again in a few seconds.
```

### Example Queries

#### Find Authentication Code

**Keyword Mode:**
```json
{
  "query": "authenticate login JWT",
  "limit": 5,
  "file_extensions": [".ts", ".js"]
}
```

**Semantic Mode:**
```json
{
  "query": "code that handles user authentication with JWT tokens",
  "limit": 5
}
```

#### Find Error Handling

**Keyword Mode:**
```json
{
  "query": "try catch error throw",
  "path_filter": "src",
  "exclude_paths": ["test"]
}
```

**Semantic Mode:**
```json
{
  "query": "error handling and exception patterns",
  "path_filter": "src"
}
```

#### Find Configuration Files

```json
{
  "query": "database config connection",
  "file_extensions": [".json", ".yaml", ".env"],
  "limit": 3
}
```

#### Find Specific Function

```json
{
  "query": "function getUserById",
  "file_extensions": [".ts"],
  "path_filter": "src/services"
}
```

#### Find Component Usage

```json
{
  "query": "Button component import",
  "file_extensions": [".tsx", ".jsx"],
  "path_filter": "src/components",
  "context_lines": 5
}
```

#### Find API Routes

```json
{
  "query": "router.get router.post express",
  "path_filter": "routes",
  "max_snippet_blocks": 2
}
```

#### Exploratory Search

```json
{
  "query": "state management redux zustand",
  "limit": 20,
  "file_extensions": [".ts", ".tsx"],
  "context_lines": 1,
  "max_snippet_chars": 1000
}
```

### Response Codes and Errors

#### Success Response

Returns markdown-formatted search results as plain text.

#### Error: Index Not Ready

```markdown
⏳ **Indexing Starting...**

The codebase index is being built in the background.

💡 **Tip:** Try your search again in a few seconds.
```

**Cause:** First search before indexing completes

**Solution:** Wait a few seconds and retry

#### Error: Index Not Available

```markdown
❌ **Index Not Available**

The codebase has not been indexed.

**Possible causes:**
- Indexing failed (check server logs)
- Auto-indexing is disabled

💡 Restart the MCP server to retry.
```

**Causes:**
- Server started with `--no-auto-index`
- Indexing failed due to permissions or disk space

**Solution:**
- Check server logs
- Restart server without `--no-auto-index`
- Verify disk space and permissions

#### Error: Search Failed

```markdown
✗ Codebase search error: <error message>
```

**Common Causes:**
- Invalid file paths in database
- Corrupted index
- Disk read errors

**Solution:**
- Delete `.coderag/` folder and restart server
- Check disk health
- Verify file permissions

## Performance Characteristics

### Search Latency

| Result Count | Keyword Mode | Semantic Mode |
|--------------|--------------|---------------|
| 10 results | <10ms | <50ms |
| 50 results | <20ms | <100ms |
| 100 results | <30ms | <200ms |

**Notes:**
- Keyword mode is faster (no embedding generation)
- Semantic mode requires embedding the query (<50ms)
- Filtering and snippet generation add minimal overhead

### Token Usage

Approximate token counts for responses:

| Component | Tokens |
|-----------|--------|
| Header | ~10 |
| File path + line range | ~5-10 |
| Code snippet (100 chars) | ~25-30 |
| Code snippet (500 chars) | ~125-150 |
| Code snippet (2000 chars) | ~500-600 |

**Tips to reduce tokens:**
- Set `include_content: false` for path-only results
- Lower `max_snippet_chars` to 500-1000
- Reduce `limit` to 5-10 results
- Use `file_extensions` to filter irrelevant files

## Best Practices

### Keyword Search Queries

**Good:**
- `"getUserById findUser"` - Specific function names
- `"authentication middleware JWT"` - Technical terms
- `"error ECONNREFUSED retry"` - Error codes and keywords

**Avoid:**
- `"the code for users"` - Too generic
- `"get a user"` - Natural language (use semantic mode)

### Semantic Search Queries

**Good:**
- `"code that validates user input before saving to database"`
- `"error handling patterns for API requests"`
- `"components that display user profile information"`

**Avoid:**
- `"findUser"` - Single keywords (use keyword mode)
- `"authentication"` - Too broad (be specific)

### Filtering Strategies

**Start Broad, Then Narrow:**
```json
// First search
{"query": "authentication", "limit": 20}

// Then narrow with filters
{"query": "authentication", "file_extensions": [".ts"], "path_filter": "src/auth"}
```

**Combine Filters:**
```json
{
  "query": "config database",
  "file_extensions": [".json", ".yaml"],
  "exclude_paths": ["test", "dist"]
}
```

### Context Lines

**Use Lower Context for:**
- Finding specific lines/statements
- Reducing token usage
- Quick verification

**Use Higher Context for:**
- Understanding surrounding code
- Complex logic requiring full context
- Learning code patterns

## Next Steps

- [Installation Guide](./installation.md) - Setup and CLI arguments
- [Configuration Guide](./configuration.md) - Environment variables and configs
- [IDE Integration](./ide-integration.md) - Use with Claude Desktop, Cursor, etc.
