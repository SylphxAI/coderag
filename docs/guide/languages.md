# Language Support

CodeRAG supports 15+ programming and markup languages through Synth parsers. Each language has dedicated AST parsing for accurate chunking.

## Full List of 15+ Languages

### Programming Languages (Tier 1)

**JavaScript**
- Extensions: `.js`, `.mjs`, `.cjs`
- Parser: `@sylphx/synth-js`
- Boundaries: Functions, classes, exports
- Context: Import declarations

**TypeScript**
- Extensions: `.ts`, `.mts`, `.cts`
- Parser: `@sylphx/synth-js`
- Boundaries: Functions, classes, interfaces, types, enums
- Context: Imports, type aliases, interfaces

**JSX**
- Extensions: `.jsx`
- Parser: `@sylphx/synth-js`
- Boundaries: Functions, classes, JSX elements (components)
- Context: Import declarations

**TSX**
- Extensions: `.tsx`
- Parser: `@sylphx/synth-js`
- Boundaries: Functions, classes, interfaces, types, JSX elements
- Context: Imports, type aliases, interfaces

**Python**
- Extensions: `.py`, `.pyw`, `.pyi`
- Parser: `@sylphx/synth-python`
- Boundaries: Functions, async functions, classes, modules
- Context: Import statements

**Go**
- Extensions: `.go`
- Parser: `@sylphx/synth-go`
- Boundaries: Functions, methods, types, general declarations
- Context: Import specifications

**Java**
- Extensions: `.java`
- Parser: `@sylphx/synth-java`
- Boundaries: Methods, constructors, classes, interfaces, enums, annotations
- Context: Imports, package declarations

**C**
- Extensions: `.c`, `.h`
- Parser: `@sylphx/synth-c`
- Boundaries: Functions, declarations, structs, enums, typedefs
- Context: Preprocessor includes and definitions

**Rust**
- Extensions: `.rs`
- Parser: `@sylphx/synth-rust`
- Boundaries: Functions, implementations, structs, enums, traits, modules, macros
- Context: Use declarations

### Markup & Config Languages (Tier 2)

**Markdown**
- Extensions: `.md`, `.markdown`, `.mdx`
- Parser: `@sylphx/synth-md`
- Boundaries: Headings, paragraphs, code blocks, blockquotes, list items
- Embedded: Code blocks (recursive parsing enabled)

**HTML**
- Extensions: `.html`, `.htm`
- Parser: `@sylphx/synth-html`
- Boundaries: Elements, comments, doctypes
- Embedded: Script tags (JavaScript), style tags (CSS)

**XML**
- Extensions: `.xml`, `.xsl`, `.xslt`, `.xsd`, `.svg`
- Parser: `@sylphx/synth-xml`
- Boundaries: Elements, comments, processing instructions

**JSON**
- Extensions: `.json`, `.jsonc`, `.json5`
- Parser: `@sylphx/synth-json`
- Boundaries: Objects, arrays

**YAML**
- Extensions: `.yaml`, `.yml`
- Parser: `@sylphx/synth-yaml`
- Boundaries: Documents, mappings, sequences

**TOML**
- Extensions: `.toml`
- Parser: `@sylphx/synth-toml`
- Boundaries: Tables, array of tables, key-value pairs

**INI**
- Extensions: `.ini`, `.cfg`, `.conf`, `.gitconfig`, `.editorconfig`
- Parser: `@sylphx/synth-ini`
- Boundaries: Sections, properties

### Specialized Languages (Tier 3)

**Protocol Buffers**
- Extensions: `.proto`
- Parser: `@sylphx/synth-protobuf`
- Boundaries: Messages, services, enums, RPC definitions

## Extension Mappings

CodeRAG automatically detects language from file extension.

**Extension to language mapping:**

```typescript
const EXTENSION_TO_LANGUAGE = {
  // JavaScript family
  '.js': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.jsx': 'jsx',
  '.ts': 'typescript',
  '.mts': 'typescript',
  '.cts': 'typescript',
  '.tsx': 'tsx',

  // Python
  '.py': 'python',
  '.pyw': 'python',
  '.pyi': 'python',

  // Go
  '.go': 'go',

  // Java
  '.java': 'java',

  // C
  '.c': 'c',
  '.h': 'c',

  // Rust
  '.rs': 'rust',

  // Markup
  '.md': 'markdown',
  '.markdown': 'markdown',
  '.mdx': 'markdown',
  '.html': 'html',
  '.htm': 'html',
  '.xml': 'xml',
  '.xsl': 'xml',
  '.xslt': 'xml',
  '.xsd': 'xml',
  '.svg': 'xml',

  // Config
  '.json': 'json',
  '.jsonc': 'json',
  '.json5': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.toml': 'toml',
  '.ini': 'ini',
  '.cfg': 'ini',
  '.conf': 'ini',
  '.gitconfig': 'ini',
  '.editorconfig': 'ini',

  // Specialized
  '.proto': 'protobuf',
}
```

**Language detection:**

```typescript
import { getLanguageFromPath } from '@sylphx/coderag/language-config'

const lang = getLanguageFromPath('src/utils.ts')
// Returns: 'typescript'

const lang2 = getLanguageFromPath('README.md')
// Returns: 'markdown'

const lang3 = getLanguageFromPath('unknown.xyz')
// Returns: undefined (not supported)
```

## Synth Parser Packages

Each language has a dedicated Synth parser package.

**Package naming:**

All parsers follow the naming convention: `@sylphx/synth-{language}`

**Installation:**

```bash
# JavaScript/TypeScript/JSX/TSX (single package)
npm install @sylphx/synth-js

# Python
npm install @sylphx/synth-python

# Go
npm install @sylphx/synth-go

# Java
npm install @sylphx/synth-java

# C
npm install @sylphx/synth-c

# Rust
npm install @sylphx/synth-rust

# Markdown
npm install @sylphx/synth-md

# HTML
npm install @sylphx/synth-html

# XML
npm install @sylphx/synth-xml

# JSON
npm install @sylphx/synth-json

# YAML
npm install @sylphx/synth-yaml

# TOML
npm install @sylphx/synth-toml

# INI
npm install @sylphx/synth-ini

# Protobuf
npm install @sylphx/synth-protobuf
```

**Parser interface:**

All Synth parsers expose the same interface:

```typescript
interface SynthParser {
  parseAsync: (source: string, options?: Record<string, unknown>) => Promise<Tree>
}

interface Tree {
  meta: {
    language: string
    source: string
    created: number
    modified: number
  }
  root: NodeId
  nodes: BaseNode[]
}
```

**Parser loading:**

CodeRAG automatically loads the correct parser based on file extension:

```typescript
// Auto-discovery
const parser = await loadSynthParser('typescript')
// Loads: @sylphx/synth-js

const tree = await parser.parseAsync(code)
```

## Adding Custom Languages

CodeRAG's language registry is extensible. You can add custom languages without modifying core code.

**Language configuration:**

```typescript
import { LANGUAGE_REGISTRY } from '@sylphx/coderag/language-config'

// Add a custom language
LANGUAGE_REGISTRY['kotlin'] = {
  parser: '@sylphx/synth-kotlin',
  extensions: ['.kt', '.kts'],
  boundaries: [
    'FunctionDeclaration',
    'ClassDeclaration',
    'ObjectDeclaration',
    'InterfaceDeclaration'
  ],
  contextTypes: ['ImportDirective', 'PackageDirective']
}

// Now CodeRAG can parse Kotlin files
const chunks = await chunkCodeByAST(kotlinCode, 'Main.kt')
```

**Custom parser requirements:**

1. **Synth-compatible**: Parser must implement `parseAsync(source, options) -> Tree`
2. **Node types**: Define boundary node types for your language's AST
3. **Context types**: (Optional) Define nodes to preserve as context

**Example custom parser:**

```typescript
// Custom Swift parser
LANGUAGE_REGISTRY['swift'] = {
  parser: '@sylphx/synth-swift',
  extensions: ['.swift'],
  boundaries: [
    'FunctionDeclaration',
    'ClassDeclaration',
    'StructDeclaration',
    'EnumDeclaration',
    'ProtocolDeclaration',
    'ExtensionDeclaration'
  ],
  contextTypes: ['ImportDeclaration'],
  parserOptions: {
    sourceType: 'module'
  }
}
```

**Testing custom language:**

```typescript
import { isLanguageSupported, getSupportedLanguages } from '@sylphx/coderag/language-config'

// Check if language is supported
console.log(isLanguageSupported('kotlin'))  // true (after registration)

// List all supported languages
console.log(getSupportedLanguages())
// ['javascript', 'typescript', ..., 'kotlin']
```

## Language-Specific Features

### Embedded Language Support

Some languages support embedded content (e.g., JavaScript in HTML, code blocks in Markdown).

**Markdown code blocks:**

```typescript
// Markdown with embedded TypeScript
const markdown = `
# Example

\`\`\`typescript
function hello(name: string) {
  return \`Hello, \${name}\`
}
\`\`\`
`

const chunks = await chunkCodeByAST(markdown, 'example.md', {
  parseEmbedded: true  // Enable recursive parsing
})

// Results in multiple chunks:
// 1. Heading: "# Example"
// 2. FunctionDeclaration (TypeScript): "function hello..."
```

**Configuration:**

```typescript
markdown: {
  parser: '@sylphx/synth-md',
  extensions: ['.md', '.markdown', '.mdx'],
  boundaries: ['heading', 'paragraph', 'code', 'blockquote'],
  embedded: [
    {
      nodeType: 'code',           // AST node type for code blocks
      langAttr: 'lang',           // Attribute containing language
      recursive: true             // Enable recursive parsing
    }
  ]
}
```

### Context Preservation

Context types are prepended to chunks for better understanding.

**TypeScript example:**

```typescript
// File: src/user.ts
import { User } from './types'
import { database } from './db'

export function getUser(id: string): User {
  return database.findById(id)
}

export function updateUser(id: string, data: Partial<User>): User {
  return database.update(id, data)
}
```

**With preserveContext: true:**

```typescript
const chunks = await chunkCodeByAST(code, 'user.ts', {
  preserveContext: true
})

// Chunk 1:
// import { User } from './types'
// import { database } from './db'
//
// export function getUser(id: string): User {
//   return database.findById(id)
// }

// Chunk 2:
// import { User } from './types'
// import { database } from './db'
//
// export function updateUser(id: string, data: Partial<User>): User {
//   return database.update(id, data)
// }
```

Each chunk includes import statements for context.

**Without preserveContext:**

```typescript
// Chunk 1:
// export function getUser(id: string): User {
//   return database.findById(id)
// }

// Chunk 2:
// export function updateUser(id: string, data: Partial<User>): User {
//   return database.update(id, data)
// }
```

Chunks are more concise but lose context.

## Supported Extensions Summary

**Quick reference:**

| Language | Extensions | Parser |
|----------|-----------|--------|
| JavaScript | .js, .mjs, .cjs | @sylphx/synth-js |
| TypeScript | .ts, .mts, .cts | @sylphx/synth-js |
| JSX | .jsx | @sylphx/synth-js |
| TSX | .tsx | @sylphx/synth-js |
| Python | .py, .pyw, .pyi | @sylphx/synth-python |
| Go | .go | @sylphx/synth-go |
| Java | .java | @sylphx/synth-java |
| C | .c, .h | @sylphx/synth-c |
| Rust | .rs | @sylphx/synth-rust |
| Markdown | .md, .markdown, .mdx | @sylphx/synth-md |
| HTML | .html, .htm | @sylphx/synth-html |
| XML | .xml, .xsl, .xslt, .xsd, .svg | @sylphx/synth-xml |
| JSON | .json, .jsonc, .json5 | @sylphx/synth-json |
| YAML | .yaml, .yml | @sylphx/synth-yaml |
| TOML | .toml | @sylphx/synth-toml |
| INI | .ini, .cfg, .conf, .gitconfig, .editorconfig | @sylphx/synth-ini |
| Protobuf | .proto | @sylphx/synth-protobuf |

**API:**

```typescript
import {
  getSupportedLanguages,
  getSupportedExtensions,
  getLanguageFromPath,
  getLanguageConfig
} from '@sylphx/coderag/language-config'

// Get all supported languages
const languages = getSupportedLanguages()
// ['javascript', 'typescript', 'python', 'go', ...]

// Get all supported extensions
const extensions = getSupportedExtensions()
// ['.js', '.ts', '.py', '.go', ...]

// Detect language from file path
const lang = getLanguageFromPath('src/App.tsx')
// 'tsx'

// Get language configuration
const config = getLanguageConfig('typescript')
// { parser: '@sylphx/synth-js', extensions: ['.ts', ...], ... }
```
