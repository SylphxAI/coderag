/**
 * Vector Storage Tests (LanceDB)
 */

import fs from 'node:fs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { type VectorDocument, VectorStorage } from './vector-storage.js'

describe('VectorStorage', () => {
	let storage: VectorStorage
	let testDbPath: string

	beforeEach(() => {
		// Use unique path for each test to avoid conflicts
		testDbPath = `/tmp/test-vector-db-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`
		storage = new VectorStorage({ dimensions: 128, dbPath: testDbPath })
	})

	afterEach(async () => {
		await storage.close()
		// Clean up test database
		if (fs.existsSync(testDbPath)) {
			fs.rmSync(testDbPath, { recursive: true, force: true })
		}
	})

	describe('addDocument', () => {
		it('should add a document', async () => {
			const doc: VectorDocument = {
				id: 'doc1',
				embedding: Array(128).fill(1),
				metadata: { type: 'code', language: 'typescript' },
			}

			await storage.addDocument(doc)

			expect(await storage.hasDocument('doc1')).toBe(true)
			expect((await storage.getStats()).totalDocuments).toBe(1)
		})

		it('should throw error for duplicate document ID', async () => {
			const doc: VectorDocument = {
				id: 'doc1',
				embedding: Array(128).fill(1),
				metadata: { type: 'code' },
			}

			await storage.addDocument(doc)

			await expect(storage.addDocument(doc)).rejects.toThrow('already exists')
		})

		it('should throw error for wrong dimensions', async () => {
			const doc: VectorDocument = {
				id: 'doc1',
				embedding: Array(64).fill(1), // Wrong dimensions
				metadata: { type: 'code' },
			}

			await expect(storage.addDocument(doc)).rejects.toThrow("don't match")
		})
	})

	describe('addDocuments', () => {
		it('should add multiple documents', async () => {
			const docs: VectorDocument[] = [
				{
					id: 'doc1',
					embedding: Array(128).fill(1),
					metadata: { type: 'code' },
				},
				{
					id: 'doc2',
					embedding: Array(128).fill(0.5),
					metadata: { type: 'code' },
				},
				{
					id: 'doc3',
					embedding: Array(128).fill(0.25),
					metadata: { type: 'knowledge' },
				},
			]

			await storage.addDocuments(docs)

			expect((await storage.getStats()).totalDocuments).toBe(3)
			expect(await storage.hasDocument('doc1')).toBe(true)
			expect(await storage.hasDocument('doc2')).toBe(true)
			expect(await storage.hasDocument('doc3')).toBe(true)
		})
	})

	describe('search', () => {
		beforeEach(async () => {
			// Add test documents with different embeddings
			await storage.addDocument({
				id: 'doc1',
				embedding: Array(128).fill(1),
				metadata: { type: 'code', language: 'typescript' },
			})

			await storage.addDocument({
				id: 'doc2',
				embedding: Array(128).fill(0.5),
				metadata: { type: 'code', language: 'javascript' },
			})

			await storage.addDocument({
				id: 'doc3',
				embedding: Array(128).fill(0.1),
				metadata: { type: 'knowledge' },
			})
		})

		it('should find most similar documents', async () => {
			const queryVector = Array(128).fill(1)
			const results = await storage.search(queryVector, { k: 2 })

			expect(results).toHaveLength(2)
			expect(results[0].doc.id).toBe('doc1')
		})

		it('should respect k parameter', async () => {
			const queryVector = Array(128).fill(1)
			const results = await storage.search(queryVector, { k: 1 })

			expect(results).toHaveLength(1)
		})

		it('should filter by minimum score', async () => {
			const queryVector = Array(128).fill(1)
			const results = await storage.search(queryVector, { minScore: 0.5 })

			expect(results.every((r) => r.similarity >= 0.5)).toBe(true)
		})

		it('should apply custom filter', async () => {
			const queryVector = Array(128).fill(1)
			const results = await storage.search(queryVector, {
				k: 10,
				filter: (doc) => doc.metadata.type === 'code',
			})

			expect(results.length).toBeLessThanOrEqual(2)
			expect(results.every((r) => r.doc.metadata.type === 'code')).toBe(true)
		})

		it('should return empty array for empty storage', async () => {
			const emptyDbPath = `/tmp/test-empty-${Date.now()}-${Math.random().toString(36).slice(2)}`
			const emptyStorage = new VectorStorage({ dimensions: 128, dbPath: emptyDbPath })
			const results = await emptyStorage.search(Array(128).fill(1))

			expect(results).toHaveLength(0)
			await emptyStorage.close()
			if (fs.existsSync(emptyDbPath)) {
				fs.rmSync(emptyDbPath, { recursive: true, force: true })
			}
		})

		it('should throw error for wrong query dimensions', async () => {
			const queryVector = Array(64).fill(1) // Wrong dimensions

			await expect(storage.search(queryVector)).rejects.toThrow("don't match")
		})
	})

	describe('getDocument', () => {
		it('should retrieve document by ID', async () => {
			const doc: VectorDocument = {
				id: 'doc1',
				embedding: Array(128).fill(1),
				metadata: { type: 'code', language: 'typescript' },
			}

			await storage.addDocument(doc)

			const retrieved = await storage.getDocument('doc1')
			expect(retrieved).toBeDefined()
			expect(retrieved?.id).toBe('doc1')
			expect(retrieved?.metadata.language).toBe('typescript')
		})

		it('should return undefined for non-existent document', async () => {
			const retrieved = await storage.getDocument('nonexistent')
			expect(retrieved).toBeUndefined()
		})
	})

	describe('deleteDocument', () => {
		it('should delete document', async () => {
			const doc: VectorDocument = {
				id: 'doc1',
				embedding: Array(128).fill(1),
				metadata: { type: 'code' },
			}

			await storage.addDocument(doc)
			expect(await storage.hasDocument('doc1')).toBe(true)

			const deleted = await storage.deleteDocument('doc1')
			expect(deleted).toBe(true)
			expect(await storage.hasDocument('doc1')).toBe(false)
			expect(await storage.getDocument('doc1')).toBeUndefined()
		})

		it('should return false for non-existent document', async () => {
			const deleted = await storage.deleteDocument('nonexistent')
			expect(deleted).toBe(false)
		})

		it('should not return deleted documents in search', async () => {
			await storage.addDocument({
				id: 'doc1',
				embedding: Array(128).fill(1),
				metadata: { type: 'code' },
			})

			await storage.addDocument({
				id: 'doc2',
				embedding: Array(128).fill(0.5),
				metadata: { type: 'code' },
			})

			await storage.deleteDocument('doc1')

			const results = await storage.search(Array(128).fill(1), { k: 10 })
			expect(results.every((r) => r.doc.id !== 'doc1')).toBe(true)
		})
	})

	describe('updateDocument', () => {
		it('should update existing document', async () => {
			const doc: VectorDocument = {
				id: 'doc1',
				embedding: Array(128).fill(1),
				metadata: { type: 'code', language: 'javascript' },
			}

			await storage.addDocument(doc)

			const updated: VectorDocument = {
				id: 'doc1',
				embedding: Array(128).fill(0.5),
				metadata: { type: 'code', language: 'typescript' },
			}

			await storage.updateDocument(updated)

			const retrieved = await storage.getDocument('doc1')
			expect(retrieved?.metadata.language).toBe('typescript')
		})

		it('should add new document if not exists', async () => {
			const doc: VectorDocument = {
				id: 'doc1',
				embedding: Array(128).fill(1),
				metadata: { type: 'code' },
			}

			await storage.updateDocument(doc)

			expect(await storage.hasDocument('doc1')).toBe(true)
		})
	})

	describe('getAllDocuments', () => {
		it('should return all documents', async () => {
			const docs: VectorDocument[] = [
				{ id: 'doc1', embedding: Array(128).fill(1), metadata: { type: 'code' } },
				{ id: 'doc2', embedding: Array(128).fill(0.5), metadata: { type: 'code' } },
			]

			await storage.addDocuments(docs)

			const allDocs = await storage.getAllDocuments()
			expect(allDocs).toHaveLength(2)
		})

		it('should return empty array for empty storage', async () => {
			const allDocs = await storage.getAllDocuments()
			expect(allDocs).toHaveLength(0)
		})
	})

	describe('persistence', () => {
		it('should persist data to disk', async () => {
			const persistDbPath = `/tmp/test-persist-${Date.now()}-${Math.random().toString(36).slice(2)}`
			const persistentStorage = new VectorStorage({
				dimensions: 128,
				dbPath: persistDbPath,
			})

			const docs: VectorDocument[] = [
				{
					id: 'doc1',
					embedding: Array(128).fill(1),
					metadata: { type: 'code', language: 'typescript' },
				},
				{
					id: 'doc2',
					embedding: Array(128).fill(0.5),
					metadata: { type: 'code', language: 'javascript' },
				},
			]

			await persistentStorage.addDocuments(docs)
			await persistentStorage.close()

			// Verify directory exists
			expect(fs.existsSync(persistDbPath)).toBe(true)

			// Load in new instance
			const storage2 = new VectorStorage({
				dimensions: 128,
				dbPath: persistDbPath,
			})

			expect((await storage2.getStats()).totalDocuments).toBe(2)
			expect(await storage2.hasDocument('doc1')).toBe(true)
			expect(await storage2.hasDocument('doc2')).toBe(true)

			const doc = await storage2.getDocument('doc1')
			expect(doc).toBeDefined()
			expect(doc?.metadata.language).toBe('typescript')

			await storage2.close()
			fs.rmSync(persistDbPath, { recursive: true, force: true })
		})

		it('should maintain search functionality after reload', async () => {
			const persistDbPath = `/tmp/test-persist-search-${Date.now()}-${Math.random().toString(36).slice(2)}`
			const persistentStorage = new VectorStorage({
				dimensions: 128,
				dbPath: persistDbPath,
			})

			const docs: VectorDocument[] = [
				{ id: 'doc1', embedding: Array(128).fill(1), metadata: { type: 'code' } },
				{ id: 'doc2', embedding: Array(128).fill(0.5), metadata: { type: 'code' } },
			]

			await persistentStorage.addDocuments(docs)
			await persistentStorage.close()

			const storage2 = new VectorStorage({
				dimensions: 128,
				dbPath: persistDbPath,
			})

			const results = await storage2.search(Array(128).fill(1), { k: 2 })
			expect(results).toHaveLength(2)
			expect(results[0].doc.id).toBe('doc1')

			await storage2.close()
			fs.rmSync(persistDbPath, { recursive: true, force: true })
		})
	})

	describe('clear', () => {
		it('should clear all data', async () => {
			const docs: VectorDocument[] = [
				{ id: 'doc1', embedding: Array(128).fill(1), metadata: { type: 'code' } },
				{ id: 'doc2', embedding: Array(128).fill(0.5), metadata: { type: 'code' } },
			]

			await storage.addDocuments(docs)
			expect((await storage.getStats()).totalDocuments).toBe(2)

			await storage.clear()

			expect((await storage.getStats()).totalDocuments).toBe(0)
			expect(await storage.hasDocument('doc1')).toBe(false)
			expect(await storage.hasDocument('doc2')).toBe(false)
		})
	})

	describe('getStats', () => {
		it('should return correct statistics', async () => {
			const docs: VectorDocument[] = [
				{ id: 'doc1', embedding: Array(128).fill(1), metadata: { type: 'code' } },
				{ id: 'doc2', embedding: Array(128).fill(0.5), metadata: { type: 'code' } },
			]

			await storage.addDocuments(docs)

			const stats = await storage.getStats()
			expect(stats.totalDocuments).toBe(2)
			expect(stats.dimensions).toBe(128)
			expect(stats.indexSize).toBe(2)
		})
	})

	describe('performance', () => {
		it('should handle large number of documents', async () => {
			const numDocs = 1000
			const docs: VectorDocument[] = []

			for (let i = 0; i < numDocs; i++) {
				// Create random-ish embeddings
				const embedding = Array(128)
					.fill(0)
					.map(() => Math.sin(i) + Math.cos(i * 0.5))

				docs.push({
					id: `doc${i}`,
					embedding,
					metadata: { type: 'code', index: i },
				})
			}

			const startAdd = Date.now()
			await storage.addDocuments(docs)
			const addTime = Date.now() - startAdd

			console.error(`[PERF] Added ${numDocs} documents in ${addTime}ms`)

			const startSearch = Date.now()
			const results = await storage.search(Array(128).fill(1), { k: 10 })
			const searchTime = Date.now() - startSearch

			console.error(`[PERF] Searched in ${searchTime}ms`)

			expect(results).toHaveLength(10)
			expect(searchTime).toBeLessThan(500) // Should be fast (<500ms)
		})
	})
})
