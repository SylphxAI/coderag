# AST Chunking

CodeRAG uses AST-based chunking to split code at semantic boundaries (functions, classes, etc.) using the Synth parser library.

## chunkCodeByAST()

Split code into semantic chunks using AST analysis.

```typescript
async function chunkCodeByAST(
  code: string,
  filePath: string,
  options?: ASTChunkOptions
): Promise<readonly ChunkResult[]>
```

### Parameters

**code** `string` - Source code to chunk

**filePath** `string` - File path (used for language detection)

**options** `ASTChunkOptions` (optional)

```typescript
interface ASTChunkOptions {
  maxChunkSize?: number       // Max chunk chars (default: 1000)
  minChunkSize?: number       // Min chunk chars (default: 100)
  preserveContext?: boolean   // Include imports/types (default: true)
  nodeTypes?: string[]        // Custom AST node types to chunk
  parseEmbedded?: boolean     // Parse code in markdown (default: true)
}
```

### Returns

`Promise<readonly ChunkResult[]>` - Array of semantic chunks

```typescript
interface ChunkResult {
  content: string              // Chunk content
  type: string                 // AST node type
  startLine: number           // Start line (1-indexed)
  endLine: number             // End line (inclusive)
  metadata: Record<string, unknown>  // Additional metadata
}
```

### Example

```typescript
import { chunkCodeByAST } from '@sylphx/coderag'

const code = `
import { z } from 'zod'

export function validateUser(user: unknown) {
  const schema = z.object({
    name: z.string(),
    email: z.string().email()
  })
  return schema.parse(user)
}

export class UserService {
  async createUser(data: unknown) {
    const validated = validateUser(data)
    return this.db.users.create(validated)
  }
}
`

const chunks = await chunkCodeByAST(code, 'user-service.ts')

for (const chunk of chunks) {
  console.log(`Type: ${chunk.type}`)
  console.log(`Lines: ${chunk.startLine}-${chunk.endLine}`)
  console.log(chunk.content)
  console.log('---')
}

// Output:
// Type: FunctionDeclaration
// Lines: 3-10
// import { z } from 'zod'
//
// export function validateUser(user: unknown) { ... }
// ---
// Type: ClassDeclaration
// Lines: 12-17
// import { z } from 'zod'
//
// export class UserService { ... }
```

## chunkCodeByASTSimple()

Simplified wrapper that returns chunk content only.

```typescript
async function chunkCodeByASTSimple(
  code: string,
  filePath: string,
  options?: ASTChunkOptions
): Promise<readonly string[]>
```

### Returns

`Promise<readonly string[]>` - Array of chunk content strings

### Example

```typescript
const chunks = await chunkCodeByASTSimple(code, 'example.ts')
// Returns: ['function a() { }', 'class B { }']
```

## getSupportedLanguages()

Get list of supported languages for AST chunking.

```typescript
function getSupportedLanguages(): string[]
```

### Returns

`string[]` - Array of supported language names

### Example

```typescript
import { getSupportedLanguages } from '@sylphx/coderag'

const languages = getSupportedLanguages()
console.log(languages)
// ['javascript', 'typescript', 'python', 'rust', 'go', ...]
```

## Supported Languages

CodeRAG supports AST chunking for the following languages:

**JavaScript/TypeScript**
- Extensions: `.js`, `.mjs`, `.cjs`, `.jsx`, `.ts`, `.tsx`, `.mts`, `.cts`
- Boundaries: Functions, classes, methods, arrow functions
- Context: Imports, type definitions

**Python**
- Extensions: `.py`
- Boundaries: Functions, classes, methods
- Context: Imports, class definitions

**Rust**
- Extensions: `.rs`
- Boundaries: Functions, structs, impls, traits
- Context: Use statements, type definitions

**Go**
- Extensions: `.go`
- Boundaries: Functions, methods, structs
- Context: Imports, type declarations

**Java**
- Extensions: `.java`
- Boundaries: Classes, methods, constructors
- Context: Imports, class declarations

**C/C++**
- Extensions: `.c`, `.h`, `.cpp`, `.hpp`, `.cc`, `.hh`
- Boundaries: Functions, structs, classes
- Context: Includes, type definitions

**Ruby**
- Extensions: `.rb`
- Boundaries: Modules, classes, methods
- Context: Requires, module definitions

**PHP**
- Extensions: `.php`
- Boundaries: Classes, functions, methods
- Context: Namespace, use statements

**Markdown**
- Extensions: `.md`, `.mdx`
- Boundaries: Headings, code blocks
- Embedded: Recursively parses code blocks

**Markup/Data**
- HTML: `.html`, `.htm`
- XML: `.xml`
- JSON: `.json`
- YAML: `.yaml`, `.yml`
- TOML: `.toml`

## Chunking Behavior

### Semantic Boundaries

Code is split at meaningful boundaries based on AST structure:

```typescript
const code = `
function greet() {
  console.log('hello')
}

function farewell() {
  console.log('goodbye')
}
`

const chunks = await chunkCodeByAST(code, 'example.js')
// Returns 2 chunks (one per function)
```

### Context Preservation

By default, context (imports, types) is prepended to each chunk:

```typescript
const code = `
import { User } from './types'

export function createUser(data: User) {
  return { ...data, id: generateId() }
}

export function deleteUser(id: string) {
  return db.users.delete(id)
}
`

const chunks = await chunkCodeByAST(code, 'user.ts', {
  preserveContext: true  // Default
})

// Each chunk includes: import { User } from './types'
```

Disable context preservation:

```typescript
const chunks = await chunkCodeByAST(code, 'user.ts', {
  preserveContext: false
})
// Chunks contain only the function code
```

### Large Chunk Handling

Chunks exceeding `maxChunkSize` are recursively split:

```typescript
const code = `
export function processLargeData(items: Item[]) {
  // 2000 lines of code...
}
`

const chunks = await chunkCodeByAST(code, 'process.ts', {
  maxChunkSize: 1000
})
// Returns multiple sub-chunks from the function body
```

### Small Chunk Merging

Small non-semantic chunks are merged to reach `minChunkSize`:

```typescript
const code = `
const a = 1
const b = 2
const c = 3

function main() { }
`

const chunks = await chunkCodeByAST(code, 'example.js', {
  minChunkSize: 50
})
// Constants merged into single chunk, function as separate chunk
```

### Fallback Behavior

If AST parsing fails, falls back to character chunking:

```typescript
const invalidCode = `
function incomplete(
`

const chunks = await chunkCodeByAST(invalidCode, 'broken.js')
// Returns character-based chunks with metadata.fallback = true
```

## Embedded Code Parsing

Markdown code blocks are recursively parsed:

```typescript
const markdown = `
# Example

\`\`\`typescript
function hello() {
  console.log('hi')
}
\`\`\`
`

const chunks = await chunkCodeByAST(markdown, 'example.md', {
  parseEmbedded: true  // Default
})

// Returns chunk with:
// - type: 'FunctionDeclaration'
// - metadata.embeddedIn: 'CodeBlock'
// - metadata.embeddedLanguage: 'typescript'
```

Disable embedded parsing:

```typescript
const chunks = await chunkCodeByAST(markdown, 'example.md', {
  parseEmbedded: false
})
// Returns code block as-is without parsing
```

## Custom Node Types

Override default semantic boundaries:

```typescript
const code = `
const config = {
  host: 'localhost',
  port: 3000
}

function start() { }
`

const chunks = await chunkCodeByAST(code, 'config.js', {
  nodeTypes: ['VariableDeclaration', 'FunctionDeclaration']
})
// Chunks both config and function separately
```

## Chunk Metadata

Each chunk includes metadata about its origin:

```typescript
const chunks = await chunkCodeByAST(code, 'example.ts')

const chunk = chunks[0]
console.log(chunk.metadata)

// Common metadata:
// - name: Function/class name (if available)
// - async: true/false for async functions
// - export: true/false for exported symbols
// - fallback: true if character chunking was used
// - split: true if chunk was split from larger node
// - merged: true if merged from small chunks
// - embeddedIn: Parent node type for embedded code
// - embeddedLanguage: Language of embedded code
```

## Performance

### Parsing Speed

Approximate parsing speeds:
- JavaScript/TypeScript: ~5000 lines/sec
- Python: ~3000 lines/sec
- Rust/Go/Java/C++: ~2000 lines/sec (WASM-based)
- Markdown: ~10000 lines/sec

### Memory Usage

- In-memory AST: ~1KB per 100 lines of code
- Chunk overhead: ~100 bytes per chunk
- Total: ~50-100MB for large codebases

## Error Handling

### Invalid Syntax

```typescript
try {
  const chunks = await chunkCodeByAST(invalidCode, 'broken.js')
  // Falls back to character chunking
  if (chunks[0].metadata.fallback) {
    console.log('AST parsing failed, using fallback')
  }
} catch (error) {
  console.error('Chunking failed:', error)
}
```

### Unknown Language

```typescript
const chunks = await chunkCodeByAST(code, 'unknown.xyz')
// Logs: [WARN] Unknown language, falling back to character chunking
// Returns character-based chunks
```

## Best Practices

**Choose appropriate chunk sizes:**
```typescript
// For embeddings (typical token limit: 8192)
const chunks = await chunkCodeByAST(code, file, {
  maxChunkSize: 1000,  // ~500 tokens
  minChunkSize: 100
})

// For LLM context (larger is better)
const chunks = await chunkCodeByAST(code, file, {
  maxChunkSize: 2000,
  minChunkSize: 200
})
```

**Preserve context for better search:**
```typescript
const chunks = await chunkCodeByAST(code, file, {
  preserveContext: true  // Include imports/types
})
```

**Enable embedded parsing for documentation:**
```typescript
const chunks = await chunkCodeByAST(markdown, 'README.md', {
  parseEmbedded: true  // Parse code examples
})
```

**Handle fallback gracefully:**
```typescript
const chunks = await chunkCodeByAST(code, file)
const validChunks = chunks.filter(c => !c.metadata.fallback)
```

## Integration with Indexer

CodebaseIndexer automatically uses AST chunking:

```typescript
import { CodebaseIndexer } from '@sylphx/coderag'

const indexer = new CodebaseIndexer({
  codebaseRoot: './src'
})

await indexer.index()
// Automatically chunks all files using chunkCodeByAST()
```

Search results include chunk metadata:

```typescript
const results = await indexer.search('authentication')

for (const result of results) {
  console.log(`${result.chunkType} at ${result.path}:${result.startLine}`)
  // FunctionDeclaration at src/auth.ts:42
}
```

## Language Configuration

View language-specific settings:

```typescript
import { getLanguageConfig } from '@sylphx/coderag'

const config = getLanguageConfig('typescript')
console.log(config)

// {
//   parser: '@sylphx/synth-js',
//   boundaries: ['FunctionDeclaration', 'ClassDeclaration', ...],
//   contextTypes: ['ImportDeclaration', 'TypeAlias', ...],
//   embedded: [{ nodeType: 'CodeBlock', ... }]
// }
```

## Related

- [CodebaseIndexer](./indexer.md)
- [Types](./types.md)
