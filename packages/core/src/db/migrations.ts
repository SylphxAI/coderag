/**
 * Database migrations using LibSQL
 */

import type { Client } from '@libsql/client'

/**
 * Check if a migration exists
 */
async function migrationExists(client: Client, hash: string): Promise<boolean> {
	const result = await client.execute({
		sql: 'SELECT id FROM __drizzle_migrations WHERE hash = ?',
		args: [hash],
	})
	return result.rows.length > 0
}

/**
 * Record a migration
 */
async function recordMigration(client: Client, hash: string): Promise<void> {
	await client.execute({
		sql: 'INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)',
		args: [hash, Date.now()],
	})
}

/**
 * Run all migrations
 */
export async function runMigrations(client: Client): Promise<void> {
	// Create migrations table if it doesn't exist
	await client.execute(`
    CREATE TABLE IF NOT EXISTS __drizzle_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hash TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL
    );
  `)

	// Migration 1: Initial schema
	const migration1Hash = 'initial_schema_v1'
	if (!(await migrationExists(client, migration1Hash))) {
		console.error('[DB] Running migration: initial_schema_v1')

		await client.execute(`
      -- Files table
      CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        path TEXT NOT NULL UNIQUE,
        content TEXT NOT NULL,
        hash TEXT NOT NULL,
        size INTEGER NOT NULL,
        mtime INTEGER NOT NULL,
        language TEXT,
        indexed_at INTEGER NOT NULL
      );
    `)

		await client.execute('CREATE INDEX IF NOT EXISTS files_path_idx ON files(path);')
		await client.execute('CREATE INDEX IF NOT EXISTS files_hash_idx ON files(hash);')

		await client.execute(`
      -- Document vectors table
      CREATE TABLE IF NOT EXISTS document_vectors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_id INTEGER NOT NULL,
        term TEXT NOT NULL,
        tf REAL NOT NULL,
        tfidf REAL NOT NULL,
        raw_freq INTEGER NOT NULL,
        FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
      );
    `)

		await client.execute(
			'CREATE INDEX IF NOT EXISTS vectors_file_id_idx ON document_vectors(file_id);'
		)
		await client.execute('CREATE INDEX IF NOT EXISTS vectors_term_idx ON document_vectors(term);')
		await client.execute('CREATE INDEX IF NOT EXISTS vectors_tfidf_idx ON document_vectors(tfidf);')

		await client.execute(`
      -- IDF scores table
      CREATE TABLE IF NOT EXISTS idf_scores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        term TEXT NOT NULL UNIQUE,
        idf REAL NOT NULL,
        document_frequency INTEGER NOT NULL
      );
    `)

		await client.execute('CREATE INDEX IF NOT EXISTS idf_term_idx ON idf_scores(term);')

		await client.execute(`
      -- Index metadata table
      CREATE TABLE IF NOT EXISTS index_metadata (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL UNIQUE,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `)

		await recordMigration(client, migration1Hash)
		console.error('[DB] Migration complete: initial_schema_v1')
	}

	// Migration 2: Add magnitude column to files table (for pre-computed TF-IDF vector magnitude)
	const migration2Hash = 'add_magnitude_column_v1'
	if (!(await migrationExists(client, migration2Hash))) {
		console.error('[DB] Running migration: add_magnitude_column_v1')

		// Add magnitude column with default 0
		await client.execute('ALTER TABLE files ADD COLUMN magnitude REAL DEFAULT 0;')

		await recordMigration(client, migration2Hash)
		console.error('[DB] Migration complete: add_magnitude_column_v1')
	}

	// Migration 3: Add composite index for efficient term search
	const migration3Hash = 'add_composite_term_index_v1'
	if (!(await migrationExists(client, migration3Hash))) {
		console.error('[DB] Running migration: add_composite_term_index_v1')

		// Add composite index (term, file_id) for efficient search queries
		// searchByTerms() filters by term first, then groups by file_id
		await client.execute(
			'CREATE INDEX IF NOT EXISTS vectors_term_file_idx ON document_vectors(term, file_id);'
		)

		await recordMigration(client, migration3Hash)
		console.error('[DB] Migration complete: add_composite_term_index_v1')
	}

	// Migration 4: Add token_count column for BM25 document length normalization
	const migration4Hash = 'add_token_count_column_v1'
	if (!(await migrationExists(client, migration4Hash))) {
		console.error('[DB] Running migration: add_token_count_column_v1')

		// Add token_count column with default 0
		await client.execute('ALTER TABLE files ADD COLUMN token_count INTEGER DEFAULT 0;')

		await recordMigration(client, migration4Hash)
		console.error('[DB] Migration complete: add_token_count_column_v1')
	}

	// Migration 5: Add chunks table and migrate to chunk-level indexing
	const migration5Hash = 'add_chunks_table_v1'
	if (!(await migrationExists(client, migration5Hash))) {
		console.error('[DB] Running migration: add_chunks_table_v1')

		await client.execute(`
      -- Create chunks table
      CREATE TABLE IF NOT EXISTS chunks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        type TEXT NOT NULL,
        start_line INTEGER NOT NULL,
        end_line INTEGER NOT NULL,
        metadata TEXT,
        token_count INTEGER DEFAULT 0,
        magnitude REAL DEFAULT 0,
        FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
      );
    `)

		await client.execute('CREATE INDEX IF NOT EXISTS chunks_file_id_idx ON chunks(file_id);')
		await client.execute('CREATE INDEX IF NOT EXISTS chunks_type_idx ON chunks(type);')

		// Drop old document_vectors table and recreate with chunk_id
		await client.execute('DROP TABLE IF EXISTS document_vectors;')

		await client.execute(`
      CREATE TABLE document_vectors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chunk_id INTEGER NOT NULL,
        term TEXT NOT NULL,
        tf REAL NOT NULL,
        tfidf REAL NOT NULL,
        raw_freq INTEGER NOT NULL,
        FOREIGN KEY (chunk_id) REFERENCES chunks(id) ON DELETE CASCADE
      );
    `)

		await client.execute(
			'CREATE INDEX IF NOT EXISTS vectors_chunk_id_idx ON document_vectors(chunk_id);'
		)
		await client.execute('CREATE INDEX IF NOT EXISTS vectors_term_idx ON document_vectors(term);')
		await client.execute('CREATE INDEX IF NOT EXISTS vectors_tfidf_idx ON document_vectors(tfidf);')
		await client.execute(
			'CREATE INDEX IF NOT EXISTS vectors_term_chunk_idx ON document_vectors(term, chunk_id);'
		)

		// Clear IDF scores (will be recalculated)
		await client.execute('DELETE FROM idf_scores;')

		await recordMigration(client, migration5Hash)
		console.error('[DB] Migration complete: add_chunks_table_v1')
		console.error('[DB] Note: Index needs to be rebuilt after this migration')
	}
}
