# AST-Based Chunking

CodeRAG uses Abstract Syntax Tree (AST) parsing to split code into semantic chunks rather than arbitrary character or line-based splits. This produces more meaningful search units.

## How Tree-Sitter Parsers Work

CodeRAG uses Synth parsers (built on tree-sitter) to parse code into AST nodes. Tree-sitter is a parser generator that creates fast, incremental parsers for programming languages.

**Key concepts:**

- **Nodes**: AST nodes represent code constructs (functions, classes, expressions, etc.)
- **Spans**: Each node has a span with start/end positions (line, column, offset)
- **Types**: Node types identify the construct (e.g., `FunctionDeclaration`, `ClassDeclaration`)
- **Tree structure**: Nodes form a hierarchical tree with parent/child relationships

**Example AST:**

```typescript
// Code:
function hello(name: string) {
  return `Hello, ${name}`
}

// Simplified AST:
{
  type: "FunctionDeclaration",
  span: { start: { line: 0, column: 0 }, end: { line: 2, column: 1 } },
  children: [
    { type: "Identifier", value: "hello" },
    { type: "Parameters", children: [...] },
    { type: "BlockStatement", children: [...] }
  ]
}
```

**Synth parser interface:**

```typescript
interface SynthParser {
  parseAsync: (source: string, options?: Record<string, unknown>) => Promise<Tree>
}

interface Tree {
  meta: { language: string; source: string }
  root: NodeId
  nodes: BaseNode[]
}
```

All Synth parsers use async parsing because they're WASM-based (v0.3.x).

## Semantic Boundaries

Semantic boundaries define where code should be split. CodeRAG chunks code at boundaries defined in the language configuration.

**Common boundaries by language:**

**TypeScript/JavaScript:**
- `FunctionDeclaration`
- `ClassDeclaration`
- `InterfaceDeclaration`
- `TypeAliasDeclaration`
- `ExportNamedDeclaration`
- `ExportDefaultDeclaration`

**Python:**
- `FunctionDef`
- `AsyncFunctionDef`
- `ClassDef`
- `Module`

**Go:**
- `FuncDecl`
- `MethodDecl`
- `TypeSpec`
- `GenDecl`

**Rust:**
- `function_item`
- `impl_item`
- `struct_item`
- `enum_item`
- `trait_item`

**Why semantic boundaries?**

Semantic chunking ensures each chunk is a complete, meaningful unit:

```typescript
// Good: Function-level chunking
// Chunk 1:
export function calculateBM25(tf: number, idf: number, docLen: number, avgDocLen: number): number {
  const k1 = 1.2
  const b = 0.75
  const numerator = tf * (k1 + 1)
  const denominator = tf + k1 * (1 - b + b * docLen / avgDocLen)
  return idf * (numerator / denominator)
}

// Bad: Character-based chunking at 100 chars
// Chunk 1: "export function calculateBM25(tf: number, idf: number, docLen: number, avgDocLen: number): number {"
// Chunk 2: "const k1 = 1.2\n  const b = 0.75\n  const numerator = tf * (k1 + 1)\n  const denominator = tf + k"
// Result: Incomplete, nonsensical chunks
```

## Language-Specific Configurations

Each language has a configuration defining its parser, boundaries, and context types.

**Configuration structure:**

```typescript
interface LanguageConfig {
  parser: string                      // NPM package name
  extensions: readonly string[]       // File extensions
  boundaries: readonly string[]       // AST node types for chunking
  contextTypes?: readonly string[]    // Context to preserve (imports, types)
  embedded?: EmbeddedLanguageConfig[] // Embedded languages
  parserOptions?: Record<string, unknown>
}
```

**Example: TypeScript configuration:**

```typescript
typescript: {
  parser: '@sylphx/synth-js',
  extensions: ['.ts', '.mts', '.cts'],
  boundaries: [
    'FunctionDeclaration',
    'ClassDeclaration',
    'InterfaceDeclaration',
    'TypeAliasDeclaration',
    'EnumDeclaration',
    'MethodDefinition',
    'ExportNamedDeclaration',
    'ExportDefaultDeclaration',
  ],
  contextTypes: ['ImportDeclaration', 'TypeAliasDeclaration', 'InterfaceDeclaration'],
  parserOptions: { sourceType: 'module' },
}
```

**Context preservation:**

Context types (imports, type definitions) can be prepended to each chunk for better understanding:

```typescript
// With preserveContext: true

// Chunk 1 (with context):
import { User } from './types'

export function getUser(id: string): User {
  return database.findById(id)
}

// Without context, the chunk would start at "export function..."
```

## Chunk Metadata

Each chunk includes metadata for precise navigation and filtering.

**ChunkResult interface:**

```typescript
interface ChunkResult {
  readonly content: string       // Chunk source code
  readonly type: string          // AST node type
  readonly startLine: number     // 1-indexed
  readonly endLine: number       // 1-indexed
  readonly metadata: Record<string, unknown>
}
```

**Example chunk:**

```typescript
{
  content: "export function parseQuery(query: string): string[] {\n  return query.toLowerCase().split(/\\s+/)\n}",
  type: "FunctionDeclaration",
  startLine: 5,
  endLine: 7,
  metadata: {
    name: "parseQuery",
    exported: true
  }
}
```

**Metadata uses:**

- **Search results**: Display which function/class matched
- **Navigation**: Jump to exact line in editor
- **Filtering**: Search only specific node types (e.g., only functions)
- **Ranking**: Boost certain types (e.g., exported functions)

## Chunking Process

Step-by-step chunking algorithm:

1. **Detect language**: Determine language from file extension
2. **Load parser**: Get Synth parser for the language
3. **Parse AST**: Parse source code into syntax tree
4. **Extract chunks**: Traverse tree, extract nodes at semantic boundaries
5. **Merge small chunks**: Combine small chunks below minChunkSize
6. **Split large chunks**: Recursively split chunks exceeding maxChunkSize
7. **Add metadata**: Attach type, line numbers, and other metadata

**API usage:**

```typescript
import { chunkCodeByAST } from '@sylphx/coderag'

const chunks = await chunkCodeByAST(
  sourceCode,
  'example.ts',
  {
    maxChunkSize: 1000,      // Max chars per chunk
    minChunkSize: 100,       // Min chars per chunk
    preserveContext: true,   // Include imports/types
    nodeTypes: undefined,    // Chunk all boundaries
    parseEmbedded: true      // Parse code blocks in markdown
  }
)

for (const chunk of chunks) {
  console.log(`${chunk.type} (lines ${chunk.startLine}-${chunk.endLine})`)
  console.log(chunk.content)
}
```

**Fallback behavior:**

If AST parsing fails (unknown language, syntax error), CodeRAG falls back to character-based chunking:

```typescript
// Fallback chunk
{
  content: "... raw text ...",
  type: "text",
  startLine: 0,
  endLine: 0,
  metadata: { fallback: true, reason: "no-semantic-boundaries" }
}
```

## Supported Languages

CodeRAG supports 15+ languages through Synth parsers:

**Tier 1 (Full AST support):**
- JavaScript/TypeScript/JSX/TSX
- Python
- Go
- Java
- C/C++
- Rust

**Tier 2 (Markup/Config):**
- Markdown
- HTML
- XML
- JSON
- YAML
- TOML
- INI

**Tier 3 (Specialized):**
- Protobuf

See [languages.md](/Users/kyle/coderag/docs/guide/languages.md) for full details.
