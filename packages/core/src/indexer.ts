/**
 * Codebase indexer service
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import type { EmbeddingProvider } from './embeddings.js'
import { IncrementalTFIDF, type IncrementalUpdate } from './incremental-tfidf.js'
import { createCacheKey, LRUCache } from './search-cache.js'
import { type CodebaseFile, MemoryStorage, type Storage } from './storage.js'
import { PersistentStorage } from './storage-persistent.js'
import {
	buildSearchIndex,
	getQueryTokens,
	type SearchIndex,
	searchDocumentsFromStorage,
} from './tfidf.js'
import {
	detectLanguage,
	type FileMetadata,
	isTextFile,
	loadGitignore,
	readFileContent,
	scanFileMetadata,
	simpleHash,
} from './utils.js'
import { type VectorDocument, VectorStorage } from './vector-storage.js'

export interface IndexerOptions {
	codebaseRoot?: string
	maxFileSize?: number
	storage?: Storage
	onProgress?: (current: number, total: number, file: string) => void
	watch?: boolean
	onFileChange?: (event: FileChangeEvent) => void
	embeddingProvider?: EmbeddingProvider
	vectorBatchSize?: number // Default: 10
	indexingBatchSize?: number // Default: 50 - files processed per batch (Memory optimization)
	lowMemoryMode?: boolean // Default: true - use SQL-based search instead of in-memory index
}

export interface FileChangeEvent {
	type: 'add' | 'change' | 'unlink'
	path: string
	timestamp: number
}

export interface IndexingStatus {
	isIndexing: boolean
	progress: number
	totalFiles: number
	indexedFiles: number
	currentFile?: string
}

export class CodebaseIndexer {
	private codebaseRoot: string
	private maxFileSize: number
	private storage: Storage
	private searchIndex: SearchIndex | null = null
	private incrementalEngine: IncrementalTFIDF | null = null
	private pendingFileChanges: IncrementalUpdate[] = []
	private searchCache: LRUCache<SearchResult[]>
	private watcher: import('@parcel/watcher').AsyncSubscription | null = null
	private isWatching = false
	private onFileChangeCallback?: (event: FileChangeEvent) => void
	private pendingUpdates = new Map<string, NodeJS.Timeout>()
	private ignoreFilter: any = null
	private status: IndexingStatus = {
		isIndexing: false,
		progress: 0,
		totalFiles: 0,
		indexedFiles: 0,
	}
	private vectorStorage?: VectorStorage
	private embeddingProvider?: EmbeddingProvider
	private vectorBatchSize: number
	private indexingBatchSize: number
	private lowMemoryMode: boolean

	constructor(options: IndexerOptions = {}) {
		this.codebaseRoot = options.codebaseRoot || process.cwd()
		this.maxFileSize = options.maxFileSize || 1048576 // 1MB
		this.storage = options.storage || new MemoryStorage()
		this.onFileChangeCallback = options.onFileChange
		this.searchCache = new LRUCache<SearchResult[]>(100, 5) // 100 entries, 5 min TTL
		this.embeddingProvider = options.embeddingProvider
		this.vectorBatchSize = options.vectorBatchSize || 10
		this.indexingBatchSize = options.indexingBatchSize || 50 // Memory optimization
		// Default to low memory mode when using persistent storage
		this.lowMemoryMode = options.lowMemoryMode ?? options.storage instanceof PersistentStorage

		// Initialize vector storage if embedding provider is available
		if (this.embeddingProvider) {
			const vectorDbPath = path.join(this.codebaseRoot, '.codebase-search', 'vectors.lance')

			this.vectorStorage = new VectorStorage({
				dimensions: this.embeddingProvider.dimensions,
				dbPath: vectorDbPath,
			})
			console.error(
				`[INFO] Vector storage initialized: ${this.embeddingProvider.dimensions} dimensions`
			)
		}
	}

	/**
	 * Get current indexing status
	 */
	getStatus(): IndexingStatus {
		return { ...this.status }
	}

	/**
	 * Get search index
	 */
	getSearchIndex(): SearchIndex | null {
		return this.searchIndex
	}

	/**
	 * Index the codebase
	 */
	async index(options: IndexerOptions = {}): Promise<void> {
		this.status.isIndexing = true
		this.status.progress = 0
		this.status.indexedFiles = 0

		try {
			// Try to load existing index from persistent storage
			if (this.storage instanceof PersistentStorage) {
				const existingCount = await this.storage.count()
				if (existingCount > 0) {
					console.error(`[INFO] Found existing index with ${existingCount} files`)

					// In low memory mode, just verify index exists - don't load to memory
					if (this.lowMemoryMode) {
						// Verify IDF scores exist (index is valid)
						const idf = await this.storage.getIdfScores()
						if (idf.size > 0) {
							console.error('[SUCCESS] Index verified (low memory mode - not loaded to RAM)')
							this.status.progress = 100
							this.status.indexedFiles = existingCount
							this.status.totalFiles = existingCount

							// Start watching if requested
							if (options.watch) {
								await this.startWatch()
							}

							this.status.isIndexing = false
							return
						}
						console.error('[WARN] Index verification failed, rebuilding...')
					} else {
						console.error('[INFO] Loading index from database...')
						const loaded = await this.loadSearchIndexFromStorage()
						if (loaded) {
							console.error('[SUCCESS] Index loaded from database')
							this.status.progress = 100
							this.status.indexedFiles = existingCount
							this.status.totalFiles = existingCount

							// Start watching if requested
							if (options.watch) {
								await this.startWatch()
							}

							this.status.isIndexing = false
							return
						}
						console.error('[WARN] Failed to load index, rebuilding...')
					}
				}
			}

			// Load .gitignore
			this.ignoreFilter = loadGitignore(this.codebaseRoot)
			const ignoreFilter = this.ignoreFilter

			// Phase 1: Scan file metadata only (no content loaded - Memory optimization)
			console.error('[INFO] Scanning codebase (metadata only)...')
			const fileMetadataList: FileMetadata[] = []
			for (const metadata of scanFileMetadata(this.codebaseRoot, {
				ignoreFilter,
				codebaseRoot: this.codebaseRoot,
				maxFileSize: options.maxFileSize,
			})) {
				fileMetadataList.push(metadata)
			}

			this.status.totalFiles = fileMetadataList.length
			console.error(`[INFO] Found ${fileMetadataList.length} files`)

			// Phase 2: Process files in batches (Memory optimization)
			// Only batch content is in memory at any time
			console.error(`[INFO] Processing files in batches of ${this.indexingBatchSize}...`)

			// Initialize incremental engine for batch building
			this.incrementalEngine = new IncrementalTFIDF()

			const batchSize = this.indexingBatchSize
			let processedCount = 0

			for (let i = 0; i < fileMetadataList.length; i += batchSize) {
				const batchMetadata = fileMetadataList.slice(i, i + batchSize)
				const batchFiles: CodebaseFile[] = []
				const batchUpdates: import('./incremental-tfidf.js').IncrementalUpdate[] = []

				// Read content for this batch only
				for (const metadata of batchMetadata) {
					const content = readFileContent(metadata.absolutePath)
					if (content === null) continue

					const codebaseFile: CodebaseFile = {
						path: metadata.path,
						content,
						size: metadata.size,
						mtime: new Date(metadata.mtime),
						language: metadata.language,
						hash: simpleHash(content),
					}
					batchFiles.push(codebaseFile)

					// Prepare incremental update
					batchUpdates.push({
						type: 'add',
						uri: `file://${metadata.path}`,
						newContent: content,
					})

					processedCount++
					this.status.currentFile = metadata.path
					this.status.indexedFiles = processedCount
					this.status.progress = Math.round((processedCount / fileMetadataList.length) * 50)
					options.onProgress?.(processedCount, fileMetadataList.length, metadata.path)
				}

				// Store batch to database
				if (batchFiles.length > 0) {
					if (this.storage.storeFiles) {
						await this.storage.storeFiles(batchFiles)
					} else {
						for (const file of batchFiles) {
							await this.storage.storeFile(file)
						}
					}

					// Add batch to incremental engine (builds index incrementally)
					await this.incrementalEngine.applyUpdates(batchUpdates)
				}

				// Clear batch references for GC
				batchFiles.length = 0
				batchUpdates.length = 0
			}

			// Build final search index from incremental engine
			console.error('[INFO] Finalizing search index...')
			const indexData = this.incrementalEngine.getIndex()
			this.searchIndex = {
				documents: indexData.documents,
				idf: indexData.idf,
				totalDocuments: indexData.totalDocuments,
				metadata: {
					generatedAt: new Date().toISOString(),
					version: '1.0.0',
				},
			}
			this.status.progress = 75

			// Persist TF-IDF vectors if using persistent storage
			if (this.storage instanceof PersistentStorage) {
				console.error('[INFO] Persisting TF-IDF vectors...')
				await this.persistSearchIndex()
				console.error('[SUCCESS] TF-IDF vectors persisted')

				// In low memory mode, release the in-memory index after persisting
				// Search will use SQL-based queries instead
				if (this.lowMemoryMode) {
					this.searchIndex = null
					this.incrementalEngine = null
					console.error('[INFO] Low memory mode: released in-memory index')
				}
			}

			if (!this.lowMemoryMode) {
				console.error('[INFO] Incremental index engine initialized')
			}

			// Build vector index if embedding provider available
			if (this.embeddingProvider && this.vectorStorage) {
				await this.buildVectorIndexFromMetadata(fileMetadataList)
			}

			this.status.progress = 100
			console.error(`[SUCCESS] Indexed ${fileMetadataList.length} files`)

			// Start watching if requested
			if (options.watch) {
				await this.startWatch()
			}
		} catch (error) {
			console.error('[ERROR] Failed to index codebase:', error)
			throw error
		} finally {
			this.status.isIndexing = false
			this.status.currentFile = undefined
		}
	}

	/**
	 * Start watching for file changes
	 * Uses @parcel/watcher which provides native FSEvents on macOS
	 */
	async startWatch(): Promise<void> {
		if (this.isWatching) {
			console.error('[WARN] Already watching for changes')
			return
		}

		if (!this.ignoreFilter) {
			this.ignoreFilter = loadGitignore(this.codebaseRoot)
		}

		console.error('[INFO] Starting file watcher (native FSEvents)...')

		const watcher = await import('@parcel/watcher')

		// Subscribe to file changes
		this.watcher = await watcher.subscribe(
			this.codebaseRoot,
			(err, events) => {
				if (err) {
					console.error('[WARN] File watcher error:', err.message)
					return
				}

				for (const event of events) {
					const absolutePath = event.path
					const relativePath = path.relative(this.codebaseRoot, absolutePath)

					// Skip ignored files
					if (this.shouldIgnore(relativePath)) {
						continue
					}

					// Map @parcel/watcher event types to our types
					const eventType =
						event.type === 'create' ? 'add' : event.type === 'delete' ? 'unlink' : 'change'

					this.handleFileChange(eventType, absolutePath)
				}
			},
			{
				// Use native backend (FSEvents on macOS, inotify on Linux)
				backend: undefined, // auto-detect best backend
				ignore: [
					'**/node_modules/**',
					'**/.git/**',
					'**/dist/**',
					'**/build/**',
					'**/.next/**',
					'**/.turbo/**',
					'**/.cache/**',
					'**/coverage/**',
					'**/*.log',
				],
			}
		)

		this.isWatching = true
		console.error('[SUCCESS] File watcher started (native FSEvents)')
	}

	/**
	 * Check if a file should be ignored
	 */
	private shouldIgnore(relativePath: string): boolean {
		// Skip empty paths
		if (!relativePath) return true

		// Check gitignore
		if (this.ignoreFilter?.ignores(relativePath)) {
			return true
		}

		return false
	}

	/**
	 * Stop watching for file changes
	 */
	async stopWatch(): Promise<void> {
		if (!this.isWatching || !this.watcher) {
			return
		}

		console.error('[INFO] Stopping file watcher...')
		await this.watcher.unsubscribe()
		this.watcher = null
		this.isWatching = false

		// Clear pending updates
		for (const timeout of this.pendingUpdates.values()) {
			clearTimeout(timeout)
		}
		this.pendingUpdates.clear()

		console.error('[SUCCESS] File watcher stopped')
	}

	/**
	 * Handle file change events with debouncing
	 */
	private handleFileChange(type: 'add' | 'change' | 'unlink', absolutePath: string): void {
		const relativePath = path.relative(this.codebaseRoot, absolutePath)

		// Check if file should be ignored
		if (this.ignoreFilter?.ignores(relativePath)) {
			return
		}

		// Debounce updates (wait 500ms after last change)
		const existing = this.pendingUpdates.get(relativePath)
		if (existing) {
			clearTimeout(existing)
		}

		const timeout = setTimeout(async () => {
			this.pendingUpdates.delete(relativePath)
			await this.processFileChange(type, relativePath, absolutePath)
		}, 500)

		this.pendingUpdates.set(relativePath, timeout)
	}

	/**
	 * Process file change and update index
	 */
	private async processFileChange(
		type: 'add' | 'change' | 'unlink',
		relativePath: string,
		absolutePath: string
	): Promise<void> {
		const event: FileChangeEvent = {
			type,
			path: relativePath,
			timestamp: Date.now(),
		}

		try {
			if (type === 'unlink') {
				// Track deletion for incremental update
				const existingFile = await this.storage.getFile(relativePath)
				if (existingFile && this.searchIndex) {
					const oldDoc = this.searchIndex.documents.find((d) => d.uri === `file://${relativePath}`)
					if (oldDoc) {
						this.pendingFileChanges.push({
							type: 'delete',
							uri: `file://${relativePath}`,
							oldDocument: oldDoc,
						})
					}
				}

				// Remove from storage
				await this.storage.deleteFile(relativePath)
				// Remove from vector storage
				await this.deleteFileVector(relativePath)
				console.error(`[FILE] Removed: ${relativePath}`)
			} else {
				// Check if file is text and within size limit
				const stats = await fs.stat(absolutePath)
				if (stats.size > this.maxFileSize) {
					console.error(`[FILE] Skipped (too large): ${relativePath}`)
					return
				}

				if (!isTextFile(absolutePath)) {
					console.error(`[FILE] Skipped (binary): ${relativePath}`)
					return
				}

				// Read file content
				const content = await fs.readFile(absolutePath, 'utf-8')
				const hash = simpleHash(content)

				// OPTIMIZATION: Check if file actually changed using hash comparison
				const existingFile = await this.storage.getFile(relativePath)
				if (existingFile && existingFile.hash === hash) {
					console.error(`[FILE] Skipped (unchanged): ${relativePath}`)
					// File hasn't changed, skip indexing
					this.onFileChangeCallback?.(event)
					return
				}

				// Track change for incremental update
				if (this.searchIndex) {
					const uri = `file://${relativePath}`
					const oldDoc = this.searchIndex.documents.find((d) => d.uri === uri)

					if (oldDoc) {
						// Update existing document
						this.pendingFileChanges.push({
							type: 'update',
							uri,
							oldDocument: oldDoc,
							newContent: content,
						})
					} else {
						// Add new document
						this.pendingFileChanges.push({
							type: 'add',
							uri,
							newContent: content,
						})
					}
				}

				// File changed or new, process it
				const codebaseFile: CodebaseFile = {
					path: relativePath,
					content,
					size: stats.size,
					mtime: stats.mtime,
					language: detectLanguage(relativePath),
					hash,
				}

				await this.storage.storeFile(codebaseFile)
				// Update vector storage
				await this.updateFileVector(relativePath, content)
				console.error(`[FILE] ${type === 'add' ? 'Added' : 'Updated'}: ${relativePath}`)
			}

			// Rebuild search index
			await this.rebuildSearchIndex()

			// Notify callback
			this.onFileChangeCallback?.(event)
		} catch (error) {
			console.error(`[ERROR] Failed to process file change (${relativePath}):`, error)
		}
	}

	/**
	 * Rebuild search index from current storage
	 * Uses incremental update when possible for performance
	 */
	private async rebuildSearchIndex(): Promise<void> {
		// If no incremental engine or no pending changes, do full rebuild
		if (!this.incrementalEngine || this.pendingFileChanges.length === 0) {
			return this.fullRebuildSearchIndex()
		}

		// Check if incremental update is recommended
		if (this.incrementalEngine.shouldFullRebuild(this.pendingFileChanges)) {
			console.error('[INFO] Changes too extensive, performing full rebuild instead of incremental')
			this.pendingFileChanges = []
			return this.fullRebuildSearchIndex()
		}

		// Perform incremental update
		const _startTime = Date.now()
		const stats = await this.incrementalEngine.applyUpdates(this.pendingFileChanges)
		this.pendingFileChanges = []

		// Update search index from incremental engine
		const indexData = this.incrementalEngine.getIndex()
		this.searchIndex = {
			documents: indexData.documents,
			idf: indexData.idf,
			totalDocuments: indexData.totalDocuments,
			metadata: {
				generatedAt: new Date().toISOString(),
				version: '1.0.0',
			},
		}

		console.error(
			`[SUCCESS] Incremental update: ${stats.affectedDocuments} docs, ${stats.affectedTerms} terms, ${stats.updateTime}ms`
		)

		// Invalidate search cache (index changed)
		this.searchCache.invalidate()
		console.error('[INFO] Search cache invalidated')

		// Persist if using persistent storage
		if (this.storage instanceof PersistentStorage) {
			await this.persistSearchIndex()
		}
	}

	/**
	 * Full rebuild of search index (fallback when incremental not possible)
	 */
	private async fullRebuildSearchIndex(): Promise<void> {
		const allFiles = await this.storage.getAllFiles()
		const documents = allFiles.map((file) => ({
			uri: `file://${file.path}`,
			content: file.content,
		}))

		this.searchIndex = buildSearchIndex(documents)

		// Reinitialize incremental engine
		this.incrementalEngine = new IncrementalTFIDF(this.searchIndex.documents, this.searchIndex.idf)

		// Invalidate search cache (index changed)
		this.searchCache.invalidate()
		console.error('[INFO] Search cache invalidated')

		// Persist if using persistent storage
		if (this.storage instanceof PersistentStorage) {
			await this.persistSearchIndex()
		}
	}

	/**
	 * Persist search index to storage
	 */
	private async persistSearchIndex(): Promise<void> {
		if (!this.searchIndex || !(this.storage instanceof PersistentStorage)) {
			return
		}

		// Store IDF scores
		const docFreq = new Map<string, number>()
		for (const doc of this.searchIndex.documents) {
			const uniqueTerms = new Set(doc.rawTerms.keys())
			for (const term of uniqueTerms) {
				docFreq.set(term, (docFreq.get(term) || 0) + 1)
			}
		}
		await this.storage.storeIdfScores(this.searchIndex.idf, docFreq)

		// Prepare document vectors for batch storage
		const documentsToStore = this.searchIndex.documents.map((doc) => {
			const filePath = doc.uri.replace(/^file:\/\//, '')
			const totalTerms = Array.from(doc.rawTerms.values()).reduce((sum, freq) => sum + freq, 0)

			const terms = new Map<string, { tf: number; tfidf: number; rawFreq: number }>()
			for (const [term, tfidfScore] of doc.terms.entries()) {
				const rawFreq = doc.rawTerms.get(term) || 0
				const tf = rawFreq / totalTerms
				terms.set(term, {
					tf,
					tfidf: tfidfScore,
					rawFreq,
				})
			}

			return { filePath, terms }
		})

		// Use batch operation (PersistentStorage specific)
		const persistentStorage = this.storage as PersistentStorage
		if (persistentStorage.storeManyDocumentVectors) {
			console.error('[INFO] Using batch vector storage operation')
			await persistentStorage.storeManyDocumentVectors(documentsToStore)
		} else {
			// Fallback to one-by-one storage
			for (const { filePath, terms } of documentsToStore) {
				await persistentStorage.storeDocumentVectors(filePath, terms)
			}
		}
	}

	/**
	 * Load search index from persistent storage
	 */
	private async loadSearchIndexFromStorage(): Promise<boolean> {
		if (!(this.storage instanceof PersistentStorage)) {
			return false
		}

		try {
			// Load IDF scores
			const idf = await this.storage.getIdfScores()
			if (idf.size === 0) {
				return false
			}

			// Load all document vectors in single batch query (CPU + Memory optimization)
			// This replaces N+1 query pattern with single JOIN query
			const allVectors = await this.storage.getAllDocumentVectors()
			if (allVectors.size === 0) {
				return false
			}

			// Reconstruct document vectors from batch result
			const documentVectors: Array<{
				uri: string
				terms: Map<string, number>
				rawTerms: Map<string, number>
				magnitude: number
			}> = []

			for (const [filePath, vectors] of allVectors) {
				// Build terms and rawTerms maps
				const terms = new Map<string, number>()
				const rawTerms = new Map<string, number>()

				for (const [term, data] of vectors.entries()) {
					terms.set(term, data.tfidf)
					rawTerms.set(term, data.rawFreq)
				}

				// Calculate magnitude
				let sumSquares = 0
				for (const tfidf of terms.values()) {
					sumSquares += tfidf * tfidf
				}
				const magnitude = Math.sqrt(sumSquares)

				documentVectors.push({
					uri: `file://${filePath}`,
					terms,
					rawTerms,
					magnitude,
				})
			}

			// Build search index
			this.searchIndex = {
				documents: documentVectors,
				idf,
				totalDocuments: documentVectors.length,
				metadata: {
					generatedAt: new Date().toISOString(),
					version: '1.0.0',
				},
			}

			// Initialize incremental engine for future updates
			this.incrementalEngine = new IncrementalTFIDF(
				this.searchIndex.documents,
				this.searchIndex.idf
			)
			console.error('[INFO] Incremental update engine initialized from database')

			return true
		} catch (error) {
			console.error('[ERROR] Failed to load search index from storage:', error)
			return false
		}
	}

	/**
	 * Check if currently watching for changes
	 */
	isWatchEnabled(): boolean {
		return this.isWatching
	}

	/**
	 * Search the codebase
	 */
	async search(
		query: string,
		options: {
			limit?: number
			includeContent?: boolean
			fileExtensions?: string[]
			pathFilter?: string
			excludePaths?: string[]
		} = {}
	): Promise<SearchResult[]> {
		const { limit = 10, includeContent = true } = options

		// Create cache key from query and options
		const cacheKey = createCacheKey(query, {
			limit,
			fileExtensions: options.fileExtensions,
			pathFilter: options.pathFilter,
			excludePaths: options.excludePaths,
		})

		// Check cache first
		const cachedResults = this.searchCache.get(cacheKey)
		if (cachedResults) {
			console.error(`[CACHE HIT] Query: "${query}"`)
			return cachedResults
		}

		console.error(`[CACHE MISS] Query: "${query}"`)

		// Use SQL-based search in low memory mode (Memory optimization)
		let results: Array<{ uri: string; score: number; matchedTerms: string[] }>

		if (this.lowMemoryMode && this.storage instanceof PersistentStorage) {
			// SQL-based search - doesn't require loading index to memory
			const queryTokens = getQueryTokens(query)
			const candidates = await this.storage.searchByTerms(queryTokens, { limit: limit * 3 })
			const idf = await this.storage.getIdfScoresForTerms(queryTokens)
			results = searchDocumentsFromStorage(query, candidates, idf, { limit })
			console.error(`[SQL SEARCH] Found ${results.length} results`)
		} else {
			// In-memory search (faster but uses more memory)
			if (!this.searchIndex) {
				throw new Error('Codebase not indexed. Please run index() first.')
			}
			results = await import('./tfidf.js').then((m) =>
				m.searchDocuments(query, this.searchIndex!, { limit })
			)
		}

		// Get file content and apply filters
		const searchResults: SearchResult[] = []

		for (const result of results) {
			const filePath = result.uri.replace('file://', '')

			// Apply filters
			if (options.fileExtensions && options.fileExtensions.length > 0) {
				if (!options.fileExtensions.some((ext) => filePath.endsWith(ext))) {
					continue
				}
			}

			if (options.pathFilter && !filePath.includes(options.pathFilter)) {
				continue
			}

			if (options.excludePaths && options.excludePaths.length > 0) {
				if (options.excludePaths.some((exclude) => filePath.includes(exclude))) {
					continue
				}
			}

			const file = await this.storage.getFile(filePath)
			if (!file) continue

			const searchResult: SearchResult = {
				path: file.path,
				score: result.score,
				matchedTerms: result.matchedTerms,
				language: file.language,
				size: file.size,
			}

			if (includeContent) {
				searchResult.snippet = this.extractSnippet(file.content, result.matchedTerms)
			}

			searchResults.push(searchResult)
		}

		const finalResults = searchResults.slice(0, limit)

		// Store in cache
		this.searchCache.set(cacheKey, finalResults)

		return finalResults
	}

	/**
	 * Extract a snippet from content around matched terms
	 */
	private extractSnippet(content: string, matchedTerms: string[]): string {
		const lines = content.split('\n')
		const matchedLines: Array<{ lineNum: number; line: string }> = []

		// Find lines containing matched terms
		for (let i = 0; i < lines.length; i++) {
			const lineLower = lines[i].toLowerCase()
			if (matchedTerms.some((term) => lineLower.includes(term))) {
				matchedLines.push({ lineNum: i + 1, line: lines[i].trim() })
				if (matchedLines.length >= 3) break // Max 3 lines
			}
		}

		if (matchedLines.length === 0) {
			// Return first few lines if no matches found
			return lines
				.slice(0, 3)
				.map((line) => line.trim())
				.join('\n')
		}

		return matchedLines.map((m) => `${m.lineNum}: ${m.line}`).join('\n')
	}

	/**
	 * Get file content
	 */
	async getFileContent(filePath: string): Promise<string | null> {
		const file = await this.storage.getFile(filePath)
		return file?.content || null
	}

	/**
	 * Get total indexed files count
	 */
	async getIndexedCount(): Promise<number> {
		return this.storage.count()
	}

	/**
	 * Get vector storage (for hybrid search)
	 */
	getVectorStorage(): VectorStorage | undefined {
		return this.vectorStorage
	}

	/**
	 * Get embedding provider (for hybrid search)
	 */
	getEmbeddingProvider(): EmbeddingProvider | undefined {
		return this.embeddingProvider
	}

	/**
	 * Build vector index from file metadata (Memory optimization)
	 * Reads file content on-demand instead of holding all in memory
	 */
	private async buildVectorIndexFromMetadata(files: FileMetadata[]): Promise<void> {
		if (!this.embeddingProvider || !this.vectorStorage) {
			return
		}

		console.error('[INFO] Generating embeddings for vector search...')
		const startTime = Date.now()

		const batchSize = this.vectorBatchSize
		let processed = 0

		for (let i = 0; i < files.length; i += batchSize) {
			const batchMetadata = files.slice(i, i + batchSize)

			// Read content for this batch only (Memory optimization)
			const batchContents: Array<{ metadata: FileMetadata; content: string }> = []
			for (const metadata of batchMetadata) {
				const content = readFileContent(metadata.absolutePath)
				if (content !== null) {
					batchContents.push({ metadata, content })
				}
			}

			if (batchContents.length === 0) continue

			try {
				// Generate embeddings for batch
				const embeddings = await this.embeddingProvider.generateEmbeddings(
					batchContents.map((b) => b.content)
				)

				// Add to vector storage
				for (let j = 0; j < batchContents.length; j++) {
					const { metadata, content } = batchContents[j]
					const embedding = embeddings[j]

					const doc: VectorDocument = {
						id: `file://${metadata.path}`,
						embedding,
						metadata: {
							type: 'code',
							language: metadata.language,
							content: content.substring(0, 500), // Preview
							path: metadata.path,
						},
					}

					await this.vectorStorage.addDocument(doc)
				}

				processed += batchContents.length
				console.error(`[INFO] Generated embeddings: ${processed}/${files.length} files`)
			} catch (error) {
				console.error(`[ERROR] Failed to generate embeddings for batch ${i}:`, error)
				// Continue with next batch
			}
		}

		// LanceDB auto-persists, no need to save
		const elapsedTime = Date.now() - startTime
		console.error(`[SUCCESS] Vector index built (${processed} files, ${elapsedTime}ms)`)
	}

	/**
	 * Update vector for a single file
	 */
	private async updateFileVector(filePath: string, content: string): Promise<void> {
		if (!this.embeddingProvider || !this.vectorStorage) {
			return
		}

		try {
			const embedding = await this.embeddingProvider.generateEmbedding(content)
			const language = detectLanguage(filePath)

			const doc: VectorDocument = {
				id: `file://${filePath}`,
				embedding,
				metadata: {
					type: 'code',
					language,
					content: content.substring(0, 500),
					path: filePath,
				},
			}

			await this.vectorStorage.updateDocument(doc)
			console.error(`[VECTOR] Updated: ${filePath}`)
		} catch (error) {
			console.error(`[ERROR] Failed to update vector for ${filePath}:`, error)
		}
	}

	/**
	 * Delete vector for a file
	 */
	private async deleteFileVector(filePath: string): Promise<void> {
		if (!this.vectorStorage) {
			return
		}

		const deleted = await this.vectorStorage.deleteDocument(`file://${filePath}`)
		if (deleted) {
			console.error(`[VECTOR] Deleted: ${filePath}`)
		}
	}
}

export interface SearchResult {
	path: string
	score: number
	matchedTerms: string[]
	language?: string
	size: number
	snippet?: string
}
