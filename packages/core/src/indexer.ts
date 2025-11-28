/**
 * Codebase indexer service
 * Uses chunk-level indexing for better search granularity
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { chunkCodeByAST } from './ast-chunking.js'
import { getCoderagDataDir } from './db/client.js'
import type { EmbeddingProvider } from './embeddings.js'
import { IncrementalTFIDF, type IncrementalUpdate } from './incremental-tfidf.js'
import { createCacheKey, LRUCache } from './search-cache.js'
import { type CodebaseFile, MemoryStorage, type Storage } from './storage.js'
import { type ChunkData, PersistentStorage } from './storage-persistent.js'
import { buildSearchIndex, getQueryTokens, type SearchIndex, tokenize } from './tfidf.js'
import {
	detectLanguage,
	type FileMetadata,
	type Ignore,
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

/**
 * Result of comparing filesystem with database
 */
export interface FileDiff {
	added: FileMetadata[]
	changed: FileMetadata[]
	deleted: string[] // paths only
	unchanged: number
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
	private ignoreFilter: Ignore | null = null
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
			// Use global ~/.coderag/projects/<hash>/ directory for vector storage
			const dataDir = getCoderagDataDir(this.codebaseRoot)
			const vectorDbPath = path.join(dataDir, 'vectors.lance')

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
	 * Compare filesystem with database to find changes
	 * Used for incremental updates after long periods of inactivity
	 */
	private async diffFilesystem(
		dbMetadata: Map<string, { mtime: number; hash: string }>
	): Promise<FileDiff> {
		if (!this.ignoreFilter) {
			this.ignoreFilter = loadGitignore(this.codebaseRoot)
		}

		const added: FileMetadata[] = []
		const changed: FileMetadata[] = []
		const deleted: string[] = []
		let unchanged = 0

		// Track which db files we've seen in filesystem
		const seenPaths = new Set<string>()

		// Scan filesystem
		for (const metadata of scanFileMetadata(this.codebaseRoot, {
			ignoreFilter: this.ignoreFilter,
			codebaseRoot: this.codebaseRoot,
			maxFileSize: this.maxFileSize,
		})) {
			seenPaths.add(metadata.path)
			const dbEntry = dbMetadata.get(metadata.path)

			if (!dbEntry) {
				// New file
				added.push(metadata)
			} else if (Math.abs(metadata.mtime - dbEntry.mtime) > 1000) {
				// mtime changed (1 second tolerance for filesystem precision)
				// File might have changed, need to verify with hash
				changed.push(metadata)
			} else {
				unchanged++
			}
		}

		// Find deleted files (in db but not in filesystem)
		for (const dbPath of dbMetadata.keys()) {
			if (!seenPaths.has(dbPath)) {
				deleted.push(dbPath)
			}
		}

		return { added, changed, deleted, unchanged }
	}

	/**
	 * Process incremental changes (add, update, delete files)
	 * Uses chunk-level indexing with SQL-based updates
	 */
	private async processIncrementalChanges(
		diff: FileDiff,
		dbMetadata: Map<string, { mtime: number; hash: string }>,
		options: IndexerOptions
	): Promise<void> {
		const persistentStorage = this.storage as PersistentStorage

		// Step 1: Get terms for deleted files (before deleting, for IDF recalculation)
		let _deletedTerms = new Set<string>()
		if (diff.deleted.length > 0) {
			console.error(`[INFO] Getting terms for ${diff.deleted.length} deleted files...`)
			_deletedTerms = await persistentStorage.getTermsForFiles(diff.deleted)

			console.error(`[INFO] Deleting ${diff.deleted.length} removed files...`)
			await persistentStorage.deleteFiles(diff.deleted)
		}

		// Step 2: Process added and changed files - chunk and index
		const filesToProcess = [...diff.added, ...diff.changed]
		let totalChunks = 0

		if (filesToProcess.length > 0) {
			console.error(`[INFO] Processing ${filesToProcess.length} files...`)

			const batchSize = this.indexingBatchSize
			let processedCount = 0

			for (let i = 0; i < filesToProcess.length; i += batchSize) {
				const batchMetadata = filesToProcess.slice(i, i + batchSize)
				const batchFiles: CodebaseFile[] = []
				const fileChunks: Array<{ filePath: string; chunks: ChunkData[] }> = []

				for (const metadata of batchMetadata) {
					const content = readFileContent(metadata.absolutePath)
					if (content === null) continue

					const newHash = simpleHash(content)

					// For changed files, verify content actually changed using hash
					const dbEntry = dbMetadata.get(metadata.path)
					if (dbEntry && dbEntry.hash === newHash) {
						// File content unchanged, just mtime difference - skip
						processedCount++
						continue
					}

					const codebaseFile: CodebaseFile = {
						path: metadata.path,
						content,
						size: metadata.size,
						mtime: new Date(metadata.mtime),
						language: metadata.language,
						hash: newHash,
					}
					batchFiles.push(codebaseFile)

					// Chunk the file using AST
					const chunks = await chunkCodeByAST(content, metadata.path)
					const chunkData: ChunkData[] = chunks.map((chunk) => ({
						content: chunk.content,
						type: chunk.type,
						startLine: chunk.startLine,
						endLine: chunk.endLine,
						metadata: chunk.metadata,
					}))
					fileChunks.push({ filePath: metadata.path, chunks: chunkData })
					totalChunks += chunkData.length

					processedCount++
					this.status.currentFile = metadata.path
					this.status.progress = Math.round((processedCount / filesToProcess.length) * 30)
					options.onProgress?.(processedCount, filesToProcess.length, metadata.path)
				}

				// Store batch to database (file content)
				if (batchFiles.length > 0) {
					await persistentStorage.storeFiles(batchFiles)
				}

				// Store chunks for this batch
				if (fileChunks.length > 0) {
					const chunkIdMap = await persistentStorage.storeManyChunks(fileChunks)

					// Build TF-IDF vectors for chunks
					const chunkVectors: Array<{
						chunkId: number
						terms: Map<string, { tf: number; tfidf: number; rawFreq: number }>
						tokenCount: number
					}> = []

					for (const fc of fileChunks) {
						const chunkIds = chunkIdMap.get(fc.filePath)
						if (!chunkIds) continue

						for (let j = 0; j < fc.chunks.length; j++) {
							const chunk = fc.chunks[j]
							const chunkId = chunkIds[j]
							if (!chunkId) continue

							// Tokenize chunk content
							const tokens = await tokenize(chunk.content)
							const termFreq = new Map<string, number>()
							for (const token of tokens) {
								termFreq.set(token, (termFreq.get(token) || 0) + 1)
							}

							// Calculate TF
							const totalTerms = tokens.length
							if (totalTerms === 0) continue

							const terms = new Map<string, { tf: number; tfidf: number; rawFreq: number }>()
							for (const [term, freq] of termFreq) {
								terms.set(term, {
									tf: freq / totalTerms,
									tfidf: 0, // Will be calculated after IDF rebuild
									rawFreq: freq,
								})
							}

							chunkVectors.push({ chunkId, terms, tokenCount: totalTerms })
						}
					}

					// Store chunk vectors
					if (chunkVectors.length > 0) {
						await persistentStorage.storeManyChunkVectors(chunkVectors)
					}
				}
			}
		}

		this.status.progress = 50

		// Step 3: Rebuild IDF scores from vectors (SQL-based)
		console.error('[INFO] Recalculating IDF scores...')
		await persistentStorage.rebuildIdfScoresFromVectors()
		this.status.progress = 70

		// Step 4: Recalculate TF-IDF scores (SQL-based batch update)
		console.error('[INFO] Updating TF-IDF scores...')
		await persistentStorage.recalculateTfidfScores()
		this.status.progress = 80

		// Step 5: Update pre-computed magnitudes (for cosine similarity search)
		console.error('[INFO] Updating chunk magnitudes...')
		await persistentStorage.updateChunkMagnitudes()
		this.status.progress = 90

		// Step 6: Update average document length (for BM25)
		console.error('[INFO] Updating average document length...')
		await persistentStorage.updateAverageDocLength()
		this.status.progress = 95

		// Step 7: Invalidate search cache
		this.searchCache.invalidate()
		console.error('[INFO] Search cache invalidated')

		// Log summary
		console.error(
			`[SUCCESS] Incremental update complete: ${filesToProcess.length - diff.changed.length} files added, ${diff.changed.length} changed, ${diff.deleted.length} deleted, ${totalChunks} chunks indexed`
		)
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

					// Verify IDF scores exist (index is valid)
					const idf = await this.storage.getIdfScores()
					if (idf.size > 0) {
						// Incremental diff: compare filesystem vs database
						console.error('[INFO] Checking for file changes since last index...')
						const dbMetadata = await this.storage.getAllFileMetadata()
						const diff = await this.diffFilesystem(dbMetadata)

						const totalChanges = diff.added.length + diff.changed.length + diff.deleted.length

						if (totalChanges === 0) {
							// No changes - use existing index
							console.error(`[SUCCESS] No changes detected (${diff.unchanged} files unchanged)`)
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

						// Process incremental changes
						console.error(
							`[INFO] Incremental update: ${diff.added.length} added, ${diff.changed.length} changed, ${diff.deleted.length} deleted`
						)

						await this.processIncrementalChanges(diff, dbMetadata, options)

						this.status.progress = 100
						this.status.indexedFiles = existingCount + diff.added.length - diff.deleted.length
						this.status.totalFiles = this.status.indexedFiles

						// Start watching if requested
						if (options.watch) {
							await this.startWatch()
						}

						this.status.isIndexing = false
						return
					}
					console.error('[WARN] Index verification failed, rebuilding...')
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

			// Phase 2: Process files in batches with chunk-level indexing
			// Only batch content is in memory at any time
			console.error(`[INFO] Processing files in batches of ${this.indexingBatchSize}...`)

			const batchSize = this.indexingBatchSize
			let processedCount = 0
			let totalChunks = 0

			// Check if we're using persistent storage for chunk-based indexing
			const isPersistent = this.storage instanceof PersistentStorage
			const persistentStorage = isPersistent ? (this.storage as PersistentStorage) : null

			// For non-persistent storage, still use incremental engine
			if (!isPersistent) {
				this.incrementalEngine = new IncrementalTFIDF()
			}

			for (let i = 0; i < fileMetadataList.length; i += batchSize) {
				const batchMetadata = fileMetadataList.slice(i, i + batchSize)
				const batchFiles: CodebaseFile[] = []
				const fileChunks: Array<{ filePath: string; chunks: ChunkData[]; content: string }> = []
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

					// Chunk the file using AST
					const chunks = await chunkCodeByAST(content, metadata.path)
					const chunkData: ChunkData[] = chunks.map((chunk) => ({
						content: chunk.content,
						type: chunk.type,
						startLine: chunk.startLine,
						endLine: chunk.endLine,
						metadata: chunk.metadata,
					}))
					fileChunks.push({ filePath: metadata.path, chunks: chunkData, content })
					totalChunks += chunkData.length

					// For non-persistent storage, use incremental engine
					if (!isPersistent) {
						batchUpdates.push({
							type: 'add',
							uri: `file://${metadata.path}`,
							newContent: content,
						})
					}

					processedCount++
					this.status.currentFile = metadata.path
					this.status.indexedFiles = processedCount
					this.status.progress = Math.round((processedCount / fileMetadataList.length) * 40)
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

					// For persistent storage: store chunks and build TF-IDF vectors per chunk
					if (persistentStorage && fileChunks.length > 0) {
						const chunkIdMap = await persistentStorage.storeManyChunks(
							fileChunks.map((fc) => ({ filePath: fc.filePath, chunks: fc.chunks }))
						)

						// Build TF-IDF vectors for chunks
						const chunkVectors: Array<{
							chunkId: number
							terms: Map<string, { tf: number; tfidf: number; rawFreq: number }>
							tokenCount: number
						}> = []

						for (const fc of fileChunks) {
							const chunkIds = chunkIdMap.get(fc.filePath)
							if (!chunkIds) continue

							for (let j = 0; j < fc.chunks.length; j++) {
								const chunk = fc.chunks[j]
								const chunkId = chunkIds[j]
								if (!chunkId) continue

								// Tokenize chunk content
								const tokens = await tokenize(chunk.content)
								const termFreq = new Map<string, number>()
								for (const token of tokens) {
									termFreq.set(token, (termFreq.get(token) || 0) + 1)
								}

								// Calculate TF
								const totalTerms = tokens.length
								if (totalTerms === 0) continue

								const terms = new Map<string, { tf: number; tfidf: number; rawFreq: number }>()
								for (const [term, freq] of termFreq) {
									terms.set(term, {
										tf: freq / totalTerms,
										tfidf: 0, // Will be calculated after IDF rebuild
										rawFreq: freq,
									})
								}

								chunkVectors.push({ chunkId, terms, tokenCount: totalTerms })
							}
						}

						// Store chunk vectors
						if (chunkVectors.length > 0) {
							await persistentStorage.storeManyChunkVectors(chunkVectors)
						}
					}

					// For non-persistent storage: use incremental engine
					if (this.incrementalEngine && batchUpdates.length > 0) {
						await this.incrementalEngine.applyUpdates(batchUpdates)
					}
				}

				// Clear batch references for GC
				batchFiles.length = 0
				fileChunks.length = 0
				batchUpdates.length = 0
			}

			console.error(`[INFO] Total chunks created: ${totalChunks}`)
			this.status.progress = 50

			// Finalize index based on storage type
			if (persistentStorage) {
				// Persistent storage: rebuild IDF and TF-IDF scores
				console.error('[INFO] Rebuilding IDF scores...')
				await persistentStorage.rebuildIdfScoresFromVectors()
				this.status.progress = 60

				console.error('[INFO] Recalculating TF-IDF scores...')
				await persistentStorage.recalculateTfidfScores()
				this.status.progress = 70

				console.error('[INFO] Computing chunk magnitudes...')
				await persistentStorage.updateChunkMagnitudes()
				this.status.progress = 80

				console.error('[INFO] Computing average document length...')
				await persistentStorage.updateAverageDocLength()
				this.status.progress = 85

				// Release in-memory structures in low memory mode
				if (this.lowMemoryMode) {
					this.searchIndex = null
					this.incrementalEngine = null
					console.error('[INFO] Low memory mode: released in-memory index')
				}

				console.error('[SUCCESS] Chunk-level TF-IDF index persisted')
			} else if (this.incrementalEngine) {
				// Non-persistent storage: build in-memory index
				console.error('[INFO] Finalizing in-memory search index...')
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
		if (await this.incrementalEngine.shouldFullRebuild(this.pendingFileChanges)) {
			console.error('[INFO] Changes too extensive, performing full rebuild instead of incremental')
			this.pendingFileChanges = []
			return this.fullRebuildSearchIndex()
		}

		// Perform incremental update
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
	 * For persistent storage, this rebuilds the chunk-level index
	 */
	private async fullRebuildSearchIndex(): Promise<void> {
		// For persistent storage, rebuild chunk index
		if (this.storage instanceof PersistentStorage) {
			const persistentStorage = this.storage
			const allFiles = await this.storage.getAllFiles()

			console.error(`[INFO] Full rebuild: re-chunking ${allFiles.length} files...`)

			// Re-chunk all files
			const fileChunks: Array<{ filePath: string; chunks: ChunkData[] }> = []
			for (const file of allFiles) {
				const chunks = await chunkCodeByAST(file.content, file.path)
				const chunkData: ChunkData[] = chunks.map((chunk) => ({
					content: chunk.content,
					type: chunk.type,
					startLine: chunk.startLine,
					endLine: chunk.endLine,
					metadata: chunk.metadata,
				}))
				fileChunks.push({ filePath: file.path, chunks: chunkData })
			}

			// Store all chunks (this also deletes old chunks)
			const chunkIdMap = await persistentStorage.storeManyChunks(fileChunks)

			// Build TF-IDF vectors for all chunks
			const chunkVectors: Array<{
				chunkId: number
				terms: Map<string, { tf: number; tfidf: number; rawFreq: number }>
				tokenCount: number
			}> = []

			for (const fc of fileChunks) {
				const chunkIds = chunkIdMap.get(fc.filePath)
				if (!chunkIds) continue

				for (let j = 0; j < fc.chunks.length; j++) {
					const chunk = fc.chunks[j]
					const chunkId = chunkIds[j]
					if (!chunkId) continue

					const tokens = await tokenize(chunk.content)
					const termFreq = new Map<string, number>()
					for (const token of tokens) {
						termFreq.set(token, (termFreq.get(token) || 0) + 1)
					}

					const totalTerms = tokens.length
					if (totalTerms === 0) continue

					const terms = new Map<string, { tf: number; tfidf: number; rawFreq: number }>()
					for (const [term, freq] of termFreq) {
						terms.set(term, {
							tf: freq / totalTerms,
							tfidf: 0,
							rawFreq: freq,
						})
					}

					chunkVectors.push({ chunkId, terms, tokenCount: totalTerms })
				}
			}

			if (chunkVectors.length > 0) {
				await persistentStorage.storeManyChunkVectors(chunkVectors)
			}

			// Rebuild IDF and TF-IDF scores
			await persistentStorage.rebuildIdfScoresFromVectors()
			await persistentStorage.recalculateTfidfScores()
			await persistentStorage.updateChunkMagnitudes()
			await persistentStorage.updateAverageDocLength()

			console.error('[SUCCESS] Full chunk index rebuild complete')
		} else {
			// For non-persistent storage, use in-memory index
			const allFiles = await this.storage.getAllFiles()
			const documents = allFiles.map((file) => ({
				uri: `file://${file.path}`,
				content: file.content,
			}))

			this.searchIndex = await buildSearchIndex(documents)
			this.incrementalEngine = new IncrementalTFIDF(
				this.searchIndex.documents,
				this.searchIndex.idf
			)
		}

		// Invalidate search cache (index changed)
		this.searchCache.invalidate()
		console.error('[INFO] Search cache invalidated')
	}

	/**
	 * Persist search index to storage
	 * NOTE: For PersistentStorage, chunk-based indexing happens inline during index()
	 * This method is only used for in-memory storage fallback
	 */
	private async persistSearchIndex(): Promise<void> {
		// For persistent storage, indexing is done inline with chunks
		// This method is kept for compatibility with in-memory storage mode
		if (this.storage instanceof PersistentStorage) {
			// Chunk-based indexing already persisted during index()
			console.error('[INFO] Chunk-based index already persisted')
			return
		}

		// For non-persistent storage, just store IDF scores if available
		if (this.searchIndex) {
			const docFreq = new Map<string, number>()
			for (const doc of this.searchIndex.documents) {
				const uniqueTerms = new Set(doc.rawTerms.keys())
				for (const term of uniqueTerms) {
					docFreq.set(term, (docFreq.get(term) || 0) + 1)
				}
			}
			console.error('[INFO] In-memory index built (non-persistent storage)')
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
	 * Returns chunk-level results when using persistent storage (SQL-based search)
	 */
	async search(
		query: string,
		options: {
			limit?: number
			includeContent?: boolean
			fileExtensions?: string[]
			pathFilter?: string
			excludePaths?: string[]
			// Snippet options (only used for in-memory search)
			contextLines?: number // Lines of context around each match (default: 3)
			maxSnippetChars?: number // Max chars per file snippet (default: 2000)
			maxSnippetBlocks?: number // Max code blocks per file (default: 4)
		} = {}
	): Promise<SearchResult[]> {
		const { limit = 10, includeContent = true } = options
		const snippetOptions = {
			contextLines: options.contextLines,
			maxChars: options.maxSnippetChars,
			maxBlocks: options.maxSnippetBlocks,
		}

		// Create cache key from query and options
		const cacheKey = createCacheKey(query, {
			limit,
			fileExtensions: options.fileExtensions,
			pathFilter: options.pathFilter,
			excludePaths: options.excludePaths,
			...snippetOptions,
		})

		// Check cache first
		const cachedResults = this.searchCache.get(cacheKey)
		if (cachedResults) {
			console.error(`[CACHE HIT] Query: "${query}"`)
			return cachedResults
		}

		console.error(`[CACHE MISS] Query: "${query}"`)

		// Use chunk-based SQL search in low memory mode (Memory optimization)
		if (this.lowMemoryMode && this.storage instanceof PersistentStorage) {
			const searchResults = await this.searchChunks(query, options)
			this.searchCache.set(cacheKey, searchResults)
			return searchResults
		}

		// In-memory search (faster but uses more memory) - file-level
		let results: Array<{ uri: string; score: number; matchedTerms: string[] }>
		if (!this.searchIndex) {
			throw new Error('Codebase not indexed. Please run index() first.')
		}
		const searchIndex = this.searchIndex
		results = await import('./tfidf.js').then((m) =>
			m.searchDocuments(query, searchIndex, { limit })
		)

		// Get file content and apply filters (in-memory mode)
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
				searchResult.snippet = this.extractSnippet(
					file.content,
					result.matchedTerms,
					snippetOptions
				)
			}

			searchResults.push(searchResult)
		}

		const finalResults = searchResults.slice(0, limit)

		// Store in cache
		this.searchCache.set(cacheKey, finalResults)

		return finalResults
	}

	/**
	 * Chunk-based search with BM25 scoring
	 * Returns chunk content directly (no separate snippet extraction needed)
	 */
	private async searchChunks(
		query: string,
		options: {
			limit?: number
			includeContent?: boolean
			fileExtensions?: string[]
			pathFilter?: string
			excludePaths?: string[]
		}
	): Promise<SearchResult[]> {
		const { limit = 10, includeContent = true } = options
		const persistentStorage = this.storage as PersistentStorage

		// Tokenize query
		const queryTokens = await getQueryTokens(query)
		if (queryTokens.length === 0) {
			return []
		}

		// Get matching chunks from storage (already includes content)
		const candidates = await persistentStorage.searchByTerms(queryTokens, { limit: limit * 3 })

		// Get IDF scores for query terms
		const idf = await persistentStorage.getIdfScoresForTerms(queryTokens)

		// Get average document length for BM25
		const avgDocLength = await persistentStorage.getAverageDocLength()

		// BM25 parameters
		const k1 = 1.2
		const b = 0.75

		// Calculate BM25 scores for each chunk
		const scoredResults: Array<{
			chunk: (typeof candidates)[0]
			score: number
			matchedTerms: string[]
		}> = []

		for (const chunk of candidates) {
			// Apply filters
			if (options.fileExtensions && options.fileExtensions.length > 0) {
				if (!options.fileExtensions.some((ext) => chunk.filePath.endsWith(ext))) {
					continue
				}
			}

			if (options.pathFilter && !chunk.filePath.includes(options.pathFilter)) {
				continue
			}

			if (options.excludePaths && options.excludePaths.length > 0) {
				if (options.excludePaths.some((exclude) => chunk.filePath.includes(exclude))) {
					continue
				}
			}

			// Calculate BM25 score
			let score = 0
			const matchedTerms: string[] = []

			for (const term of queryTokens) {
				const termData = chunk.matchedTerms.get(term)
				if (!termData) continue

				matchedTerms.push(term)
				const termIdf = idf.get(term) || 1

				// BM25 formula
				const tf = termData.rawFreq
				const docLen = chunk.tokenCount || 1
				const numerator = tf * (k1 + 1)
				const denominator = tf + k1 * (1 - b + b * (docLen / (avgDocLength || 1)))
				score += termIdf * (numerator / denominator)
			}

			if (matchedTerms.length > 0) {
				scoredResults.push({ chunk, score, matchedTerms })
			}
		}

		// Sort by score descending
		scoredResults.sort((a, b) => b.score - a.score)

		// Convert to SearchResult format
		const results: SearchResult[] = []

		for (const { chunk, score, matchedTerms } of scoredResults.slice(0, limit)) {
			const result: SearchResult = {
				path: chunk.filePath,
				score,
				matchedTerms,
				language: detectLanguage(chunk.filePath),
				size: chunk.content.length,
				// Include chunk metadata
				chunkType: chunk.type,
				startLine: chunk.startLine,
				endLine: chunk.endLine,
			}

			if (includeContent) {
				// Chunk content is the snippet - add line numbers
				const lines = chunk.content.split('\n')
				result.snippet = lines.map((line, i) => `${chunk.startLine + i}: ${line}`).join('\n')
			}

			results.push(result)
		}

		console.error(`[BM25 CHUNK SEARCH] Found ${results.length} chunks`)
		return results
	}

	/**
	 * Extract code block snippets from content around matched terms
	 *
	 * Returns the most relevant code blocks (not just lines) with context.
	 * Blocks are ranked by term density (more matched terms = higher score).
	 */
	private extractSnippet(
		content: string,
		matchedTerms: string[],
		options: { contextLines?: number; maxChars?: number; maxBlocks?: number } = {}
	): string {
		const { contextLines = 3, maxChars = 2000, maxBlocks = 4 } = options
		const lines = content.split('\n')

		// Step 1: Find all lines with matches and score them
		const matchedLineInfos: Array<{
			lineNum: number
			score: number
			matchedTerms: string[]
		}> = []

		for (let i = 0; i < lines.length; i++) {
			const lineLower = lines[i].toLowerCase()
			const termsInLine = matchedTerms.filter((term) => lineLower.includes(term.toLowerCase()))

			if (termsInLine.length > 0) {
				matchedLineInfos.push({
					lineNum: i,
					score: termsInLine.length,
					matchedTerms: termsInLine,
				})
			}
		}

		if (matchedLineInfos.length === 0) {
			// Return first few lines if no matches found
			return lines.slice(0, 5).join('\n')
		}

		// Step 2: Expand each matched line to a block with context, then merge overlapping blocks
		interface Block {
			start: number
			end: number
			score: number
			matchedTerms: Set<string>
		}

		const blocks: Block[] = []

		for (const info of matchedLineInfos) {
			const start = Math.max(0, info.lineNum - contextLines)
			const end = Math.min(lines.length - 1, info.lineNum + contextLines)

			// Try to merge with existing block if overlapping
			let merged = false
			for (const block of blocks) {
				if (start <= block.end + 1 && end >= block.start - 1) {
					// Overlapping or adjacent - merge
					block.start = Math.min(block.start, start)
					block.end = Math.max(block.end, end)
					block.score += info.score
					for (const term of info.matchedTerms) {
						block.matchedTerms.add(term)
					}
					merged = true
					break
				}
			}

			if (!merged) {
				blocks.push({
					start,
					end,
					score: info.score,
					matchedTerms: new Set(info.matchedTerms),
				})
			}
		}

		// Step 3: Sort blocks by unique terms (primary) and density (secondary)
		// Unique terms = how many different query terms appear in block
		// Density = unique terms / block size (prefer compact blocks)
		blocks.sort((a, b) => {
			const uniqueA = a.matchedTerms.size
			const uniqueB = b.matchedTerms.size
			if (uniqueA !== uniqueB) {
				return uniqueB - uniqueA // More unique terms = better
			}
			// Tie-break: prefer denser blocks (more terms per line)
			const densityA = uniqueA / (a.end - a.start + 1)
			const densityB = uniqueB / (b.end - b.start + 1)
			return densityB - densityA
		})
		const topBlocks = blocks.slice(0, maxBlocks)

		// Sort by position for output (top to bottom in file)
		topBlocks.sort((a, b) => a.start - b.start)

		// Step 4: Build output with character limit
		const snippetParts: string[] = []
		let totalChars = 0

		for (const block of topBlocks) {
			const blockLines = lines.slice(block.start, block.end + 1)
			const blockContent = blockLines.map((line, i) => `${block.start + i + 1}: ${line}`).join('\n')

			// Check if adding this block would exceed limit
			if (totalChars + blockContent.length > maxChars && snippetParts.length > 0) {
				break
			}

			snippetParts.push(blockContent)
			totalChars += blockContent.length
		}

		return snippetParts.join('\n...\n')
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
	// Chunk metadata (when using chunk-level search)
	chunkType?: string
	startLine?: number
	endLine?: number
}
