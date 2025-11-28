/**
 * Language Configuration Registry
 *
 * Centralized configuration for all supported languages.
 * To add a new language, simply add an entry here - no code changes needed.
 */

/**
 * Embedded language configuration
 */
export interface EmbeddedLanguageConfig {
	/** AST node type that contains embedded code */
	readonly nodeType: string
	/** Attribute name containing the language (e.g., 'lang' for ```python) */
	readonly langAttr?: string
	/** Default language if not specified */
	readonly defaultLanguage?: string
	/** Whether to recursively parse the embedded content */
	readonly recursive?: boolean
}

/**
 * Language configuration
 */
export interface LanguageConfig {
	/** NPM package name for the Synth parser */
	readonly parser: string
	/** File extensions (including dot) */
	readonly extensions: readonly string[]
	/** AST node types that represent semantic boundaries */
	readonly boundaries: readonly string[]
	/** AST node types that represent context (imports, types) */
	readonly contextTypes?: readonly string[]
	/** Embedded language configurations */
	readonly embedded?: readonly EmbeddedLanguageConfig[]
	/** Parser options to pass to Synth */
	readonly parserOptions?: Record<string, unknown>
}

/**
 * Language Registry
 *
 * Maps language identifiers to their configurations.
 * Language identifiers should be lowercase.
 */
export const LANGUAGE_REGISTRY: Record<string, LanguageConfig> = {
	// ============================================
	// JavaScript Family
	// ============================================
	javascript: {
		parser: '@sylphx/synth-js',
		extensions: ['.js', '.mjs', '.cjs'],
		boundaries: [
			'FunctionDeclaration',
			'FunctionExpression',
			'ArrowFunctionExpression',
			'ClassDeclaration',
			'ClassExpression',
			'MethodDefinition',
			'ExportNamedDeclaration',
			'ExportDefaultDeclaration',
		],
		contextTypes: ['ImportDeclaration', 'ImportSpecifier'],
		parserOptions: { sourceType: 'module' },
	},

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
	},

	jsx: {
		parser: '@sylphx/synth-js',
		extensions: ['.jsx'],
		boundaries: [
			'FunctionDeclaration',
			'FunctionExpression',
			'ArrowFunctionExpression',
			'ClassDeclaration',
			'MethodDefinition',
			'ExportNamedDeclaration',
			'ExportDefaultDeclaration',
			'JSXElement', // React components
		],
		contextTypes: ['ImportDeclaration'],
		parserOptions: { sourceType: 'module' },
	},

	tsx: {
		parser: '@sylphx/synth-js',
		extensions: ['.tsx'],
		boundaries: [
			'FunctionDeclaration',
			'ClassDeclaration',
			'InterfaceDeclaration',
			'TypeAliasDeclaration',
			'MethodDefinition',
			'ExportNamedDeclaration',
			'ExportDefaultDeclaration',
			'JSXElement',
		],
		contextTypes: ['ImportDeclaration', 'TypeAliasDeclaration', 'InterfaceDeclaration'],
		parserOptions: { sourceType: 'module' },
	},

	// ============================================
	// Python
	// ============================================
	python: {
		parser: '@sylphx/synth-python',
		extensions: ['.py', '.pyw', '.pyi'],
		boundaries: [
			'FunctionDef',
			'AsyncFunctionDef',
			'ClassDef',
			'Module', // Top-level module
		],
		contextTypes: ['Import', 'ImportFrom'],
	},

	// ============================================
	// Go
	// ============================================
	go: {
		parser: '@sylphx/synth-go',
		extensions: ['.go'],
		boundaries: [
			'FuncDecl', // Function declaration
			'MethodDecl', // Method declaration
			'TypeSpec', // Type definition
			'GenDecl', // General declaration (const, var, type, import)
		],
		contextTypes: ['ImportSpec'],
	},

	// ============================================
	// Java
	// ============================================
	java: {
		parser: '@sylphx/synth-java',
		extensions: ['.java'],
		boundaries: [
			'MethodDeclaration',
			'ConstructorDeclaration',
			'ClassDeclaration',
			'InterfaceDeclaration',
			'EnumDeclaration',
			'AnnotationTypeDeclaration',
		],
		contextTypes: ['ImportDeclaration', 'PackageDeclaration'],
	},

	// ============================================
	// C Family
	// ============================================
	c: {
		parser: '@sylphx/synth-c',
		extensions: ['.c', '.h'],
		boundaries: [
			'FunctionDefinition',
			'Declaration', // Variable/type declarations
			'StructSpecifier',
			'EnumSpecifier',
			'TypedefDeclaration',
		],
		contextTypes: ['PreprocInclude', 'PreprocDef'],
	},

	// ============================================
	// Markup Languages
	// ============================================
	markdown: {
		parser: '@sylphx/synth-md',
		extensions: ['.md', '.markdown', '.mdx'],
		boundaries: [
			'heading',
			'paragraph',
			'code', // Code blocks
			'blockquote',
			'list',
			'table',
			'thematicBreak',
		],
		embedded: [
			{
				nodeType: 'code',
				langAttr: 'lang', // The language specified after ```
				recursive: true,
			},
		],
	},

	html: {
		parser: '@sylphx/synth-html',
		extensions: ['.html', '.htm'],
		boundaries: ['element', 'comment', 'doctype'],
		embedded: [
			{
				nodeType: 'script',
				defaultLanguage: 'javascript',
				recursive: true,
			},
			{
				nodeType: 'style',
				defaultLanguage: 'css',
				recursive: false, // CSS parser not available yet
			},
		],
	},

	xml: {
		parser: '@sylphx/synth-xml',
		extensions: ['.xml', '.xsl', '.xslt', '.xsd', '.svg'],
		boundaries: ['element', 'comment', 'processingInstruction'],
	},

	// ============================================
	// Data/Config Languages
	// ============================================
	json: {
		parser: '@sylphx/synth-json',
		extensions: ['.json', '.jsonc', '.json5'],
		boundaries: ['Object', 'Array'],
	},

	yaml: {
		parser: '@sylphx/synth-yaml',
		extensions: ['.yaml', '.yml'],
		boundaries: ['Document', 'Mapping', 'Sequence'],
	},

	toml: {
		parser: '@sylphx/synth-toml',
		extensions: ['.toml'],
		boundaries: ['Table', 'ArrayOfTables', 'KeyValue'],
	},

	ini: {
		parser: '@sylphx/synth-ini',
		extensions: ['.ini', '.cfg', '.conf', '.gitconfig', '.editorconfig'],
		boundaries: ['Section', 'Property'],
	},

	// ============================================
	// Other
	// ============================================
	protobuf: {
		parser: '@sylphx/synth-protobuf',
		extensions: ['.proto'],
		boundaries: ['Message', 'Service', 'Enum', 'Rpc'],
	},
}

/**
 * Extension to language mapping (built from registry)
 */
export const EXTENSION_TO_LANGUAGE: Record<string, string> = Object.entries(
	LANGUAGE_REGISTRY
).reduce(
	(acc, [lang, config]) => {
		for (const ext of config.extensions) {
			acc[ext] = lang
		}
		return acc
	},
	{} as Record<string, string>
)

/**
 * Get language config by language name
 */
export function getLanguageConfig(language: string): LanguageConfig | undefined {
	return LANGUAGE_REGISTRY[language.toLowerCase()]
}

/**
 * Get language config by file extension
 */
export function getLanguageConfigByExtension(extension: string): LanguageConfig | undefined {
	const ext = extension.startsWith('.') ? extension : `.${extension}`
	const language = EXTENSION_TO_LANGUAGE[ext.toLowerCase()]
	return language ? LANGUAGE_REGISTRY[language] : undefined
}

/**
 * Get language name from file path
 */
export function getLanguageFromPath(filePath: string): string | undefined {
	const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase()
	return EXTENSION_TO_LANGUAGE[ext]
}

/**
 * Check if a language is supported
 */
export function isLanguageSupported(language: string): boolean {
	return language.toLowerCase() in LANGUAGE_REGISTRY
}

/**
 * Get all supported languages
 */
export function getSupportedLanguages(): string[] {
	return Object.keys(LANGUAGE_REGISTRY)
}

/**
 * Get all supported extensions
 */
export function getSupportedExtensions(): string[] {
	return Object.keys(EXTENSION_TO_LANGUAGE)
}
