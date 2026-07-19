import { beforeAll, describe, expect, test } from 'bun:test'
import { execSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { invokeRustEngine, isRustCliAvailable, shouldUseRustEngine } from '../src/rust-engine.js'

const fixtureRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../fixtures/benchmark-corpus')
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..')

describe('Rust core boundary', () => {
	beforeAll(() => {
		execSync('cargo build -q --release', { cwd: repoRoot, stdio: 'pipe', timeout: 180_000 })
	}, 180_000)
	test('defaults to the Rust CLI when it is built', () => {
		expect(isRustCliAvailable()).toBe(true)
		expect(shouldUseRustEngine()).toBe(true)
	})

	test('indexes and searches fixture corpus via coderag-cli', () => {
		const index = invokeRustEngine('coderag_index', { root: fixtureRoot, mode: 'full' })
		expect(index.status).toBe('ok')

		const search = invokeRustEngine('coderag_search', {
			root: fixtureRoot,
			query: 'user authentication login',
			limit: 5,
		})
		expect(search.status).toBe('ok')
		expect(search.results?.length).toBeGreaterThan(0)
		expect(search.results?.some((hit) => hit.path.includes('auth/login'))).toBe(true)
	})

	test('returns cache_hit on unchanged auto refresh and score explainability', () => {
		const first = invokeRustEngine('coderag_index', { root: fixtureRoot, mode: 'auto' })
		const second = invokeRustEngine('coderag_index', { root: fixtureRoot, mode: 'auto' })
		expect(first.status).toBe('ok')
		expect(second.status).toBe('ok')
		expect(second.index?.refreshMode).toBe('cache_hit')

		const search = invokeRustEngine('coderag_search', {
			root: fixtureRoot,
			query: 'database connection pool',
			limit: 1,
		})
		expect(search.results?.[0]?.scoreComponents?.length).toBeGreaterThan(0)
	})
})
