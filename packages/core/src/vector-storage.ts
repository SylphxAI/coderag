/**
 * Vector Storage using LanceDB
 * High-performance embedded vector database
 */

import * as lancedb from '@lancedb/lancedb'

/**
 * Vector Document
 */
export interface VectorDocument {
	readonly id: string // Unique identifier (file:// URI)
	readonly embedding: readonly number[] // Vector representation
	readonly metadata: {
		readonly type: 'code' | 'knowledge' // Document type
		readonly language?: string // Programming language
		readonly content?: string // Content snippet (for preview)
		readonly category?: string // Category
		readonly path?: string // File path
		readonly [key: string]: unknown // Other metadata
	}
}

/**
 * Vector Search Result
 */
export interface VectorSearchResult {
	readonly doc: VectorDocument
	readonly similarity: number // 0-1, higher is more similar
	readonly distance: number // Raw distance
}

/**
 * Vector Storage Options
 */
export interface VectorStorageOptions {
	readonly dimensions: number // Vector dimensions (1536 for OpenAI)
	readonly dbPath?: string // Database path (default: in-memory)
	readonly tableName?: string // Table name (default: "vectors")
}

/**
 * Vector Storage Statistics
 */
export interface VectorStorageStats {
	readonly totalDocuments: number
	readonly dimensions: number
	readonly indexSize: number
}

// Internal record type for LanceDB
interface VectorRecord {
	id: string
	vector: number[]
	type: string
	language: string
	content: string
	category: string
	path: string
	metadata_json: string // Store extra metadata as JSON
	[key: string]: unknown // Index signature for LanceDB compatibility
}

/**
 * Vector Storage with LanceDB
 */
export class VectorStorage {
	private db: lancedb.Connection | null = null
	private table: lancedb.Table | null = null
	private dimensions: number
	private dbPath: string
	private tableName: string
	private initialized: boolean = false

	constructor(options: VectorStorageOptions) {
		this.dimensions = options.dimensions
		this.dbPath = options.dbPath || ':memory:'
		this.tableName = options.tableName || 'vectors'
	}

	/**
	 * Initialize the database connection
	 */
	private async ensureInitialized(): Promise<void> {
		if (this.initialized) return

		this.db = await lancedb.connect(this.dbPath)

		// Check if table exists
		const tables = await this.db.tableNames()
		if (tables.includes(this.tableName)) {
			this.table = await this.db.openTable(this.tableName)
		}

		this.initialized = true
	}

	/**
	 * Create table if it doesn't exist
	 */
	private async ensureTable(sampleVector: number[]): Promise<void> {
		await this.ensureInitialized()

		if (this.table) return

		// Create table with first record as schema
		// Use empty strings instead of null to help LanceDB infer types
		const initialRecord: VectorRecord = {
			id: '__schema__',
			vector: sampleVector,
			type: 'code',
			language: '',
			content: '',
			category: '',
			path: '',
			metadata_json: '{}',
		}

		this.table = await this.db?.createTable(this.tableName, [initialRecord])

		// Delete the schema record
		await this.table.delete('id = "__schema__"')
	}

	/**
	 * Convert VectorDocument to LanceDB record
	 */
	private docToRecord(doc: VectorDocument): VectorRecord {
		const { type, language, content, category, path, ...rest } = doc.metadata
		return {
			id: doc.id,
			vector: doc.embedding as number[],
			type,
			language: language || '',
			content: content || '',
			category: category || '',
			path: path || '',
			metadata_json: JSON.stringify(rest),
		}
	}

	/**
	 * Convert LanceDB record to VectorDocument
	 */
	private recordToDoc(record: VectorRecord): VectorDocument {
		const extraMetadata = JSON.parse(record.metadata_json || '{}')
		return {
			id: record.id,
			embedding: record.vector,
			metadata: {
				type: record.type as 'code' | 'knowledge',
				...(record.language && { language: record.language }),
				...(record.content && { content: record.content }),
				...(record.category && { category: record.category }),
				...(record.path && { path: record.path }),
				...extraMetadata,
			},
		}
	}

	/**
	 * Add document to vector storage
	 */
	async addDocument(doc: VectorDocument): Promise<void> {
		if (doc.embedding.length !== this.dimensions) {
			throw new Error(
				`Embedding dimensions (${doc.embedding.length}) don't match index dimensions (${this.dimensions})`
			)
		}

		await this.ensureTable(doc.embedding as number[])

		// Check if exists
		if (await this.hasDocument(doc.id)) {
			throw new Error(`Document with id ${doc.id} already exists`)
		}

		const record = this.docToRecord(doc)
		await this.table?.add([record])
	}

	/**
	 * Add multiple documents in batch
	 */
	async addDocuments(docs: readonly VectorDocument[]): Promise<void> {
		if (docs.length === 0) return

		const firstDoc = docs[0]
		if (firstDoc.embedding.length !== this.dimensions) {
			throw new Error(
				`Embedding dimensions (${firstDoc.embedding.length}) don't match index dimensions (${this.dimensions})`
			)
		}

		await this.ensureTable(firstDoc.embedding as number[])

		const records = docs.map((doc) => this.docToRecord(doc))
		await this.table?.add(records)
	}

	/**
	 * Update document (delete + add)
	 */
	async updateDocument(doc: VectorDocument): Promise<void> {
		await this.deleteDocument(doc.id)
		await this.addDocument(doc)
	}

	/**
	 * Delete document
	 */
	async deleteDocument(docId: string): Promise<boolean> {
		await this.ensureInitialized()

		if (!this.table) return false

		const exists = await this.hasDocument(docId)
		if (!exists) return false

		await this.table.delete(`id = "${docId.replace(/"/g, '\\"')}"`)
		return true
	}

	/**
	 * Search for similar vectors
	 */
	async search(
		queryVector: readonly number[],
		options: {
			readonly k?: number
			readonly minScore?: number
			readonly filter?: (doc: VectorDocument) => boolean
		} = {}
	): Promise<VectorSearchResult[]> {
		const k = options.k || 10
		const minScore = options.minScore || 0

		if (queryVector.length !== this.dimensions) {
			throw new Error(
				`Query vector dimensions (${queryVector.length}) don't match index dimensions (${this.dimensions})`
			)
		}

		await this.ensureInitialized()

		if (!this.table) return []

		// Search with extra results for filtering
		const searchK = options.filter ? k * 3 : k
		const searchResults = await this.table
			.search(queryVector as number[])
			.limit(searchK)
			.toArray()

		const results: VectorSearchResult[] = []

		for (const result of searchResults) {
			const distance = result._distance as number
			// LanceDB uses L2 distance by default, convert to similarity
			// For cosine distance: similarity = 1 - distance
			// For L2: we use 1 / (1 + distance) as approximation
			const similarity = 1 / (1 + distance)

			if (similarity < minScore) continue

			const doc = this.recordToDoc(result as unknown as VectorRecord)

			if (options.filter && !options.filter(doc)) continue

			results.push({ doc, similarity, distance })

			if (results.length >= k) break
		}

		return results
	}

	/**
	 * Get document by ID
	 */
	async getDocument(docId: string): Promise<VectorDocument | undefined> {
		await this.ensureInitialized()

		if (!this.table) return undefined

		const results = await this.table
			.query()
			.where(`id = "${docId.replace(/"/g, '\\"')}"`)
			.limit(1)
			.toArray()

		if (results.length === 0) return undefined

		return this.recordToDoc(results[0] as unknown as VectorRecord)
	}

	/**
	 * Get all documents
	 */
	async getAllDocuments(): Promise<readonly VectorDocument[]> {
		await this.ensureInitialized()

		if (!this.table) return []

		const results = await this.table.query().toArray()
		return results.map((r) => this.recordToDoc(r as unknown as VectorRecord))
	}

	/**
	 * Check if document exists
	 */
	async hasDocument(docId: string): Promise<boolean> {
		await this.ensureInitialized()

		if (!this.table) return false

		const results = await this.table
			.query()
			.where(`id = "${docId.replace(/"/g, '\\"')}"`)
			.limit(1)
			.toArray()

		return results.length > 0
	}

	/**
	 * Get statistics
	 */
	async getStats(): Promise<VectorStorageStats> {
		await this.ensureInitialized()

		if (!this.table) {
			return {
				totalDocuments: 0,
				dimensions: this.dimensions,
				indexSize: 0,
			}
		}

		const count = await this.table.countRows()

		return {
			totalDocuments: count,
			dimensions: this.dimensions,
			indexSize: count,
		}
	}

	/**
	 * Clear all data
	 */
	async clear(): Promise<void> {
		await this.ensureInitialized()

		if (this.table && this.db) {
			await this.db.dropTable(this.tableName)
			this.table = null
		}
	}

	/**
	 * Close database connection
	 */
	async close(): Promise<void> {
		this.db = null
		this.table = null
		this.initialized = false
	}
}
