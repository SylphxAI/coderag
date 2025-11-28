/**
 * Persistent storage tests
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { CodebaseFile } from './storage.js'
import { PersistentStorage } from './storage-persistent.js'

describe('PersistentStorage', () => {
	let storage: PersistentStorage
	let testDbPath: string
	let testDir: string

	beforeEach(() => {
		// Create temp directory for test database
		testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codebase-search-test-'))
		testDbPath = path.join(testDir, 'test.db')
		storage = new PersistentStorage({ dbPath: testDbPath, codebaseRoot: testDir })
	})

	afterEach(() => {
		// Clean up
		storage.close()
		if (fs.existsSync(testDir)) {
			fs.rmSync(testDir, { recursive: true, force: true })
		}
	})

	describe('storeFile', () => {
		it('should store a file', async () => {
			const file: CodebaseFile = {
				path: 'test.ts',
				content: 'console.log("test")',
				hash: 'abc123',
				size: 100,
				mtime: Date.now(),
				language: 'typescript',
			}

			await storage.storeFile(file)

			const retrieved = await storage.getFile('test.ts')
			expect(retrieved).not.toBeNull()
			expect(retrieved?.path).toBe('test.ts')
			expect(retrieved?.content).toBe('console.log("test")')
			expect(retrieved?.hash).toBe('abc123')
			expect(retrieved?.language).toBe('typescript')
		})

		it('should update existing file on conflict', async () => {
			const file1: CodebaseFile = {
				path: 'test.ts',
				content: 'v1',
				hash: 'hash1',
				size: 10,
				mtime: Date.now(),
			}

			const file2: CodebaseFile = {
				path: 'test.ts',
				content: 'v2',
				hash: 'hash2',
				size: 20,
				mtime: Date.now(),
			}

			await storage.storeFile(file1)
			await storage.storeFile(file2)

			const retrieved = await storage.getFile('test.ts')
			expect(retrieved?.content).toBe('v2')
			expect(retrieved?.hash).toBe('hash2')
			expect(retrieved?.size).toBe(20)
		})

		it('should handle files without language field', async () => {
			const file: CodebaseFile = {
				path: 'test.txt',
				content: 'plain text',
				hash: 'xyz789',
				size: 50,
				mtime: Date.now(),
			}

			await storage.storeFile(file)

			const retrieved = await storage.getFile('test.txt')
			expect(retrieved).not.toBeNull()
			expect(retrieved?.language).toBeUndefined()
		})
	})

	describe('getFile', () => {
		it('should return null for non-existent file', async () => {
			const result = await storage.getFile('nonexistent.ts')
			expect(result).toBeNull()
		})

		it('should retrieve stored file', async () => {
			const file: CodebaseFile = {
				path: 'example.js',
				content: 'const x = 1;',
				hash: 'hash123',
				size: 12,
				mtime: 1234567890,
				language: 'javascript',
			}

			await storage.storeFile(file)
			const retrieved = await storage.getFile('example.js')

			expect(retrieved).toEqual({
				path: 'example.js',
				content: 'const x = 1;',
				hash: 'hash123',
				size: 12,
				mtime: 1234567890,
				language: 'javascript',
			})
		})
	})

	describe('getAllFiles', () => {
		it('should return empty array when no files stored', async () => {
			const files = await storage.getAllFiles()
			expect(files).toEqual([])
		})

		it('should return all stored files', async () => {
			const file1: CodebaseFile = {
				path: 'a.ts',
				content: 'a',
				hash: 'hash_a',
				size: 1,
				mtime: Date.now(),
			}

			const file2: CodebaseFile = {
				path: 'b.ts',
				content: 'b',
				hash: 'hash_b',
				size: 1,
				mtime: Date.now(),
			}

			await storage.storeFile(file1)
			await storage.storeFile(file2)

			const files = await storage.getAllFiles()
			expect(files).toHaveLength(2)
			expect(files.map((f) => f.path).sort()).toEqual(['a.ts', 'b.ts'])
		})
	})

	describe('deleteFile', () => {
		it('should delete a file', async () => {
			const file: CodebaseFile = {
				path: 'delete-me.ts',
				content: 'delete',
				hash: 'hash',
				size: 6,
				mtime: Date.now(),
			}

			await storage.storeFile(file)
			expect(await storage.exists('delete-me.ts')).toBe(true)

			await storage.deleteFile('delete-me.ts')
			expect(await storage.exists('delete-me.ts')).toBe(false)
		})

		it('should not error when deleting non-existent file', async () => {
			await expect(storage.deleteFile('nonexistent.ts')).resolves.not.toThrow()
		})
	})

	describe('clear', () => {
		it('should clear all files', async () => {
			const file1: CodebaseFile = {
				path: 'a.ts',
				content: 'a',
				hash: 'hash_a',
				size: 1,
				mtime: Date.now(),
			}

			const file2: CodebaseFile = {
				path: 'b.ts',
				content: 'b',
				hash: 'hash_b',
				size: 1,
				mtime: Date.now(),
			}

			await storage.storeFile(file1)
			await storage.storeFile(file2)
			expect(await storage.count()).toBe(2)

			await storage.clear()
			expect(await storage.count()).toBe(0)
			expect(await storage.getAllFiles()).toEqual([])
		})
	})

	describe('count', () => {
		it('should return 0 when no files', async () => {
			const count = await storage.count()
			expect(count).toBe(0)
		})

		it('should return correct count', async () => {
			await storage.storeFile({
				path: '1.ts',
				content: '',
				hash: 'h1',
				size: 0,
				mtime: Date.now(),
			})

			await storage.storeFile({
				path: '2.ts',
				content: '',
				hash: 'h2',
				size: 0,
				mtime: Date.now(),
			})

			expect(await storage.count()).toBe(2)
		})
	})

	describe('exists', () => {
		it('should return false for non-existent file', async () => {
			const exists = await storage.exists('nonexistent.ts')
			expect(exists).toBe(false)
		})

		it('should return true for existing file', async () => {
			await storage.storeFile({
				path: 'exists.ts',
				content: 'exists',
				hash: 'hash',
				size: 6,
				mtime: Date.now(),
			})

			const exists = await storage.exists('exists.ts')
			expect(exists).toBe(true)
		})
	})

	describe('metadata', () => {
		it('should store and retrieve metadata', async () => {
			await storage.setMetadata('version', '1.0.0')
			const value = await storage.getMetadata('version')
			expect(value).toBe('1.0.0')
		})

		it('should return null for non-existent metadata', async () => {
			const value = await storage.getMetadata('nonexistent')
			expect(value).toBeNull()
		})

		it('should update existing metadata', async () => {
			await storage.setMetadata('key', 'v1')
			await storage.setMetadata('key', 'v2')
			const value = await storage.getMetadata('key')
			expect(value).toBe('v2')
		})
	})

	describe('chunk vectors', () => {
		it('should store and retrieve chunk vectors', async () => {
			// First store a file
			await storage.storeFile({
				path: 'doc.ts',
				content: 'function test() {}',
				hash: 'hash',
				size: 18,
				mtime: Date.now(),
			})

			// Store chunks
			const chunkIds = await storage.storeChunks('doc.ts', [
				{ content: 'function test() {}', type: 'FunctionDeclaration', startLine: 1, endLine: 1 },
			])
			expect(chunkIds.length).toBe(1)
			const chunkId = chunkIds[0]

			// Store vectors for chunk
			const terms = new Map([
				['function', { tf: 0.5, tfidf: 1.2, rawFreq: 1 }],
				['test', { tf: 0.5, tfidf: 0.8, rawFreq: 1 }],
			])

			await storage.storeChunkVectors(chunkId, terms)

			// Retrieve vectors
			const retrieved = await storage.getChunkVectors(chunkId)
			expect(retrieved).not.toBeNull()
			expect(retrieved?.size).toBe(2)
			expect(retrieved?.get('function')).toEqual({ tf: 0.5, tfidf: 1.2, rawFreq: 1 })
			expect(retrieved?.get('test')).toEqual({ tf: 0.5, tfidf: 0.8, rawFreq: 1 })
		})

		it('should update chunk vectors on re-index', async () => {
			await storage.storeFile({
				path: 'doc.ts',
				content: 'test',
				hash: 'hash',
				size: 4,
				mtime: Date.now(),
			})

			// Store chunks
			const chunkIds = await storage.storeChunks('doc.ts', [
				{ content: 'test', type: 'text', startLine: 1, endLine: 1 },
			])
			const chunkId = chunkIds[0]

			// First vectors
			const terms1 = new Map([['old', { tf: 1.0, tfidf: 1.0, rawFreq: 1 }]])
			await storage.storeChunkVectors(chunkId, terms1)

			// Update vectors
			const terms2 = new Map([['new', { tf: 1.0, tfidf: 2.0, rawFreq: 1 }]])
			await storage.storeChunkVectors(chunkId, terms2)

			const retrieved = await storage.getChunkVectors(chunkId)
			expect(retrieved?.size).toBe(1)
			expect(retrieved?.get('new')).toEqual({ tf: 1.0, tfidf: 2.0, rawFreq: 1 })
			expect(retrieved?.has('old')).toBe(false)
		})

		it('should return null for non-existent chunk vectors', async () => {
			const vectors = await storage.getChunkVectors(99999)
			expect(vectors).toBeNull()
		})
	})

	describe('IDF scores', () => {
		it('should store and retrieve IDF scores', async () => {
			const idf = new Map([
				['function', 1.5],
				['const', 0.8],
			])

			const docFreq = new Map([
				['function', 10],
				['const', 25],
			])

			await storage.storeIdfScores(idf, docFreq)

			const retrieved = await storage.getIdfScores()
			expect(retrieved.size).toBe(2)
			expect(retrieved.get('function')).toBe(1.5)
			expect(retrieved.get('const')).toBe(0.8)
		})

		it('should replace IDF scores on update', async () => {
			const idf1 = new Map([['old', 1.0]])
			const docFreq1 = new Map([['old', 1]])
			await storage.storeIdfScores(idf1, docFreq1)

			const idf2 = new Map([['new', 2.0]])
			const docFreq2 = new Map([['new', 2]])
			await storage.storeIdfScores(idf2, docFreq2)

			const retrieved = await storage.getIdfScores()
			expect(retrieved.size).toBe(1)
			expect(retrieved.get('new')).toBe(2.0)
			expect(retrieved.has('old')).toBe(false)
		})

		it('should return empty map when no IDF scores', async () => {
			const idf = await storage.getIdfScores()
			expect(idf.size).toBe(0)
		})
	})
})
