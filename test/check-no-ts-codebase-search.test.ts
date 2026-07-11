import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const repoRoot = path.resolve(import.meta.dirname, '..')

const readText = (relativePath: string): string => readFileSync(path.join(repoRoot, relativePath), 'utf8')

describe('check-no-ts-codebase-search gate', () => {
	it('gate script exists and enforces Rust codebase_search authority routing', () => {
		const script = readText('scripts/check-no-ts-codebase-search.sh')

		expect(script).toContain('check-no-ts-codebase-search')
		expect(script).toContain('tool/codebase_search')
		expect(script).toContain('rust_impl')
		expect(script).toContain('codebase_search::codebase_search')
		expect(script).toContain('RustCore')
		expect(script).toContain('golden-retrieval-baseline.json')
		expect(script).toContain('golden_parity.rs')
		expect(script).toContain('check:no-ts-codebase-search')
		expect(existsSync(path.join(repoRoot, 'crates/coderag-mcp-server/src/codebase_search.rs'))).toBe(true)
		expect(existsSync(path.join(repoRoot, 'fixtures/golden-retrieval-baseline.json'))).toBe(true)
		expect(existsSync(path.join(repoRoot, 'crates/coderag-mcp-server/tests/golden_parity.rs'))).toBe(true)
		expect(existsSync(path.join(repoRoot, 'test/integration/http-transport.test.ts'))).toBe(true)
	})

	it('Rust rmcp server routes codebase_search through coderag-core', () => {
		const rustLib = readText('crates/coderag-mcp-server/src/lib.rs')
		const rustHandler = readText('crates/coderag-mcp-server/src/codebase_search.rs')
		const toolRoutes = readText('crates/coderag-mcp-server/src/tool_routes.rs')
		const rustCore = readText('crates/coderag-core/src/engine.rs')
		const bin = readText('bin/coderag-mcp')

		expect(rustLib).toContain('codebase_search::codebase_search')
		expect(rustHandler).toContain('coderag_index')
		expect(rustHandler).toContain('coderag_search')
		expect(rustHandler).toContain('CODEBASE_SEARCH_ROUTE')
		expect(toolRoutes).toContain('"codebase_search"')
		expect(toolRoutes).toContain('RustCore')
		expect(rustCore).toContain('handle_tool')
		expect(bin).toContain('resolve_rust_bin')
		expect(bin).not.toContain('use_ts_transport')
		expect(existsSync(path.join(repoRoot, 'packages/mcp-server/src/index.ts'))).toBe(false)
	})

	it('migration ledger records tool/codebase_search rust_impl with hard gate evidence (rej-010)', () => {
		const ledger = JSON.parse(readText('docs/specs/coderag-migration-ledger.json')) as {
			capabilities: Array<{
				id: string
				state: string
				parityTest?: string
				notes?: string
				proof?: { status: string }
				differentialTest?: string
			}>
			summary: { rust_impl: number; authority_rust: number; parity_proven: number }
			slices: Record<string, { status: string }>
		}

		const codebaseSearch = ledger.capabilities.find((cap) => cap.id === 'tool/codebase_search')
		const admittedProof = new Set(['missing', 'differential_green', 'canary_green', 'caught_up'])
		expect(codebaseSearch?.state).toBe('rust_impl')
		expect(admittedProof.has(codebaseSearch?.proof?.status ?? '')).toBe(true)
		expect(codebaseSearch?.parityTest).toContain('scripts/check-no-ts-codebase-search.sh')
		expect(codebaseSearch?.parityTest).toContain('test/check-no-ts-codebase-search.test.ts')
		expect(codebaseSearch?.differentialTest).toContain('tool_codebase_search_differential_matches_ts_oracle')
		expect(codebaseSearch?.notes).toContain('Cycle29')
		expect(ledger.summary.rust_impl).toBe(3)
		expect(ledger.summary.authority_rust).toBe(0)
		expect(ledger.summary.parity_proven).toBe(0)
		expect(['harness_landed', 'canary_green_admitted']).toContain(ledger.slices.S4?.status)
	})

	it('golden parity harnesses prove codebase_search baseline over stdio and HTTP', () => {
		const stdioParity = readText('crates/coderag-mcp-server/tests/golden_parity.rs')
		const httpIntegration = readText('test/integration/http-transport.test.ts')
		const retrievalParity = readText('test/retrieval-parity.test.ts')

		expect(stdioParity).toContain('codebase_search_matches_golden_baseline_paths')
		expect(stdioParity).toContain('CODEBASE_SEARCH_ROUTE')
		expect(httpIntegration).toContain('codebase_search golden parity over HTTP')
		expect(httpIntegration).toContain('golden-retrieval-baseline.json')
		expect(retrievalParity).toContain('frozen baseline')
	})
})
