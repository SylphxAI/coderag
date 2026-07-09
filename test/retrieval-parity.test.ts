import { beforeAll, describe, expect, it } from 'bun:test'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { invokeRustEngine } from '../packages/mcp-server/src/rust-engine.ts'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const fixtureRoot = join(repoRoot, 'fixtures/benchmark-corpus')
const baselinePath = join(repoRoot, 'fixtures/golden-retrieval-baseline.json')

type ParityCase = {
	id: string
	query: string
	expectedTopPath: string
	expectedPaths: string[]
	minResults: number
}

type ParityBaseline = {
	schemaVersion: number
	profile: string
	capturedFrom: string
	corpusRoot: string
	route: string
	cases: ParityCase[]
}

const baseline = JSON.parse(readFileSync(baselinePath, 'utf8')) as ParityBaseline

describe('retrieval parity (frozen baseline vs Rust authority)', () => {
	beforeAll(() => {
		execSync('cargo build -q --release -p coderag-core -p coderag-cli -p coderag-mcp-server', {
			cwd: repoRoot,
			stdio: 'pipe',
			timeout: 300_000,
		})
		invokeRustEngine('coderag_index', { root: fixtureRoot, mode: 'full' })
	}, 300_000)

	it('loads the frozen parity baseline fixture', () => {
		expect(baseline.schemaVersion).toBe(1)
		expect(baseline.profile).toBe('coderag-retrieval-parity-v1')
		expect(baseline.capturedFrom).toBe('rust-tfidf-shipped-path')
		expect(baseline.cases.length).toBeGreaterThanOrEqual(3)
	})

	for (const parityCase of baseline.cases) {
		it(`matches baseline for ${parityCase.id}`, () => {
			const search = invokeRustEngine('coderag_search', {
				root: fixtureRoot,
				query: parityCase.query,
				limit: 5,
			})

			expect(search.status).toBe('ok')
			expect(search.search?.route).toBe(baseline.route)

			const paths = (search.results ?? []).map((hit) => hit.path)
			expect(paths.length).toBeGreaterThanOrEqual(parityCase.minResults)
			expect(paths[0]).toBe(parityCase.expectedTopPath)
			expect(paths).toEqual(parityCase.expectedPaths)
			expect(search.results?.[0]?.scoreComponents?.length ?? 0).toBeGreaterThan(0)
		})
	}
})
