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
	},
	(table) => ({
		pathIdx: index('files_path_idx').on(table.path),
		hashIdx: index('files_hash_idx').on(table.hash),
	})
)

/**
 * TF-IDF vectors table
 * Stores term frequencies and TF-IDF scores per document
 */
export const documentVectors = sqliteTable(
	'document_vectors',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		fileId: integer('file_id')
			.notNull()
			.references(() => files.id, { onDelete: 'cascade' }),
		term: text('term').notNull(),
		tf: real('tf').notNull(), // Term frequency
		tfidf: real('tfidf').notNull(), // TF-IDF score
		rawFreq: integer('raw_freq').notNull(), // Raw term count
	},
	(table) => ({
		fileIdIdx: index('vectors_file_id_idx').on(table.fileId),
		termIdx: index('vectors_term_idx').on(table.term),
		tfidfIdx: index('vectors_tfidf_idx').on(table.tfidf),
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

export type DocumentVector = typeof documentVectors.$inferSelect
export type InsertDocumentVector = typeof documentVectors.$inferInsert

export type IdfScore = typeof idfScores.$inferSelect
export type InsertIdfScore = typeof idfScores.$inferInsert

export type IndexMetadata = typeof indexMetadata.$inferSelect
export type InsertIndexMetadata = typeof indexMetadata.$inferInsert
