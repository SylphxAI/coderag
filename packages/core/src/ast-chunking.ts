/**
 * AST-Based Code Chunking using Synth
 *
 * Splits code at semantic boundaries (functions, classes, etc.)
 * Supports multiple languages via language-config registry.
 */

import { chunkText } from './embeddings.js'
import {
	type EmbeddedLanguageConfig,
	getLanguageConfig,
	getLanguageFromPath,
	LANGUAGE_REGISTRY,
	type LanguageConfig,
} from './language-config.js'

// ============================================
// Synth AST Types
// ============================================

interface Position {
	line: number
	column: number
	offset: number
}

interface Span {
	start: Position
	end: Position
}

type NodeId = number

interface BaseNode {
	id: NodeId
	type: string
	span?: Span
	parent: NodeId | null
	children: NodeId[]
	data?: Record<string, unknown>
}

interface Tree {
	meta: {
		language: string
		source: string
		created: number
		modified: number
		data?: Record<string, unknown>
	}
	root: NodeId
	nodes: BaseNode[]
}

/**
 * Synth parser interface.
 * Note: WASM-based parsers (v0.3.x) require parseAsync().
 * Sync parse() throws for tree-sitter based languages (c, go, java, php, python, ruby, rust).
 */
type SynthParser = {
	parse: (source: string, options?: Record<string, unknown>) => Tree
	parseAsync: (source: string, options?: Record<string, unknown>) => Promise<Tree>
}

// ============================================
// Chunking Types
// ============================================

/**
 * AST-based chunking options
 */
export interface ASTChunkOptions {
	readonly maxChunkSize?: number
	readonly minChunkSize?: number
	readonly preserveContext?: boolean
	readonly nodeTypes?: string[]
	/** Enable recursive parsing of embedded code (e.g., code blocks in markdown) */
	readonly parseEmbedded?: boolean
}

/**
 * Chunk result with metadata
 */
export interface ChunkResult {
	readonly content: string
	readonly type: string
	readonly startLine: number
	readonly endLine: number
	readonly metadata: Record<string, unknown>
}

// ============================================
// Parser Cache
// ============================================

const parserCache = new Map<string, SynthParser | null>()

/**
 * Load Synth parser for a language
 * Uses registry first, then tries auto-discovery
 */
async function loadSynthParser(language: string): Promise<SynthParser | null> {
	const langLower = language.toLowerCase()

	// Check cache
	if (parserCache.has(langLower)) {
		return parserCache.get(langLower) || null
	}

	// Try registry first
	const config = getLanguageConfig(langLower)
	if (config) {
		try {
			const parserModule = (await import(config.parser)) as {
				parse: SynthParser['parse']
				parseAsync: SynthParser['parseAsync']
			}
			const parser: SynthParser = {
				parse: parserModule.parse,
				parseAsync: parserModule.parseAsync,
			}
			parserCache.set(langLower, parser)
			return parser
		} catch (error) {
			console.error(`[WARN] Failed to load parser ${config.parser} for ${language}:`, error)
		}
	}

	// Auto-discovery: try @sylphx/synth-{language}
	try {
		const parserModule = (await import(`@sylphx/synth-${langLower}`)) as {
			parse: SynthParser['parse']
			parseAsync: SynthParser['parseAsync']
		}
		const parser: SynthParser = {
			parse: parserModule.parse,
			parseAsync: parserModule.parseAsync,
		}
		parserCache.set(langLower, parser)
		console.error(`[INFO] Auto-discovered parser for ${language}`)
		return parser
	} catch {
		// Not available
	}

	// Cache null to avoid repeated lookups
	parserCache.set(langLower, null)
	return null
}

// ============================================
// AST Utilities
// ============================================

function getSourceText(tree: Tree, node: BaseNode): string {
	if (!node.span) return ''
	return tree.meta.source.slice(node.span.start.offset, node.span.end.offset)
}

function getNode(tree: Tree, nodeId: NodeId): BaseNode | undefined {
	return tree.nodes[nodeId]
}

/**
 * Check if node is a semantic boundary based on language config
 */
function isSemanticBoundary(node: BaseNode, config: LanguageConfig | undefined): boolean {
	if (!config) return false
	return config.boundaries.includes(node.type)
}

/**
 * Extract context nodes (imports, types) based on language config
 */
function extractContextNodes(tree: Tree, config: LanguageConfig | undefined): BaseNode[] {
	if (!config?.contextTypes) return []
	const contextTypes = config.contextTypes
	return tree.nodes.filter((node) => contextTypes.includes(node.type))
}

/**
 * Check if node contains embedded code that should be recursively parsed
 */
function _getEmbeddedConfig(
	node: BaseNode,
	config: LanguageConfig | undefined
): EmbeddedLanguageConfig | undefined {
	if (!config?.embedded) return undefined
	return config.embedded.find((e) => e.nodeType === node.type)
}

/**
 * Detect embedded language from node
 */
function detectEmbeddedLanguage(
	node: BaseNode,
	embeddedConfig: EmbeddedLanguageConfig
): string | undefined {
	// Try to get language from node data
	if (embeddedConfig.langAttr && node.data) {
		const lang = node.data[embeddedConfig.langAttr]
		if (typeof lang === 'string' && lang.length > 0) {
			return lang.toLowerCase()
		}
	}

	// Use default language if specified
	return embeddedConfig.defaultLanguage
}

// ============================================
// Chunk Extraction
// ============================================

/**
 * Merge small non-semantic chunks
 */
function mergeSmallChunks(chunks: ChunkResult[], minChunkSize: number): ChunkResult[] {
	if (chunks.length === 0) return []

	const merged: ChunkResult[] = []
	let buffer: ChunkResult | null = null

	for (const chunk of chunks) {
		// Don't merge semantic chunks (those without 'split' metadata)
		const isSemanticChunk = !chunk.metadata.split

		if (!buffer) {
			if (isSemanticChunk || chunk.content.length >= minChunkSize) {
				merged.push(chunk)
			} else {
				buffer = chunk
			}
			continue
		}

		const isBufferSemantic = !buffer.metadata.split
		if (
			!isSemanticChunk &&
			!isBufferSemantic &&
			buffer.content.length < minChunkSize &&
			chunk.content.length < minChunkSize
		) {
			buffer = {
				content: `${buffer.content}\n\n${chunk.content}`,
				type: `${buffer.type}+${chunk.type}`,
				startLine: buffer.startLine,
				endLine: chunk.endLine,
				metadata: { ...buffer.metadata, merged: true },
			}
		} else {
			merged.push(buffer)
			if (isSemanticChunk || chunk.content.length >= minChunkSize) {
				merged.push(chunk)
				buffer = null
			} else {
				buffer = chunk
			}
		}
	}

	if (buffer) {
		merged.push(buffer)
	}

	return merged
}

/**
 * Extract sub-chunks from large nodes
 */
function extractSubChunks(
	tree: Tree,
	node: BaseNode,
	options: { maxChunkSize: number }
): ChunkResult[] {
	const chunks: ChunkResult[] = []

	if (node.children.length > 0) {
		for (const childId of node.children) {
			const child = getNode(tree, childId)
			if (!child || !child.span) continue

			const content = getSourceText(tree, child)
			if (content.length > options.maxChunkSize) {
				chunks.push(...extractSubChunks(tree, child, options))
			} else {
				chunks.push({
					content,
					type: child.type,
					startLine: child.span.start.line + 1,
					endLine: child.span.end.line + 1,
					metadata: { ...child.data },
				})
			}
		}
	} else {
		// No children, split by characters
		const content = getSourceText(tree, node)
		const charChunks = chunkText(content, { maxChunkSize: options.maxChunkSize })
		charChunks.forEach((chunk, i) => {
			chunks.push({
				content: chunk,
				type: `${node.type}[${i}]`,
				startLine: node.span?.start.line ?? 0 + 1,
				endLine: node.span?.end.line ?? 0 + 1,
				metadata: { split: true, index: i },
			})
		})
	}

	return chunks
}

/**
 * Extract semantic chunks from AST
 */
function extractSemanticChunks(
	tree: Tree,
	config: LanguageConfig | undefined,
	options: {
		maxChunkSize: number
		minChunkSize: number
		preserveContext: boolean
		nodeTypes?: string[]
	}
): ChunkResult[] {
	const chunks: ChunkResult[] = []

	// Extract context prefix
	let contextPrefix = ''
	if (options.preserveContext && config) {
		const contextNodes = extractContextNodes(tree, config)
		contextPrefix = contextNodes.map((node) => getSourceText(tree, node)).join('\n')
		if (contextPrefix) contextPrefix += '\n\n'
	}

	// Get root node
	const root = tree.nodes[0]
	if (!root) return []

	// For JS/TS, navigate through Program node
	let topLevelNodes = root.children
	const lang = tree.meta.language.toLowerCase()
	if (topLevelNodes.length === 1 && ['javascript', 'typescript', 'jsx', 'tsx'].includes(lang)) {
		const firstChild = tree.nodes[topLevelNodes[0]]
		if (firstChild?.type === 'Program' && firstChild.children.length > 0) {
			topLevelNodes = firstChild.children
		}
	}

	// Process top-level children
	for (const childId of topLevelNodes) {
		const node = tree.nodes[childId]
		if (!node || !node.span) continue

		// Check if this is a semantic boundary
		const isBoundary = options.nodeTypes
			? options.nodeTypes.includes(node.type)
			: isSemanticBoundary(node, config)

		if (isBoundary) {
			const content = getSourceText(tree, node)
			const finalContent = options.preserveContext ? contextPrefix + content : content

			if (finalContent.length > options.maxChunkSize) {
				const subChunks = extractSubChunks(tree, node, options)
				chunks.push(...subChunks)
			} else {
				chunks.push({
					content: finalContent,
					type: node.type,
					startLine: node.span.start.line + 1,
					endLine: node.span.end.line + 1,
					metadata: { ...node.data },
				})
			}
		}
	}

	return chunks
}

/**
 * Parse code with Synth
 */
async function parseWithSynth(
	code: string,
	language: string,
	config: LanguageConfig | undefined
): Promise<Tree | null> {
	const parser = await loadSynthParser(language)
	if (!parser) return null

	try {
		const options = config?.parserOptions ?? {}
		// WASM parsers require async parsing
		return await parser.parseAsync(code, options)
	} catch (error) {
		console.error(`[WARN] Synth parsing failed for ${language}:`, error)
		return null
	}
}

/**
 * Recursively parse embedded code blocks
 */
async function parseEmbeddedChunks(
	chunks: ChunkResult[],
	config: LanguageConfig | undefined,
	options: ASTChunkOptions
): Promise<ChunkResult[]> {
	if (!config?.embedded) return chunks

	const result: ChunkResult[] = []

	for (const chunk of chunks) {
		const embeddedConfig = config.embedded.find((e) => e.nodeType === chunk.type)

		if (embeddedConfig?.recursive) {
			// Detect the embedded language
			const embeddedLang = detectEmbeddedLanguage(
				{ type: chunk.type, data: chunk.metadata } as BaseNode,
				embeddedConfig
			)

			if (embeddedLang && embeddedLang !== 'text' && embeddedLang !== 'plain') {
				// Get the actual code content (strip markdown fences if present)
				let codeContent = chunk.content
				const fenceMatch = codeContent.match(/^```\w*\n([\s\S]*?)\n```$/m)
				if (fenceMatch) {
					codeContent = fenceMatch[1]
				}

				// Recursively parse
				const subChunks = await chunkCodeByAST(codeContent, `file.${embeddedLang}`, {
					...options,
					parseEmbedded: false, // Prevent infinite recursion
				})

				if (subChunks.length > 0 && !subChunks[0].metadata.fallback) {
					// Add parent context to sub-chunks
					for (const subChunk of subChunks) {
						result.push({
							...subChunk,
							startLine: chunk.startLine + (subChunk.startLine - 1),
							endLine: chunk.startLine + (subChunk.endLine - 1),
							metadata: {
								...subChunk.metadata,
								embeddedIn: chunk.type,
								embeddedLanguage: embeddedLang,
							},
						})
					}
					continue
				}
			}
		}

		// Keep original chunk if no embedded parsing
		result.push(chunk)
	}

	return result
}

// ============================================
// Main API
// ============================================

/**
 * Chunk code using AST analysis
 *
 * @example
 * ```typescript
 * const chunks = await chunkCodeByAST(
 *   code,
 *   'example.ts',
 *   { maxChunkSize: 1000, preserveContext: true }
 * );
 * ```
 */
export async function chunkCodeByAST(
	code: string,
	filePath: string,
	options: ASTChunkOptions = {}
): Promise<readonly ChunkResult[]> {
	const {
		maxChunkSize = 1000,
		minChunkSize = 100,
		preserveContext = true,
		nodeTypes,
		parseEmbedded = true,
	} = options

	// 1. Detect language from file path
	const language = getLanguageFromPath(filePath)
	if (!language) {
		console.error('[WARN] Unknown language, falling back to character chunking')
		return createFallbackChunks(code, maxChunkSize)
	}

	// 2. Get language config
	const config = getLanguageConfig(language)

	// 3. Parse AST
	const tree = await parseWithSynth(code, language, config)
	if (!tree) {
		console.error('[WARN] AST parsing failed, falling back to character chunking')
		return createFallbackChunks(code, maxChunkSize)
	}

	// 4. Extract semantic chunks
	let chunks = extractSemanticChunks(tree, config, {
		maxChunkSize,
		minChunkSize,
		preserveContext,
		nodeTypes,
	})

	// 5. Parse embedded code (e.g., code blocks in markdown)
	if (parseEmbedded && config?.embedded) {
		chunks = await parseEmbeddedChunks(chunks, config, options)
	}

	// 6. Merge small chunks
	const merged = mergeSmallChunks(chunks, minChunkSize)

	// 7. Fallback if no chunks extracted
	if (merged.length === 0 && code.trim().length > 0) {
		return [
			{
				content: code,
				type: 'unknown',
				startLine: 1,
				endLine: code.split('\n').length,
				metadata: { fallback: true, reason: 'no-semantic-boundaries' },
			},
		]
	}

	return merged
}

/**
 * Create fallback chunks using character-based splitting
 */
function createFallbackChunks(code: string, maxChunkSize: number): ChunkResult[] {
	const chunks = chunkText(code, { maxChunkSize })
	return chunks.map((content, i) => ({
		content,
		type: 'text',
		startLine: 0,
		endLine: 0,
		metadata: { fallback: true, index: i },
	}))
}

/**
 * Simple wrapper for backward compatibility
 */
export async function chunkCodeByASTSimple(
	code: string,
	filePath: string,
	options: ASTChunkOptions = {}
): Promise<readonly string[]> {
	const chunks = await chunkCodeByAST(code, filePath, options)
	return chunks.map((chunk) => chunk.content)
}

/**
 * Get list of supported languages
 */
export function getSupportedLanguages(): string[] {
	return Object.keys(LANGUAGE_REGISTRY)
}
