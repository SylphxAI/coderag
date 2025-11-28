/**
 * Persistent storage implementation using SQLite + Drizzle ORM
 */

import { eq, sql } from 'drizzle-orm'
import { createDb, type DbConfig, type DbInstance } from './db/client.js'
import { runMigrations } from './db/migrations.js'
import * as schema from './db/schema.js'
import type { CodebaseFile, Storage } from './storage.js'

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

		await db.delete(schema.files)
		await db.delete(schema.documentVectors)
		await db.delete(schema.idfScores)
		await db.delete(schema.indexMetadata)
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
	 * Store document vectors (TF-IDF)
	 */
	async storeDocumentVectors(
		filePath: string,
		terms: Map<string, { tf: number; tfidf: number; rawFreq: number }>
	): Promise<void> {
		const { db } = this.dbInstance

		// Get file ID
		const file = await db.select().from(schema.files).where(eq(schema.files.path, filePath)).get()

		if (!file) {
			throw new Error(`File not found: ${filePath}`)
		}

		// Delete existing vectors for this file
		await db.delete(schema.documentVectors).where(eq(schema.documentVectors.fileId, file.id))

		// Insert new vectors in batches (SQLite has ~999 bind variable limit, 5 fields per row = 199 rows)
		const BATCH_SIZE = 199
		const vectors = Array.from(terms.entries()).map(([term, scores]) => ({
			fileId: file.id,
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
	 * Store document vectors for multiple files in a single transaction (batch operation)
	 * Much faster than storing one by one for large datasets
	 */
	async storeManyDocumentVectors(
		documents: Array<{
			filePath: string
			terms: Map<string, { tf: number; tfidf: number; rawFreq: number }>
		}>
	): Promise<void> {
		if (documents.length === 0) {
			return
		}

		const { db, sqlite } = this.dbInstance

		// Use SQLite transaction for atomic batch insert
		sqlite.exec('BEGIN TRANSACTION')

		try {
			// First, get all file IDs in one query
			const _filePaths = documents.map((doc) => doc.filePath)
			const files = await db.select().from(schema.files).all()

			const fileIdMap = new Map<string, number>()
			for (const file of files) {
				fileIdMap.set(file.path, file.id)
			}

			// Delete all existing vectors for these files
			const fileIds = documents
				.map((doc) => fileIdMap.get(doc.filePath))
				.filter((id): id is number => id !== undefined)

			if (fileIds.length > 0) {
				// Delete in chunks to avoid SQLite variable limits
				const deleteChunkSize = 500
				for (let i = 0; i < fileIds.length; i += deleteChunkSize) {
					const chunk = fileIds.slice(i, i + deleteChunkSize)
					await db.delete(schema.documentVectors).where(
						sql`${schema.documentVectors.fileId} IN (${sql.join(
							chunk.map((id) => sql`${id}`),
							sql`, `
						)})`
					)
				}
			}

			// Prepare all vectors for batch insert
			const allVectors: Array<{
				fileId: number
				term: string
				tf: number
				tfidf: number
				rawFreq: number
			}> = []

			for (const doc of documents) {
				const fileId = fileIdMap.get(doc.filePath)
				if (!fileId) {
					console.error(`[WARN] File not found in database: ${doc.filePath}`)
					continue
				}

				for (const [term, scores] of doc.terms.entries()) {
					allVectors.push({
						fileId,
						term,
						tf: scores.tf,
						tfidf: scores.tfidf,
						rawFreq: scores.rawFreq,
					})
				}
			}

			// Insert in chunks to avoid SQLite variable limits (5 fields per row = 199 rows max)
			const chunkSize = 199
			for (let i = 0; i < allVectors.length; i += chunkSize) {
				const chunk = allVectors.slice(i, i + chunkSize)
				if (chunk.length > 0) {
					await db.insert(schema.documentVectors).values(chunk)
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
	 * Get document vectors for a file
	 */
	async getDocumentVectors(
		filePath: string
	): Promise<Map<string, { tf: number; tfidf: number; rawFreq: number }> | null> {
		const { db } = this.dbInstance

		// Get file ID
		const file = await db.select().from(schema.files).where(eq(schema.files.path, filePath)).get()

		if (!file) {
			return null
		}

		const vectors = await db
			.select()
			.from(schema.documentVectors)
			.where(eq(schema.documentVectors.fileId, file.id))
			.all()

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
	 * Get all document vectors in a single batch query (CPU + Memory optimization)
	 * Avoids N+1 query pattern when loading index from storage
	 */
	async getAllDocumentVectors(): Promise<
		Map<string, Map<string, { tf: number; tfidf: number; rawFreq: number }>>
	> {
		const { db } = this.dbInstance

		// Single JOIN query to get all vectors with file paths
		const results = await db
			.select({
				path: schema.files.path,
				term: schema.documentVectors.term,
				tf: schema.documentVectors.tf,
				tfidf: schema.documentVectors.tfidf,
				rawFreq: schema.documentVectors.rawFreq,
			})
			.from(schema.documentVectors)
			.innerJoin(schema.files, eq(schema.documentVectors.fileId, schema.files.id))
			.all()

		// Group by file path
		const allVectors = new Map<
			string,
			Map<string, { tf: number; tfidf: number; rawFreq: number }>
		>()

		for (const row of results) {
			let fileVectors = allVectors.get(row.path)
			if (!fileVectors) {
				fileVectors = new Map()
				allVectors.set(row.path, fileVectors)
			}
			fileVectors.set(row.term, {
				tf: row.tf,
				tfidf: row.tfidf,
				rawFreq: row.rawFreq,
			})
		}

		return allVectors
	}

	/**
	 * Search documents by terms using SQL (Memory optimization)
	 * Only loads matching documents instead of entire index
	 * Uses pre-computed magnitude from files table - no need to load all vectors
	 */
	async searchByTerms(
		queryTerms: string[],
		options: { limit?: number } = {}
	): Promise<
		Array<{
			path: string
			matchedTerms: Map<string, { tfidf: number; rawFreq: number }>
			magnitude: number
		}>
	> {
		if (queryTerms.length === 0) {
			return []
		}

		const { db } = this.dbInstance
		const { limit = 100 } = options

		// Step 1: Find file IDs that contain any query term, with pre-computed magnitude
		// This is the key optimization - we get magnitude from files table, not from loading all vectors
		const matchingFiles = await db
			.select({
				fileId: schema.documentVectors.fileId,
				path: schema.files.path,
				magnitude: schema.files.magnitude,
				matchCount: sql<number>`COUNT(DISTINCT ${schema.documentVectors.term})`,
			})
			.from(schema.documentVectors)
			.innerJoin(schema.files, eq(schema.documentVectors.fileId, schema.files.id))
			.where(
				sql`${schema.documentVectors.term} IN (${sql.join(
					queryTerms.map((t) => sql`${t}`),
					sql`, `
				)})`
			)
			.groupBy(schema.documentVectors.fileId)
			.orderBy(sql`COUNT(DISTINCT ${schema.documentVectors.term}) DESC`)
			.limit(limit * 2) // Get more candidates for scoring
			.all()

		if (matchingFiles.length === 0) {
			return []
		}

		// Step 2: Get matched term vectors for these files (only query terms)
		const fileIds = matchingFiles.map((f) => f.fileId)
		const matchedVectors = await db
			.select({
				fileId: schema.documentVectors.fileId,
				term: schema.documentVectors.term,
				tfidf: schema.documentVectors.tfidf,
				rawFreq: schema.documentVectors.rawFreq,
			})
			.from(schema.documentVectors)
			.where(
				sql`${schema.documentVectors.fileId} IN (${sql.join(
					fileIds.map((id) => sql`${id}`),
					sql`, `
				)}) AND ${schema.documentVectors.term} IN (${sql.join(
					queryTerms.map((t) => sql`${t}`),
					sql`, `
				)})`
			)
			.all()

		// Build result map with pre-computed magnitude
		const resultMap = new Map<
			number,
			{
				path: string
				matchedTerms: Map<string, { tfidf: number; rawFreq: number }>
				magnitude: number
			}
		>()

		// Initialize result entries with magnitude from files table
		for (const f of matchingFiles) {
			resultMap.set(f.fileId, {
				path: f.path,
				matchedTerms: new Map(),
				magnitude: f.magnitude ?? 0,
			})
		}

		// Populate matched terms
		for (const v of matchedVectors) {
			const entry = resultMap.get(v.fileId)
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
	 * Get total document count (for IDF calculation)
	 */
	async getTotalDocuments(): Promise<number> {
		return this.count()
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
	 * Rebuild IDF scores from document vectors using SQL (Memory optimization)
	 * Calculates document frequency for each term and computes IDF
	 */
	async rebuildIdfScoresFromVectors(): Promise<void> {
		const { db, sqlite } = this.dbInstance

		// Get total document count
		const totalDocs = await this.count()
		if (totalDocs === 0) {
			await db.delete(schema.idfScores)
			return
		}

		// Calculate document frequency for each term using SQL
		const dfResults = await db
			.select({
				term: schema.documentVectors.term,
				df: sql<number>`COUNT(DISTINCT ${schema.documentVectors.fileId})`,
			})
			.from(schema.documentVectors)
			.groupBy(schema.documentVectors.term)
			.all()

		// Clear existing IDF scores and insert new ones
		sqlite.exec('BEGIN TRANSACTION')

		try {
			await db.delete(schema.idfScores)

			// Insert in batches
			const BATCH_SIZE = 300
			const scores = dfResults.map((row) => ({
				term: row.term,
				idf: Math.log(totalDocs / row.df),
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
	 * Update pre-computed magnitude for all files (Memory optimization for search)
	 * magnitude = sqrt(sum(tfidf^2)) for each document
	 * Called after TF-IDF recalculation to keep magnitude in sync
	 */
	async updateFileMagnitudes(): Promise<void> {
		const { sqlite } = this.dbInstance

		// Use raw SQL for efficient batch update with aggregate
		sqlite.exec(`
			UPDATE files
			SET magnitude = COALESCE(
				(SELECT SQRT(SUM(tfidf * tfidf)) FROM document_vectors WHERE document_vectors.file_id = files.id),
				0
			)
		`)
	}

	/**
	 * Store document vectors for specific files only (Incremental update)
	 * More efficient than storeManyDocumentVectors when only few files changed
	 */
	async storeDocumentVectorsForFiles(
		documents: Array<{
			filePath: string
			content: string
		}>,
		tokenize: (content: string) => string[]
	): Promise<Set<string>> {
		if (documents.length === 0) {
			return new Set()
		}

		const { db, sqlite } = this.dbInstance
		const affectedTerms = new Set<string>()

		sqlite.exec('BEGIN TRANSACTION')

		try {
			// Get file IDs
			const files = await db.select().from(schema.files).all()
			const fileIdMap = new Map<string, number>()
			for (const file of files) {
				fileIdMap.set(file.path, file.id)
			}

			for (const doc of documents) {
				const fileId = fileIdMap.get(doc.filePath)
				if (!fileId) continue

				// Tokenize and calculate term frequencies
				const tokens = tokenize(doc.content)
				const termFreq = new Map<string, number>()
				for (const token of tokens) {
					termFreq.set(token, (termFreq.get(token) || 0) + 1)
				}

				// Calculate TF
				const totalTerms = tokens.length
				if (totalTerms === 0) continue

				// Track affected terms
				for (const term of termFreq.keys()) {
					affectedTerms.add(term)
				}

				// Delete existing vectors for this file
				await db.delete(schema.documentVectors).where(eq(schema.documentVectors.fileId, fileId))

				// Insert new vectors
				const vectors = Array.from(termFreq.entries()).map(([term, freq]) => ({
					fileId,
					term,
					tf: freq / totalTerms,
					tfidf: 0, // Will be calculated later
					rawFreq: freq,
				}))

				// Insert in batches
				const BATCH_SIZE = 199
				for (let i = 0; i < vectors.length; i += BATCH_SIZE) {
					const batch = vectors.slice(i, i + BATCH_SIZE)
					if (batch.length > 0) {
						await db.insert(schema.documentVectors).values(batch)
					}
				}
			}

			sqlite.exec('COMMIT')
		} catch (error) {
			sqlite.exec('ROLLBACK')
			throw error
		}

		return affectedTerms
	}

	/**
	 * Get terms for deleted files (for tracking affected terms)
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

		// Get terms for these files
		const results = await db
			.select({ term: schema.documentVectors.term })
			.from(schema.documentVectors)
			.where(
				sql`${schema.documentVectors.fileId} IN (${sql.join(
					fileIds.map((id) => sql`${id}`),
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
	 * Close database connection
	 */
	close(): void {
		this.dbInstance.sqlite.close()
	}
}
