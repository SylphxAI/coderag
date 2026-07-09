import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { invokeRustEngine, isRustCliAvailable, shouldUseRustEngine } from '../src/rust-engine.js'

const fixtureRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../fixtures/benchmark-corpus')

describe('Rust core boundary', () => {
	test('defaults to the Rust CLI when it is built', () => {
		expect(isRustCliAvailable()).toBe(true)
		expect(shouldUseRustEngine()).toBe(true)
	})

	test('indexes and searches fixture corpus via coderag-cli', () => {
		const index = invokeRustEngine('coderag_index', { root: fixtureRoot })
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

	test('keeps retrieval logic out of the TypeScript adapter sources', () => {
		const engineSrc = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../src/rust-engine.ts'), 'utf8')
		expect(engineSrc).toContain('spawnSync')
		expect(engineSrc).not.toContain('buildSearchIndex')
	})
})
