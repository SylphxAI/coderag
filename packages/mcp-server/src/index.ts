#!/usr/bin/env node

/**
 * MCP Codebase Search Server
 * MCP server providing intelligent codebase search
 */

import {
	CodebaseIndexer,
	createEmbeddingProvider,
	type EmbeddingProvider,
	PersistentStorage,
	semanticSearch,
} from '@sylphx/coderag'
import { createServer, stdio, text, tool } from '@sylphx/mcp-server-sdk'
import { array, bool, description, num, object, optional, str } from '@sylphx/vex'

// Logger utility (stderr for MCP)
const Logger = {
	info: (message: string) => console.error(`[INFO] ${message}`),
	success: (message: string) => console.error(`[SUCCESS] ${message}`),
	error: (message: string, error?: unknown) => {
		console.error(`[ERROR] ${message}`)
		if (error) {
			console.error(error)
		}
	},
}

const SERVER_CONFIG = {
	name: '@sylphx/coderag-mcp',
	version: '1.0.0',
}

/**
 * Start the MCP Codebase Search Server
 */
async function main() {
	Logger.info('🚀 Starting MCP Codebase Search Server...')

	// Parse command line arguments
	const args = process.argv.slice(2)
	const codebaseRoot = args.find((arg) => arg.startsWith('--root='))?.split('=')[1] || process.cwd()
	const maxFileSize = parseInt(
		args.find((arg) => arg.startsWith('--max-size='))?.split('=')[1] || '1048576',
		10
	) // 1MB default
	const autoIndex = !args.includes('--no-auto-index')

	Logger.info(`📂 Codebase root: ${codebaseRoot}`)
	Logger.info(`📏 Max file size: ${(maxFileSize / 1024 / 1024).toFixed(2)} MB`)
	Logger.info(`🔄 Auto-index: ${autoIndex ? 'enabled' : 'disabled'}`)

	// Check for embedding provider (OpenAI API key)
	let embeddingProvider: EmbeddingProvider | undefined
	const openaiApiKey = process.env.OPENAI_API_KEY

	if (openaiApiKey) {
		try {
			embeddingProvider = await createEmbeddingProvider({
				provider: 'openai',
				model: 'text-embedding-3-small',
				dimensions: 1536,
			})
			Logger.info('🧠 Semantic search enabled (OpenAI embeddings)')
		} catch (error) {
			Logger.error('Failed to initialize embedding provider', error)
			Logger.info('⚠️ Falling back to keyword search')
		}
	} else {
		Logger.info('🔤 Keyword search mode (no OPENAI_API_KEY)')
	}

	const isSemanticSearch = !!embeddingProvider

	// Create persistent storage
	const storage = new PersistentStorage({ codebaseRoot })
	Logger.info('💾 Using persistent storage (SQLite)')

	// Create indexer
	const indexer = new CodebaseIndexer({
		codebaseRoot,
		maxFileSize,
		storage,
		embeddingProvider,
	})

	// Track indexing state for search handler
	let indexingPending = autoIndex // Will be set to false once indexing completes or fails

	// Tool descriptions based on search mode
	const toolDescription = isSemanticSearch
		? `Semantic search across the codebase using AI embeddings. Use natural language to describe what you're looking for.

**IMPORTANT: Use this tool PROACTIVELY before starting work, not reactively when stuck.**

This tool understands the meaning of your query and finds semantically related code, even if the exact words don't match.

When to use:
- **Before implementation**: "authentication flow with JWT tokens"
- **Before refactoring**: "error handling patterns"
- **Before debugging**: "database connection retry logic"

**Best Practice**: Describe what you're looking for in plain English.`
		: `Keyword search across the codebase using TF-IDF ranking. Use specific terms, function names, or technical keywords.

**IMPORTANT: Use this tool PROACTIVELY before starting work, not reactively when stuck.**

This tool finds files containing your exact search terms, ranked by relevance.

When to use:
- **Find specific functions**: "getUserById", "handleAuth"
- **Find error messages**: "ECONNREFUSED", "TypeError"
- **Find imports/exports**: "export const", "import { Router }"

**Best Practice**: Use specific keywords, function names, or exact terms.`

	const queryDescription = isSemanticSearch
		? 'Semantic search query - describe what you are looking for in natural language'
		: 'Keyword search query - use specific terms, function names, or technical keywords'

	// Define codebase search tool using builder pattern
	const codebaseSearch = tool()
		.description(toolDescription)
		.input(
			object({
				query: str(description(queryDescription)),
				limit: optional(num(description('Maximum number of results to return (default: 10)'))),
				include_content: optional(
					bool(description('Include file content snippets in results (default: true)'))
				),
				file_extensions: optional(
					array(str(), description('Filter by file extensions (e.g., [".ts", ".tsx", ".js"])'))
				),
				path_filter: optional(
					str(description('Filter by path pattern (e.g., "src/components", "tests", "docs")'))
				),
				exclude_paths: optional(
					array(
						str(),
						description(
							'Exclude paths containing these patterns (e.g., ["node_modules", ".git", "dist"])'
						)
					)
				),
				// Snippet options
				context_lines: optional(
					num(description('Lines of context around each matched line (default: 3)'))
				),
				max_snippet_chars: optional(
					num(description('Maximum characters per file snippet (default: 2000)'))
				),
				max_snippet_blocks: optional(num(description('Maximum code blocks per file (default: 4)'))),
			})
		)
		.handler(async ({ input }) => {
			try {
				const {
					query,
					limit = 10,
					include_content = true,
					file_extensions,
					path_filter,
					exclude_paths,
					context_lines = 3,
					max_snippet_chars = 2000,
					max_snippet_blocks = 4,
				} = input

				// Check indexing status
				const status = indexer.getStatus()

				if (status.isIndexing) {
					const progressBar =
						'█'.repeat(Math.floor(status.progress / 5)) +
						'░'.repeat(20 - Math.floor(status.progress / 5))

					return text(
						`⏳ **Codebase Indexing In Progress**\n\nThe codebase is currently being indexed. Please wait...\n\n**Progress:** ${status.progress}%\n\`${progressBar}\`\n\n**Status:**\n- Chunks indexed: ${status.indexedChunks}${status.totalChunks ? `/${status.totalChunks}` : ''}\n- Files processed: ${status.processedFiles}/${status.totalFiles}\n${status.currentFile ? `- Current file: \`${status.currentFile}\`` : ''}\n\n💡 **Tip:** Try your search again in a few seconds.`
					)
				}

				// Perform search (semantic if available, otherwise keyword)
				let results: Array<{
					path: string
					score: number
					language?: string
					size?: number
					matchedTerms?: string[]
					snippet?: string
					content?: string
				}>
				try {
					results = isSemanticSearch
						? await semanticSearch(query, indexer, {
								limit,
								fileExtensions: file_extensions,
								pathFilter: path_filter,
								excludePaths: exclude_paths,
							})
						: await indexer.search(query, {
								limit,
								includeContent: include_content,
								fileExtensions: file_extensions,
								pathFilter: path_filter,
								excludePaths: exclude_paths,
								contextLines: context_lines,
								maxSnippetChars: max_snippet_chars,
								maxSnippetBlocks: max_snippet_blocks,
							})
				} catch (searchError) {
					// Index not ready yet (background indexing hasn't completed)
					const errorMsg = (searchError as Error).message
					if (errorMsg.toLowerCase().includes('not indexed')) {
						const status = indexer.getStatus()
						if (status.isIndexing) {
							const pct = status.progress
							const progressBar =
								'█'.repeat(Math.floor(pct / 5)) + '░'.repeat(20 - Math.floor(pct / 5))
							return text(
								`⏳ **Indexing In Progress**\n\n**Progress:** ${pct}%\n\`${progressBar}\`\n\n**Chunks:** ${status.indexedChunks}${status.totalChunks ? `/${status.totalChunks}` : ''} | **Files:** ${status.processedFiles}/${status.totalFiles}\n${status.currentFile ? `**Current:** \`${status.currentFile}\`` : ''}\n\n💡 Try again in a few seconds.`
							)
						}
						if (indexingPending) {
							return text(
								`⏳ **Indexing Starting...**\n\nThe codebase index is being built in the background.\n\n💡 **Tip:** Try your search again in a few seconds.`
							)
						}
						// Indexing failed or was disabled
						return text(
							`❌ **Index Not Available**\n\nThe codebase has not been indexed.\n\n**Possible causes:**\n- Indexing failed (check server logs)\n- Auto-indexing is disabled\n\n💡 Restart the MCP server to retry.`
						)
					}
					throw searchError
				}

				// Get indexed count for display
				const indexedCount = await indexer.getIndexedCount()

				if (results.length === 0) {
					return text(
						`# Search: "${query}" (0 results)\n\nNo matches found. Try different terms or check filters.\nIndexed files: ${indexedCount}`
					)
				}

				// Format results - optimized for LLM consumption (minimal tokens, maximum content)
				let formattedResults = `# Search: "${query}" (${results.length} results)\n\n`

				for (const result of results as Array<{
					path: string
					score: number
					language?: string
					size?: number
					matchedTerms?: string[]
					snippet?: string
					content?: string
					chunkType?: string
					startLine?: number
					endLine?: number
				}>) {
					// Build file path with line range (check !== undefined since 0 is valid)
					let header = result.path
					if (result.startLine !== undefined && result.endLine !== undefined) {
						header += `:${result.startLine}-${result.endLine}`
					}

					// Add embedded indicator for code blocks in markdown/html
					const isEmbedded =
						result.chunkType?.startsWith('code') &&
						(result.language === 'Markdown' || result.language === 'HTML')
					if (isEmbedded) {
						// Extract embedded language from snippet if available (e.g., "66: ```typescript")
						const langMatch = result.snippet?.match(/```(\w+)/)
						const embeddedLang = langMatch?.[1] || 'code'
						header += ` [${result.language?.toLowerCase()}→${embeddedLang}]`
					}

					formattedResults += `## ${header}\n`

					// Show content snippet
					const maxSnippetLen = 2000 // Max chars for snippet display

					if (result.snippet) {
						// Determine language for syntax highlighting
						let lang = ''
						if (isEmbedded) {
							// For embedded code, extract the actual language
							const langMatch = result.snippet.match(/```(\w+)/)
							lang = langMatch?.[1] || ''
						} else {
							lang = result.language?.toLowerCase() || ''
						}

						// Truncate long snippets with head+tail format
						let snippetContent = result.snippet
						if (snippetContent.length > maxSnippetLen) {
							const headLen = Math.floor(maxSnippetLen * 0.7) // 70% head
							const tailLen = Math.floor(maxSnippetLen * 0.2) // 20% tail
							const head = snippetContent.substring(0, headLen)
							const tail = snippetContent.substring(snippetContent.length - tailLen)
							const truncatedChars = snippetContent.length - headLen - tailLen
							snippetContent = `${head}\n\n... [${truncatedChars} chars truncated] ...\n\n${tail}`
							// Add truncation indicator to header
							formattedResults = `${formattedResults.trimEnd()} [truncated]\n`
						}
						formattedResults += `\`\`\`${lang}\n${snippetContent}\n\`\`\`\n\n`
					} else if (result.content) {
						// Truncate long content with head+tail format
						const maxLen = 500
						let preview: string
						let isTruncated = false
						if (result.content.length > maxLen) {
							isTruncated = true
							// Show first 350 chars + ... + last 100 chars
							const headLen = 350
							const tailLen = 100
							const head = result.content.substring(0, headLen)
							const tail = result.content.substring(result.content.length - tailLen)
							preview = `${head}\n\n... [${result.content.length - headLen - tailLen} chars truncated] ...\n\n${tail}`
						} else {
							preview = result.content
						}
						// Add truncation indicator to header if needed
						if (isTruncated) {
							formattedResults = `${formattedResults.trimEnd()} [truncated]\n`
						}
						formattedResults += `\`\`\`\n${preview}\n\`\`\`\n\n`
					}
				}

				return text(formattedResults)
			} catch (error) {
				return text(`✗ Codebase search error: ${(error as Error).message}`)
			}
		})

	// Create MCP server with the new SDK
	const serverDescription = isSemanticSearch
		? 'MCP server providing semantic code search using AI embeddings'
		: 'MCP server providing keyword-based code search using TF-IDF'

	const server = createServer({
		name: SERVER_CONFIG.name,
		version: SERVER_CONFIG.version,
		instructions: serverDescription,
		tools: {
			codebase_search: codebaseSearch,
		},
		transport: stdio(),
	})

	Logger.info(
		`✓ Registered codebase_search tool (${isSemanticSearch ? 'semantic' : 'keyword'} mode)`
	)

	// Start indexing BEFORE server.start() since server.start() blocks waiting for client
	// This way indexing runs concurrently while waiting for MCP client to connect
	if (autoIndex) {
		Logger.info('📚 Starting automatic indexing...')
		// Don't await - let it run in background
		indexer
			.index({
				watch: true, // Enable file watching
				onProgress: (current, total, file) => {
					// Log every 10 files or at completion
					if (current % 10 === 0 || current === total) {
						const pct = Math.round((current / total) * 100)
						Logger.info(`Indexing: ${current}/${total} (${pct}%) - ${file}`)
					}
				},
				onFileChange: (event) => {
					Logger.info(`File ${event.type}: ${event.path}`)
				},
			})
			.then(async () => {
				indexingPending = false
				Logger.success(`✓ Indexed ${await indexer.getIndexedCount()} files`)
				Logger.info('👁️  Watching for file changes...')
			})
			.catch((error) => {
				indexingPending = false
				Logger.error('❌ Failed to index codebase:', (error as Error).message)
				if ((error as Error).stack) {
					Logger.error((error as Error).stack as string)
				}
			})
	}

	// Start server (blocks waiting for MCP client to connect)
	try {
		await server.start()
		Logger.success('✓ MCP Server connected and ready')
	} catch (error: unknown) {
		Logger.error('Failed to start MCP server', error)
		process.exit(1)
	}

	Logger.info('💡 Press Ctrl+C to stop the server')
}

// Handle process signals
process.on('SIGINT', () => {
	Logger.info('\n🛑 Shutting down MCP server...')
	process.exit(0)
})

process.on('SIGTERM', () => {
	Logger.info('\n🛑 Shutting down MCP server...')
	process.exit(0)
})

// Start the server
main().catch((error) => {
	Logger.error('Fatal error', error)
	process.exit(1)
})
