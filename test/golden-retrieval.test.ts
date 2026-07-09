import { beforeAll, describe, expect, it } from 'bun:test'
import { execSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { invokeRustEngine } from '../packages/mcp-server/src/rust-engine.ts'

const fixtureRoot = join(dirname(fileURLToPath(import.meta.url)), '../fixtures/benchmark-corpus')
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

const GOLDEN_QUERIES: Array<{ query: string; expectedPath: string }> = [
	{ query: 'user authentication login', expectedPath: 'src/auth/login.ts' },
	{ query: 'database connection pool', expectedPath: 'src/db/pool.ts' },
	{ query: 'checkRateLimit windowMs', expectedPath: 'src/api/rate-limit.ts' },
]

describe('golden retrieval evals (rust-tfidf)', () => {
	beforeAll(() => {
		execSync('cargo build -q --release', { cwd: repoRoot, stdio: 'pipe', timeout: 180_000 })
	}, 180_000)

	it('indexes the public benchmark fixture corpus', () => {
		const index = invokeRustEngine('coderag_index', { root: fixtureRoot, mode: 'full' })
		expect(index.status).toBe('ok')
	})

	it('reuses the persisted index on auto refresh when files are unchanged', () => {
		const refresh = invokeRustEngine('coderag_index', { root: fixtureRoot, mode: 'auto' })
		expect(refresh.status).toBe('ok')
		expect(refresh.index?.refreshMode).toBe('cache_hit')
	})

	it('loads a persisted snapshot on a fresh engine process without re-indexing', () => {
		const search = invokeRustEngine('coderag_search', {
			root: fixtureRoot,
			query: 'user authentication login',
			limit: 5,
		})
		expect(search.status).toBe('ok')
		expect(search.results?.some((hit) => hit.path.endsWith('src/auth/login.ts'))).toBe(true)
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
