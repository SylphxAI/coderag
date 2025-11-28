/**
 * Persistent storage implementation using SQLite + Drizzle ORM
 * Now supports chunk-level indexing for better search granularity
 */

import { eq, sql } from 'drizzle-orm'
import { createDb, type DbConfig, type DbInstance } from './db/client.js'
import { runMigrations } from './db/migrations.js'
import * as schema from './db/schema.js'
import type { CodebaseFile, Storage } from './storage.js'

/**
 * Chunk data for storage
 */
export interface ChunkData {
	content: string
	type: string
	startLine: number
	endLine: number
	metadata?: Record<string, unknown>
}

/**
 * Stored chunk with ID
 */
export interface StoredChunk extends ChunkData {
	id: number
	fileId: number
	filePath: string
}

export class PersistentStorage implements Storage {
	private dbInstance: DbInstance

	constructor(config: DbConfig = {}) {
		this.dbInstance = createDb(config)
		runMigrations(this.dbInstance.sqlite)
	}

	/**
	 * Store a file
	 */
	async storeFile(file: CodebaseFile): Promise<void> {
		const { db } = this.dbInstance
		const mtime = typeof file.mtime === 'number' ? file.mtime : file.mtime.getTime()

		const values = {
			path: file.path,
			content: file.content,
			hash: file.hash,
			size: file.size,
			mtime,
			...(file.language ? { language: file.language } : {}),
			indexedAt: Date.now(),
		}

		await db
			.insert(schema.files)
			.values(values)
			.onConflictDoUpdate({
				target: schema.files.path,
				set: {
					content: values.content,
					hash: values.hash,
					size: values.size,
					mtime: values.mtime,
					...(values.language ? { language: values.language } : {}),
					indexedAt: values.indexedAt,
				},
			})
	}

	/**
	 * Store multiple files in a single transaction (batch operation)
	 * Much faster than storing one by one for large datasets
	 */
	async storeFiles(files: CodebaseFile[]): Promise<void> {
		if (files.length === 0) {
			return
		}

		const { db, sqlite } = this.dbInstance

		// Use SQLite transaction for atomic batch insert
		sqlite.exec('BEGIN TRANSACTION')

		try {
			// Process files one by one within transaction (still much faster than separate transactions)
			for (const file of files) {
				const mtime = typeof file.mtime === 'number' ? file.mtime : file.mtime.getTime()
				const values = {
					path: file.path,
					content: file.content,
					hash: file.hash,
					size: file.size,
					mtime,
					...(file.language ? { language: file.language } : {}),
					indexedAt: Date.now(),
				}

				await db
					.insert(schema.files)
					.values(values)
					.onConflictDoUpdate({
						target: schema.files.path,
						set: {
							content: values.content,
							hash: values.hash,
							size: values.size,
							mtime: values.mtime,
							...(values.language ? { language: values.language } : {}),
							indexedAt: values.indexedAt,
						},
					})
			}

			sqlite.exec('COMMIT')
		} catch (error) {
			sqlite.exec('ROLLBACK')
			throw error
		}
	}

	/**
	 * Get a file by path
	 */
	async getFile(path: string): Promise<CodebaseFile | null> {
		const { db } = this.dbInstance

		const result = await db.select().from(schema.files).where(eq(schema.files.path, path)).get()

		if (!result) {
			return null
		}

		return {
			path: result.path,
			content: result.content,
			hash: result.hash,
			size: result.size,
			mtime: result.mtime,
			language: result.language || undefined,
		}
	}

	/**
	 * Get all files
	 */
	async getAllFiles(): Promise<CodebaseFile[]> {
		const { db } = this.dbInstance

		const results = await db.select().from(schema.files).all()

		return results.map((file) => ({
			path: file.path,
			content: file.content,
			hash: file.hash,
			size: file.size,
			mtime: file.mtime,
			language: file.language || undefined,
		}))
	}

	/**
	 * Delete a file
	 */
	async deleteFile(path: string): Promise<void> {
		const { db } = this.dbInstance

		await db.delete(schema.files).where(eq(schema.files.path, path))
	}

	/**
	 * Clear all files
	 */
	async clear(): Promise<void> {
		const { db } = this.dbInstance

		await db.delete(schema.chunks)
		await db.delete(schema.files)
		await db.delete(schema.documentVectors)
		await db.delete(schema.idfScores)
		await db.delete(schema.indexMetadata)
	}

	// ============ CHUNK METHODS ============

	/**
	 * Store chunks for a file (replaces existing chunks)
	 */
	async storeChunks(filePath: string, chunks: ChunkData[]): Promise<number[]> {
		const { db, sqlite } = this.dbInstance

		// Get file ID
		const file = await db.select().from(schema.files).where(eq(schema.files.path, filePath)).get()
		if (!file) {
			throw new Error(`File not found: ${filePath}`)
		}

		sqlite.exec('BEGIN TRANSACTION')

		try {
			// Delete existing chunks for this file
			await db.delete(schema.chunks).where(eq(schema.chunks.fileId, file.id))

			// Insert new chunks
			const chunkIds: number[] = []
			for (const chunk of chunks) {
				const insertValues: Record<string, unknown> = {
					fileId: file.id,
					content: chunk.content,
					type: chunk.type,
					startLine: chunk.startLine,
					endLine: chunk.endLine,
				}
				if (chunk.metadata) {
					insertValues.metadata = JSON.stringify(chunk.metadata)
				}
				const result = await db
					.insert(schema.chunks)
					.values(insertValues as typeof schema.chunks.$inferInsert)
					.returning({ id: schema.chunks.id })

				if (result[0]) {
					chunkIds.push(result[0].id)
				}
			}

			sqlite.exec('COMMIT')
			return chunkIds
		} catch (error) {
			sqlite.exec('ROLLBACK')
			throw error
		}
	}

	/**
	 * Store chunks for multiple files in batch
	 */
	async storeManyChunks(
		fileChunks: Array<{ filePath: string; chunks: ChunkData[] }>
	): Promise<Map<string, number[]>> {
		const { db, sqlite } = this.dbInstance
		const result = new Map<string, number[]>()

		if (fileChunks.length === 0) {
			return result
		}

		// Get file IDs
		const filePaths = fileChunks.map((fc) => fc.filePath)
		const files = await db
			.select({ id: schema.files.id, path: schema.files.path })
			.from(schema.files)
			.where(
				sql`${schema.files.path} IN (${sql.join(
					filePaths.map((p) => sql`${p}`),
					sql`, `
				)})`
			)
			.all()

		const fileIdMap = new Map<string, number>()
		for (const file of files) {
			fileIdMap.set(file.path, file.id)
		}

		sqlite.exec('BEGIN TRANSACTION')

		try {
			// Delete existing chunks for these files
			const fileIds = Array.from(fileIdMap.values())
			if (fileIds.length > 0) {
				await db.delete(schema.chunks).where(
					sql`${schema.chunks.fileId} IN (${sql.join(
						fileIds.map((id) => sql`${id}`),
						sql`, `
					)})`
				)
			}

			// Insert new chunks
			for (const fc of fileChunks) {
				const fileId = fileIdMap.get(fc.filePath)
				if (!fileId) continue

				const chunkIds: number[] = []
				for (const chunk of fc.chunks) {
					const insertValues: Record<string, unknown> = {
						fileId,
						content: chunk.content,
						type: chunk.type,
						startLine: chunk.startLine,
						endLine: chunk.endLine,
					}
					if (chunk.metadata) {
						insertValues.metadata = JSON.stringify(chunk.metadata)
					}
					const insertResult = await db
						.insert(schema.chunks)
						.values(insertValues as typeof schema.chunks.$inferInsert)
						.returning({ id: schema.chunks.id })

					if (insertResult[0]) {
						chunkIds.push(insertResult[0].id)
					}
				}
				result.set(fc.filePath, chunkIds)
			}

			sqlite.exec('COMMIT')
		} catch (error) {
			sqlite.exec('ROLLBACK')
			throw error
		}

		return result
	}

	/**
	 * Get chunks for a file
	 */
	async getChunksForFile(filePath: string): Promise<StoredChunk[]> {
		const { db } = this.dbInstance

		const results = await db
			.select({
				id: schema.chunks.id,
				fileId: schema.chunks.fileId,
				content: schema.chunks.content,
				type: schema.chunks.type,
				startLine: schema.chunks.startLine,
				endLine: schema.chunks.endLine,
				metadata: schema.chunks.metadata,
				filePath: schema.files.path,
			})
			.from(schema.chunks)
			.innerJoin(schema.files, eq(schema.chunks.fileId, schema.files.id))
			.where(eq(schema.files.path, filePath))
			.all()

		return results.map((r) => ({
			id: r.id,
			fileId: r.fileId,
			filePath: r.filePath,
			content: r.content,
			type: r.type,
			startLine: r.startLine,
			endLine: r.endLine,
			metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
		}))
	}

	/**
	 * Get total chunk count
	 */
	async getChunkCount(): Promise<number> {
		const { db } = this.dbInstance
		const result = await db.select({ count: sql<number>`count(*)` }).from(schema.chunks).get()
		return result?.count || 0
	}

	/**
	 * Get file count
	 */
	async count(): Promise<number> {
		const { db } = this.dbInstance

		const result = await db.select({ count: sql<number>`count(*)` }).from(schema.files).get()

		return result?.count || 0
	}

	/**
	 * Check if file exists
	 */
	async exists(path: string): Promise<boolean> {
		const { db } = this.dbInstance

		const result = await db.select().from(schema.files).where(eq(schema.files.path, path)).get()

		return result !== undefined
	}

	/**
	 * Store document vectors (TF-IDF) for a CHUNK
	 */
	async storeChunkVectors(
		chunkId: number,
		terms: Map<string, { tf: number; tfidf: number; rawFreq: number }>,
		tokenCount?: number
	): Promise<void> {
		const { db, sqlite } = this.dbInstance

		// Delete existing vectors for this chunk
		await db.delete(schema.documentVectors).where(eq(schema.documentVectors.chunkId, chunkId))

		// Update token count if provided
		if (tokenCount !== undefined) {
			sqlite.exec(`UPDATE chunks SET token_count = ${tokenCount} WHERE id = ${chunkId}`)
		}

		// Insert new vectors in batches (SQLite has ~999 bind variable limit, 5 fields per row = 199 rows)
		const BATCH_SIZE = 199
		const vectors = Array.from(terms.entries()).map(([term, scores]) => ({
			chunkId,
			term,
			tf: scores.tf,
			tfidf: scores.tfidf,
			rawFreq: scores.rawFreq,
		}))

		for (let i = 0; i < vectors.length; i += BATCH_SIZE) {
			const batch = vectors.slice(i, i + BATCH_SIZE)
			await db.insert(schema.documentVectors).values(batch)
		}
	}

	/**
	 * Store document vectors for multiple CHUNKS in a single transaction (batch operation)
	 * Much faster than storing one by one for large datasets
	 */
	async storeManyChunkVectors(
		chunkVectors: Array<{
			chunkId: number
			terms: Map<string, { tf: number; tfidf: number; rawFreq: number }>
			tokenCount?: number // For BM25 document length normalization
		}>
	): Promise<void> {
		if (chunkVectors.length === 0) {
			return
		}

		const { db, sqlite } = this.dbInstance

		// Use SQLite transaction for atomic batch insert
		sqlite.exec('BEGIN TRANSACTION')

		try {
			// Delete all existing vectors for these chunks
			const chunkIds = chunkVectors.map((cv) => cv.chunkId)

			if (chunkIds.length > 0) {
				// Delete in batches to avoid SQLite variable limits
				const deleteBatchSize = 500
				for (let i = 0; i < chunkIds.length; i += deleteBatchSize) {
					const batch = chunkIds.slice(i, i + deleteBatchSize)
					await db.delete(schema.documentVectors).where(
						sql`${schema.documentVectors.chunkId} IN (${sql.join(
							batch.map((id) => sql`${id}`),
							sql`, `
						)})`
					)
				}
			}

			// Prepare all vectors for batch insert
			const allVectors: Array<{
				chunkId: number
				term: string
				tf: number
				tfidf: number
				rawFreq: number
			}> = []

			// Track token counts for BM25
			const tokenCountUpdates: Array<{ chunkId: number; tokenCount: number }> = []

			for (const cv of chunkVectors) {
				// Track token count for BM25 document length normalization
				if (cv.tokenCount !== undefined) {
					tokenCountUpdates.push({ chunkId: cv.chunkId, tokenCount: cv.tokenCount })
				}

				for (const [term, scores] of cv.terms.entries()) {
					allVectors.push({
						chunkId: cv.chunkId,
						term,
						tf: scores.tf,
						tfidf: scores.tfidf,
						rawFreq: scores.rawFreq,
					})
				}
			}

			// Update token counts for BM25 (using raw SQL)
			for (const { chunkId, tokenCount } of tokenCountUpdates) {
				sqlite.exec(`UPDATE chunks SET token_count = ${tokenCount} WHERE id = ${chunkId}`)
			}

			// Insert in batches to avoid SQLite variable limits (5 fields per row = 199 rows max)
			const batchSize = 199
			for (let i = 0; i < allVectors.length; i += batchSize) {
				const batch = allVectors.slice(i, i + batchSize)
				if (batch.length > 0) {
					await db.insert(schema.documentVectors).values(batch)
				}
			}

			sqlite.exec('COMMIT')
		} catch (error) {
			sqlite.exec('ROLLBACK')
			throw error
		}
	}

	/**
	 * Store IDF scores
	 */
	async storeIdfScores(idf: Map<string, number>, docFreq: Map<string, number>): Promise<void> {
		const { db } = this.dbInstance

		// Clear existing IDF scores
		await db.delete(schema.idfScores)

		// Insert new scores in batches (SQLite has ~999 bind variable limit, 3 fields per row = 300 rows)
		const BATCH_SIZE = 300
		const scores = Array.from(idf.entries()).map(([term, idfScore]) => ({
			term,
			idf: idfScore,
			documentFrequency: docFreq.get(term) || 0,
		}))

		for (let i = 0; i < scores.length; i += BATCH_SIZE) {
			const batch = scores.slice(i, i + BATCH_SIZE)
			await db.insert(schema.idfScores).values(batch)
		}
	}

	/**
	 * Get IDF scores
	 */
	async getIdfScores(): Promise<Map<string, number>> {
		const { db } = this.dbInstance

		const scores = await db.select().from(schema.idfScores).all()

		const idf = new Map<string, number>()
		for (const score of scores) {
			idf.set(score.term, score.idf)
		}

		return idf
	}

	/**
	 * Get document vectors for a chunk
	 */
	async getChunkVectors(
		chunkId: number
	): Promise<Map<string, { tf: number; tfidf: number; rawFreq: number }> | null> {
		const { db } = this.dbInstance

		const vectors = await db
			.select()
			.from(schema.documentVectors)
			.where(eq(schema.documentVectors.chunkId, chunkId))
			.all()

		if (vectors.length === 0) {
			return null
		}

		const terms = new Map<string, { tf: number; tfidf: number; rawFreq: number }>()
		for (const vector of vectors) {
			terms.set(vector.term, {
				tf: vector.tf,
				tfidf: vector.tfidf,
				rawFreq: vector.rawFreq,
			})
		}

		return terms
	}

	/**
	 * Get all chunk vectors in a single batch query (CPU + Memory optimization)
	 * Avoids N+1 query pattern when loading index from storage
	 * Returns Map<chunkId, Map<term, {tf, tfidf, rawFreq}>>
	 */
	async getAllChunkVectors(): Promise<
		Map<number, Map<string, { tf: number; tfidf: number; rawFreq: number }>>
	> {
		const { db } = this.dbInstance

		// Single query to get all vectors
		const results = await db
			.select({
				chunkId: schema.documentVectors.chunkId,
				term: schema.documentVectors.term,
				tf: schema.documentVectors.tf,
				tfidf: schema.documentVectors.tfidf,
				rawFreq: schema.documentVectors.rawFreq,
			})
			.from(schema.documentVectors)
			.all()

		// Group by chunk ID
		const allVectors = new Map<
			number,
			Map<string, { tf: number; tfidf: number; rawFreq: number }>
		>()

		for (const row of results) {
			let chunkVectors = allVectors.get(row.chunkId)
			if (!chunkVectors) {
				chunkVectors = new Map()
				allVectors.set(row.chunkId, chunkVectors)
			}
			chunkVectors.set(row.term, {
				tf: row.tf,
				tfidf: row.tfidf,
				rawFreq: row.rawFreq,
			})
		}

		return allVectors
	}

	/**
	 * Search chunks by terms using SQL (Memory optimization)
	 * Returns matching chunks with their content for direct display
	 * Uses pre-computed magnitude from chunks table
	 */
	async searchByTerms(
		queryTerms: string[],
		options: { limit?: number } = {}
	): Promise<
		Array<{
			chunkId: number
			filePath: string
			content: string
			type: string
			startLine: number
			endLine: number
			matchedTerms: Map<string, { tfidf: number; rawFreq: number }>
			magnitude: number
			tokenCount: number // For BM25 document length normalization
		}>
	> {
		if (queryTerms.length === 0) {
			return []
		}

		const { db } = this.dbInstance
		const { limit = 100 } = options

		// Step 1: Find chunk IDs that contain any query term, with pre-computed magnitude and token count
		const matchingChunks = await db
			.select({
				chunkId: schema.documentVectors.chunkId,
				filePath: schema.files.path,
				content: schema.chunks.content,
				type: schema.chunks.type,
				startLine: schema.chunks.startLine,
				endLine: schema.chunks.endLine,
				magnitude: schema.chunks.magnitude,
				tokenCount: schema.chunks.tokenCount,
				matchCount: sql<number>`COUNT(DISTINCT ${schema.documentVectors.term})`,
			})
			.from(schema.documentVectors)
			.innerJoin(schema.chunks, eq(schema.documentVectors.chunkId, schema.chunks.id))
			.innerJoin(schema.files, eq(schema.chunks.fileId, schema.files.id))
			.where(
				sql`${schema.documentVectors.term} IN (${sql.join(
					queryTerms.map((t) => sql`${t}`),
					sql`, `
				)})`
			)
			.groupBy(schema.documentVectors.chunkId)
			.orderBy(sql`COUNT(DISTINCT ${schema.documentVectors.term}) DESC`)
			.limit(limit * 2) // Get more candidates for scoring
			.all()

		if (matchingChunks.length === 0) {
			return []
		}

		// Step 2: Get matched term vectors for these chunks (only query terms)
		const chunkIds = matchingChunks.map((c) => c.chunkId)
		const matchedVectors = await db
			.select({
				chunkId: schema.documentVectors.chunkId,
				term: schema.documentVectors.term,
				tfidf: schema.documentVectors.tfidf,
				rawFreq: schema.documentVectors.rawFreq,
			})
			.from(schema.documentVectors)
			.where(
				sql`${schema.documentVectors.chunkId} IN (${sql.join(
					chunkIds.map((id) => sql`${id}`),
					sql`, `
				)}) AND ${schema.documentVectors.term} IN (${sql.join(
					queryTerms.map((t) => sql`${t}`),
					sql`, `
				)})`
			)
			.all()

		// Build result map with pre-computed magnitude and token count
		const resultMap = new Map<
			number,
			{
				chunkId: number
				filePath: string
				content: string
				type: string
				startLine: number
				endLine: number
				matchedTerms: Map<string, { tfidf: number; rawFreq: number }>
				magnitude: number
				tokenCount: number
			}
		>()

		// Initialize result entries with chunk data
		for (const c of matchingChunks) {
			resultMap.set(c.chunkId, {
				chunkId: c.chunkId,
				filePath: c.filePath,
				content: c.content,
				type: c.type,
				startLine: c.startLine,
				endLine: c.endLine,
				matchedTerms: new Map(),
				magnitude: c.magnitude ?? 0,
				tokenCount: c.tokenCount ?? 0,
			})
		}

		// Populate matched terms
		for (const v of matchedVectors) {
			const entry = resultMap.get(v.chunkId)
			if (entry) {
				entry.matchedTerms.set(v.term, { tfidf: v.tfidf, rawFreq: v.rawFreq })
			}
		}

		return Array.from(resultMap.values())
	}

	/**
	 * Get IDF scores for specific terms only (Memory optimization)
	 */
	async getIdfScoresForTerms(terms: string[]): Promise<Map<string, number>> {
		if (terms.length === 0) {
			return new Map()
		}

		const { db } = this.dbInstance

		const scores = await db
			.select()
			.from(schema.idfScores)
			.where(
				sql`${schema.idfScores.term} IN (${sql.join(
					terms.map((t) => sql`${t}`),
					sql`, `
				)})`
			)
			.all()

		const idf = new Map<string, number>()
		for (const score of scores) {
			idf.set(score.term, score.idf)
		}

		return idf
	}

	/**
	 * Get total chunk count (for IDF calculation)
	 * BM25/TF-IDF now operates at chunk level, not file level
	 */
	async getTotalDocuments(): Promise<number> {
		return this.getChunkCount()
	}

	/**
	 * Get all file metadata (path, mtime, hash) without content
	 * Used for incremental diff detection
	 */
	async getAllFileMetadata(): Promise<Map<string, { mtime: number; hash: string }>> {
		const { db } = this.dbInstance

		const results = await db
			.select({
				path: schema.files.path,
				mtime: schema.files.mtime,
				hash: schema.files.hash,
			})
			.from(schema.files)
			.all()

		const metadata = new Map<string, { mtime: number; hash: string }>()
		for (const row of results) {
			metadata.set(row.path, { mtime: row.mtime, hash: row.hash })
		}

		return metadata
	}

	/**
	 * Delete multiple files in a single transaction (batch operation)
	 */
	async deleteFiles(paths: string[]): Promise<void> {
		if (paths.length === 0) {
			return
		}

		const { db, sqlite } = this.dbInstance

		sqlite.exec('BEGIN TRANSACTION')

		try {
			// Delete in chunks to avoid SQLite variable limits
			const chunkSize = 500
			for (let i = 0; i < paths.length; i += chunkSize) {
				const chunk = paths.slice(i, i + chunkSize)
				await db.delete(schema.files).where(
					sql`${schema.files.path} IN (${sql.join(
						chunk.map((p) => sql`${p}`),
						sql`, `
					)})`
				)
			}

			sqlite.exec('COMMIT')
		} catch (error) {
			sqlite.exec('ROLLBACK')
			throw error
		}
	}

	/**
	 * Store metadata
	 */
	async setMetadata(key: string, value: string): Promise<void> {
		const { db } = this.dbInstance

		await db
			.insert(schema.indexMetadata)
			.values({
				key,
				value,
				updatedAt: Date.now(),
			})
			.onConflictDoUpdate({
				target: schema.indexMetadata.key,
				set: {
					value,
					updatedAt: Date.now(),
				},
			})
	}

	/**
	 * Get metadata
	 */
	async getMetadata(key: string): Promise<string | null> {
		const { db } = this.dbInstance

		const result = await db
			.select()
			.from(schema.indexMetadata)
			.where(eq(schema.indexMetadata.key, key))
			.get()

		return result?.value || null
	}

	/**
	 * Get average chunk length (token count) for BM25 scoring
	 * Returns cached value from metadata if available, otherwise calculates from chunks table
	 */
	async getAverageDocLength(): Promise<number> {
		// Try to get cached value first
		const cached = await this.getMetadata('avgDocLength')
		if (cached) {
			return parseFloat(cached)
		}

		// Calculate from chunks table
		const { db } = this.dbInstance
		const result = await db
			.select({
				avgLen: sql<number>`AVG(COALESCE(${schema.chunks.tokenCount}, 0))`,
			})
			.from(schema.chunks)
			.get()

		const avgLen = result?.avgLen || 0

		// Cache the result
		await this.setMetadata('avgDocLength', avgLen.toString())

		return avgLen
	}

	/**
	 * Update average chunk length in metadata (call after indexing)
	 */
	async updateAverageDocLength(): Promise<number> {
		const { db } = this.dbInstance
		const result = await db
			.select({
				avgLen: sql<number>`AVG(COALESCE(${schema.chunks.tokenCount}, 0))`,
			})
			.from(schema.chunks)
			.get()

		const avgLen = result?.avgLen || 0
		await this.setMetadata('avgDocLength', avgLen.toString())

		return avgLen
	}

	/**
	 * Rebuild IDF scores from document vectors using SQL (Memory optimization)
	 * Calculates document frequency for each term across CHUNKS and computes IDF
	 */
	async rebuildIdfScoresFromVectors(): Promise<void> {
		const { db, sqlite } = this.dbInstance

		// Get total chunk count (IDF is calculated per chunk, not per file)
		const totalChunks = await this.getChunkCount()
		if (totalChunks === 0) {
			await db.delete(schema.idfScores)
			return
		}

		// Calculate document frequency for each term using SQL (counting chunks, not files)
		const dfResults = await db
			.select({
				term: schema.documentVectors.term,
				df: sql<number>`COUNT(DISTINCT ${schema.documentVectors.chunkId})`,
			})
			.from(schema.documentVectors)
			.groupBy(schema.documentVectors.term)
			.all()

		// Clear existing IDF scores and insert new ones
		sqlite.exec('BEGIN TRANSACTION')

		try {
			await db.delete(schema.idfScores)

			// Insert in batches using smoothed IDF formula
			// Smoothed IDF: log((N+1)/(df+1)) + 1 ensures no term gets IDF=0
			const BATCH_SIZE = 300
			const scores = dfResults.map((row) => ({
				term: row.term,
				idf: Math.log((totalChunks + 1) / (row.df + 1)) + 1,
				documentFrequency: row.df,
			}))

			for (let i = 0; i < scores.length; i += BATCH_SIZE) {
				const batch = scores.slice(i, i + BATCH_SIZE)
				if (batch.length > 0) {
					await db.insert(schema.idfScores).values(batch)
				}
			}

			sqlite.exec('COMMIT')
		} catch (error) {
			sqlite.exec('ROLLBACK')
			throw error
		}
	}

	/**
	 * Recalculate TF-IDF scores for all documents using current IDF values (Memory optimization)
	 * Updates document_vectors.tfidf = document_vectors.tf * idf_scores.idf
	 */
	async recalculateTfidfScores(): Promise<void> {
		const { sqlite } = this.dbInstance

		// Use raw SQL for efficient batch update with JOIN
		sqlite.exec(`
			UPDATE document_vectors
			SET tfidf = tf * COALESCE(
				(SELECT idf FROM idf_scores WHERE idf_scores.term = document_vectors.term),
				0
			)
		`)
	}

	/**
	 * Update pre-computed magnitude for all chunks (Memory optimization for search)
	 * magnitude = sqrt(sum(tfidf^2)) for each chunk
	 * Called after TF-IDF recalculation to keep magnitude in sync
	 */
	async updateChunkMagnitudes(): Promise<void> {
		const { sqlite } = this.dbInstance

		// Use raw SQL for efficient batch update with aggregate
		sqlite.exec(`
			UPDATE chunks
			SET magnitude = COALESCE(
				(SELECT SQRT(SUM(tfidf * tfidf)) FROM document_vectors WHERE document_vectors.chunk_id = chunks.id),
				0
			)
		`)
	}

	/**
	 * Get terms for chunks of files (for tracking affected terms during incremental updates)
	 * When files are deleted, we need to know which terms were affected
	 */
	async getTermsForFiles(paths: string[]): Promise<Set<string>> {
		if (paths.length === 0) {
			return new Set()
		}

		const { db } = this.dbInstance
		const terms = new Set<string>()

		// Get file IDs
		const files = await db
			.select({ id: schema.files.id })
			.from(schema.files)
			.where(
				sql`${schema.files.path} IN (${sql.join(
					paths.map((p) => sql`${p}`),
					sql`, `
				)})`
			)
			.all()

		if (files.length === 0) {
			return terms
		}

		const fileIds = files.map((f) => f.id)

		// Get chunk IDs for these files
		const chunks = await db
			.select({ id: schema.chunks.id })
			.from(schema.chunks)
			.where(
				sql`${schema.chunks.fileId} IN (${sql.join(
					fileIds.map((id) => sql`${id}`),
					sql`, `
				)})`
			)
			.all()

		if (chunks.length === 0) {
			return terms
		}

		const chunkIds = chunks.map((c) => c.id)

		// Get terms for these chunks
		const results = await db
			.select({ term: schema.documentVectors.term })
			.from(schema.documentVectors)
			.where(
				sql`${schema.documentVectors.chunkId} IN (${sql.join(
					chunkIds.map((id) => sql`${id}`),
					sql`, `
				)})`
			)
			.all()

		for (const row of results) {
			terms.add(row.term)
		}

		return terms
	}

	/**
	 * Get all chunks with their file paths (for bulk operations)
	 */
	async getAllChunks(): Promise<StoredChunk[]> {
		const { db } = this.dbInstance

		const results = await db
			.select({
				id: schema.chunks.id,
				fileId: schema.chunks.fileId,
				content: schema.chunks.content,
				type: schema.chunks.type,
				startLine: schema.chunks.startLine,
				endLine: schema.chunks.endLine,
				metadata: schema.chunks.metadata,
				filePath: schema.files.path,
			})
			.from(schema.chunks)
			.innerJoin(schema.files, eq(schema.chunks.fileId, schema.files.id))
			.all()

		return results.map((r) => ({
			id: r.id,
			fileId: r.fileId,
			filePath: r.filePath,
			content: r.content,
			type: r.type,
			startLine: r.startLine,
			endLine: r.endLine,
			metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
		}))
	}

	/**
	 * Close database connection
	 */
	close(): void {
		this.dbInstance.sqlite.close()
	}
}
