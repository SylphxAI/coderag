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
import { z } from 'zod'

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
			z.object({
				query: z.string().describe(queryDescription),
				limit: z
					.number()
					.default(10)
					.optional()
					.describe('Maximum number of results to return (default: 10)'),
				include_content: z
					.boolean()
					.default(true)
					.optional()
					.describe('Include file content snippets in results (default: true)'),
				file_extensions: z
					.array(z.string())
					.optional()
					.describe('Filter by file extensions (e.g., [".ts", ".tsx", ".js"])'),
				path_filter: z
					.string()
					.optional()
					.describe('Filter by path pattern (e.g., "src/components", "tests", "docs")'),
				exclude_paths: z
					.array(z.string())
					.optional()
					.describe(
						'Exclude paths containing these patterns (e.g., ["node_modules", ".git", "dist"])'
					),
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
				} = input

				// Check indexing status
				const status = indexer.getStatus()

				if (status.isIndexing) {
					const progressBar =
						'█'.repeat(Math.floor(status.progress / 5)) +
						'░'.repeat(20 - Math.floor(status.progress / 5))

					return text(
						`⏳ **Codebase Indexing In Progress**\n\nThe codebase is currently being indexed. Please wait...\n\n**Progress:** ${status.progress}%\n\`${progressBar}\`\n\n**Status:**\n- Files indexed: ${status.indexedFiles}/${status.totalFiles}\n${status.currentFile ? `- Current file: \`${status.currentFile}\`` : ''}\n\n💡 **Tip:** Try your search again in a few seconds.`
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
								`⏳ **Indexing In Progress**\n\n**Progress:** ${pct}%\n\`${progressBar}\`\n\n**Files:** ${status.indexedFiles}/${status.totalFiles}\n${status.currentFile ? `**Current:** \`${status.currentFile}\`` : ''}\n\n💡 Try again in a few seconds.`
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
						`🔍 **No Results Found**\n\nNo files matched your search query: "${query}"\n\n**Suggestions:**\n- Try different search terms\n- ${isSemanticSearch ? 'Describe what you are looking for differently' : 'Use more specific keywords'}\n- Check if file filters are too restrictive\n\n**Total files indexed:** ${indexedCount}`
					)
				}

				// Format results
				const searchMode = isSemanticSearch ? 'Semantic' : 'Keyword'
				let formattedResults = `# 🔍 ${searchMode} Search Results\n\n**Query:** "${query}"\n**Results:** ${results.length} / ${indexedCount} files\n\n`

				for (let i = 0; i < results.length; i++) {
					const result = results[i]
					formattedResults += `## ${i + 1}. \`${result.path}\`\n\n`
					formattedResults += `- **Score:** ${result.score.toFixed(4)}\n`
					if (result.language) {
						formattedResults += `- **Language:** ${result.language}\n`
					}
					if ('size' in result && result.size) {
						formattedResults += `- **Size:** ${(result.size / 1024).toFixed(2)} KB\n`
					}
					if (result.matchedTerms && result.matchedTerms.length > 0) {
						formattedResults += `- **Matched Terms:** ${result.matchedTerms.join(', ')}\n`
					}

					// Show content snippet
					if ('snippet' in result && result.snippet) {
						formattedResults += `\n**Snippet:**\n\`\`\`\n${result.snippet}\n\`\`\`\n`
					} else if ('content' in result && result.content) {
						formattedResults += `\n**Preview:**\n\`\`\`\n${result.content.substring(0, 500)}${result.content.length > 500 ? '...' : ''}\n\`\`\`\n`
					}

					formattedResults += '\n---\n\n'
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

	// Start server immediately (don't wait for indexing)
	try {
		await server.start()
		Logger.success('✓ MCP Server connected and ready')
	} catch (error: unknown) {
		Logger.error('Failed to start MCP server', error)
		process.exit(1)
	}

	// Auto-index in background (non-blocking)
	if (autoIndex) {
		Logger.info('📚 Starting automatic indexing (background)...')
		// Use setImmediate to ensure server is fully ready before indexing starts
		setImmediate(() => {
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
		})
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
if (import.meta.main) {
	main().catch((error) => {
		Logger.error('Fatal error', error)
		process.exit(1)
	})
}
