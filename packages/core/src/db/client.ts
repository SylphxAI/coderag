/**
 * Database client setup using LibSQL (WASM-compatible)
 */

import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { type Client, createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as schema from './schema.js'

export interface DbConfig {
	dbPath?: string
	codebaseRoot?: string
}

export interface DbInstance {
	db: ReturnType<typeof drizzle<typeof schema>>
	client: Client
	dbPath: string
}

/**
 * Get the global coderag data directory
 * Uses ~/.coderag/projects/<hash>/ for persistent storage
 */
export function getCoderagDataDir(codebaseRoot: string): string {
	// Normalize the path and create a stable hash
	const normalizedPath = path.resolve(codebaseRoot)
	const hash = crypto.createHash('sha256').update(normalizedPath).digest('hex').substring(0, 16)

	// Use ~/.coderag/projects/<hash>/
	const homeDir = os.homedir()
	return path.join(homeDir, '.coderag', 'projects', hash)
}

/**
 * Project metadata stored alongside the database
 */
export interface ProjectMetadata {
	path: string
	name: string
	createdAt: string
	lastAccessedAt: string
}

/**
 * Write project metadata to help identify which project a database belongs to
 */
function writeProjectMetadata(dataDir: string, codebaseRoot: string): void {
	const metadataPath = path.join(dataDir, 'metadata.json')
	const metadata: ProjectMetadata = {
		path: path.resolve(codebaseRoot),
		name: path.basename(codebaseRoot),
		createdAt: fs.existsSync(metadataPath)
			? JSON.parse(fs.readFileSync(metadataPath, 'utf8')).createdAt
			: new Date().toISOString(),
		lastAccessedAt: new Date().toISOString(),
	}
	fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2))
}

/**
 * Clean up old .codebase-search folder from previous versions
 * This folder is no longer used - data is now stored in ~/.coderag/
 */
function cleanupOldStorage(codebaseRoot: string): void {
	const oldDir = path.join(codebaseRoot, '.codebase-search')
	if (fs.existsSync(oldDir)) {
		try {
			fs.rmSync(oldDir, { recursive: true, force: true })
			console.error(`[INFO] Cleaned up old storage: ${oldDir}`)
		} catch {
			// Ignore errors - not critical
			console.error(`[WARN] Failed to clean up old storage: ${oldDir}`)
		}
	}
}

/**
 * Create database client (async for LibSQL compatibility)
 */
export async function createDb(config: DbConfig = {}): Promise<DbInstance> {
	const codebaseRoot = config.codebaseRoot || process.cwd()

	// Clean up old .codebase-search folder (no longer used)
	cleanupOldStorage(codebaseRoot)

	// Use global ~/.coderag/projects/<hash>/ directory
	const dbDir = getCoderagDataDir(codebaseRoot)
	const dbPath = config.dbPath || path.join(dbDir, 'index.db')

	// Ensure database directory exists
	if (!fs.existsSync(dbDir)) {
		fs.mkdirSync(dbDir, { recursive: true })
	}

	// Write project metadata for identification
	writeProjectMetadata(dbDir, codebaseRoot)

	// Create LibSQL client with local file
	const client = createClient({
		url: `file:${dbPath}`,
	})

	// Enable WAL mode for better concurrency
	await client.execute('PRAGMA journal_mode = WAL')

	// Create Drizzle instance
	const db = drizzle(client, { schema })

	return { db, client, dbPath }
}
