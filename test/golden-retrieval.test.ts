import { describe, expect, it } from 'bun:test'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { invokeRustEngine } from '../packages/mcp-server/src/rust-engine.ts'

const fixtureRoot = join(dirname(fileURLToPath(import.meta.url)), '../fixtures/benchmark-corpus')

const GOLDEN_QUERIES: Array<{ query: string; expectedPath: string }> = [
	{ query: 'user authentication login', expectedPath: 'src/auth/login.ts' },
	{ query: 'database connection pool', expectedPath: 'src/db/pool.ts' },
	{ query: 'checkRateLimit windowMs', expectedPath: 'src/api/rate-limit.ts' },
]

describe('golden retrieval evals (rust-tfidf)', () => {
	it('indexes the public benchmark fixture corpus', () => {
		const index = invokeRustEngine('coderag_index', { root: fixtureRoot })
		expect(index.status).toBe('ok')
	})

	for (const { query, expectedPath } of GOLDEN_QUERIES) {
		it(`returns ${expectedPath} for "${query}"`, () => {
			const search = invokeRustEngine('coderag_search', {
				root: fixtureRoot,
				query,
				limit: 5,
			})
			expect(search.status).toBe('ok')
			expect(search.results?.some((hit) => hit.path.endsWith(expectedPath))).toBe(true)
		})
	}
})
