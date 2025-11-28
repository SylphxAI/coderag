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
	 * Returns documents containing any of the query terms with their vectors
	 */
	async searchByTerms(
		queryTerms: string[],
		options: { limit?: number } = {}
	): Promise<
		Array<{
			path: string
			matchedTerms: Map<string, { tfidf: number; rawFreq: number }>
			allTerms: Map<string, { tfidf: number }>
		}>
	> {
		if (queryTerms.length === 0) {
			return []
		}

		const { db } = this.dbInstance
		const { limit = 100 } = options

		// Step 1: Find file IDs that contain any query term, ordered by match count
		// This is the key optimization - we only load documents with matches
		const matchingFiles = await db
			.select({
				fileId: schema.documentVectors.fileId,
				path: schema.files.path,
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

		// Step 3: Get all term vectors for magnitude calculation (top terms only for efficiency)
		const allVectors = await db
			.select({
				fileId: schema.documentVectors.fileId,
				term: schema.documentVectors.term,
				tfidf: schema.documentVectors.tfidf,
			})
			.from(schema.documentVectors)
			.where(
				sql`${schema.documentVectors.fileId} IN (${sql.join(
					fileIds.map((id) => sql`${id}`),
					sql`, `
				)})`
			)
			.all()

		// Build result map
		const filePathMap = new Map<number, string>()
		for (const f of matchingFiles) {
			filePathMap.set(f.fileId, f.path)
		}

		const resultMap = new Map<
			number,
			{
				path: string
				matchedTerms: Map<string, { tfidf: number; rawFreq: number }>
				allTerms: Map<string, { tfidf: number }>
			}
		>()

		// Initialize result entries
		for (const f of matchingFiles) {
			resultMap.set(f.fileId, {
				path: f.path,
				matchedTerms: new Map(),
				allTerms: new Map(),
			})
		}

		// Populate matched terms
		for (const v of matchedVectors) {
			const entry = resultMap.get(v.fileId)
			if (entry) {
				entry.matchedTerms.set(v.term, { tfidf: v.tfidf, rawFreq: v.rawFreq })
			}
		}

		// Populate all terms for magnitude calculation
		for (const v of allVectors) {
			const entry = resultMap.get(v.fileId)
			if (entry) {
				entry.allTerms.set(v.term, { tfidf: v.tfidf })
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
	 * Close database connection
	 */
	close(): void {
		this.dbInstance.sqlite.close()
	}
}
