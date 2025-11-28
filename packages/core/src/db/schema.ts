/**
 * Database schema for persistent codebase index
 */

import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/**
 * Indexed files table
 * Stores file metadata and content
 */
export const files = sqliteTable(
	'files',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		path: text('path').notNull().unique(),
		content: text('content').notNull(),
		hash: text('hash').notNull(),
		size: integer('size').notNull(),
		mtime: integer('mtime').notNull(), // Unix timestamp in milliseconds
		language: text('language'),
		indexedAt: integer('indexed_at').notNull(), // Unix timestamp
		magnitude: real('magnitude').default(0), // Pre-computed TF-IDF vector magnitude for cosine similarity
		tokenCount: integer('token_count').default(0), // Total tokens in document (for BM25 length normalization)
	},
	(table) => ({
		pathIdx: index('files_path_idx').on(table.path),
		hashIdx: index('files_hash_idx').on(table.hash),
	})
)

/**
 * Chunks table
 * Stores semantic chunks extracted from files (functions, classes, sections, etc.)
 */
export const chunks = sqliteTable(
	'chunks',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		fileId: integer('file_id')
			.notNull()
			.references(() => files.id, { onDelete: 'cascade' }),
		content: text('content').notNull(), // Chunk content
		type: text('type').notNull(), // Chunk type (FunctionDeclaration, heading, etc.)
		startLine: integer('start_line').notNull(),
		endLine: integer('end_line').notNull(),
		metadata: text('metadata'), // JSON string for additional metadata
		tokenCount: integer('token_count').default(0), // Tokens in chunk (for BM25)
		magnitude: real('magnitude').default(0), // TF-IDF magnitude for chunk
	},
	(table) => ({
		fileIdIdx: index('chunks_file_id_idx').on(table.fileId),
		typeIdx: index('chunks_type_idx').on(table.type),
	})
)

/**
 * TF-IDF vectors table
 * Stores term frequencies and TF-IDF scores per CHUNK (not file)
 */
export const documentVectors = sqliteTable(
	'document_vectors',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		chunkId: integer('chunk_id')
			.notNull()
			.references(() => chunks.id, { onDelete: 'cascade' }),
		term: text('term').notNull(),
		tf: real('tf').notNull(), // Term frequency
		tfidf: real('tfidf').notNull(), // TF-IDF score
		rawFreq: integer('raw_freq').notNull(), // Raw term count
	},
	(table) => ({
		chunkIdIdx: index('vectors_chunk_id_idx').on(table.chunkId),
		termIdx: index('vectors_term_idx').on(table.term),
		tfidfIdx: index('vectors_tfidf_idx').on(table.tfidf),
		termChunkIdx: index('vectors_term_chunk_idx').on(table.term, table.chunkId), // Composite index for search
	})
)

/**
 * IDF (Inverse Document Frequency) table
 * Stores global IDF scores for terms
 */
export const idfScores = sqliteTable(
	'idf_scores',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		term: text('term').notNull().unique(),
		idf: real('idf').notNull(),
		documentFrequency: integer('document_frequency').notNull(), // How many docs contain this term
	},
	(table) => ({
		termIdx: index('idf_term_idx').on(table.term),
	})
)

/**
 * Index metadata table
 * Stores global index information
 */
export const indexMetadata = sqliteTable('index_metadata', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	key: text('key').notNull().unique(),
	value: text('value').notNull(),
	updatedAt: integer('updated_at').notNull(),
})

export type File = typeof files.$inferSelect
export type InsertFile = typeof files.$inferInsert

export type Chunk = typeof chunks.$inferSelect
export type InsertChunk = typeof chunks.$inferInsert

export type DocumentVector = typeof documentVectors.$inferSelect
export type InsertDocumentVector = typeof documentVectors.$inferInsert

export type IdfScore = typeof idfScores.$inferSelect
export type InsertIdfScore = typeof idfScores.$inferInsert

export type IndexMetadata = typeof indexMetadata.$inferSelect
export type InsertIndexMetadata = typeof indexMetadata.$inferInsert
