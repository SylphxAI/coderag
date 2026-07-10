import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const repoRoot = path.resolve(import.meta.dirname, '..')

const readText = (relativePath: string): string => readFileSync(path.join(repoRoot, relativePath), 'utf8')

describe('check-no-ts-stdio-backend gate', () => {
	it('gate script exists and enforces Rust stdio authority routing', () => {
		const script = readText('scripts/check-no-ts-stdio-backend.sh')

		expect(script).toContain('check-no-ts-stdio-backend')
		expect(script).toContain('resolve_rust_bin')
		expect(script).toContain('transport::stdio')
		expect(script).toContain('transport/stdio-rust-rmcp')
		expect(script).toContain('rust_impl')
		expect(script).toContain('transport/stdio-ts-adapter')
		expect(script).toContain('ts_deleted')
		expect(script).toContain('golden_parity.rs')
		expect(script).toContain('golden-retrieval-baseline.json')
		expect(script).toContain('check:no-ts-stdio-backend')
	})

	it('npm bin routes default stdio to Rust rmcp without TS stdio adapter', () => {
		const bin = readText('bin/coderag-mcp')
		const pkgBin = readText('packages/mcp-server/bin/coderag-mcp')
		const rustMain = readText('crates/coderag-mcp-server/src/main.rs')

		for (const wrapper of [bin, pkgBin]) {
			expect(wrapper).toContain('resolve_rust_bin')
			expect(wrapper).toContain('resolve_transport')
			expect(wrapper).toContain('printf')
			expect(wrapper).toContain('stdio')
			expect(wrapper).not.toContain('use_ts_transport')
			expect(wrapper).not.toMatch(/exec node/i)
			expect(wrapper).not.toContain('packages/mcp-server/dist/index.js')
		}

		expect(rustMain).toContain('transport::stdio')
		expect(rustMain).toContain('http_transport::transport_from_env')
		expect(existsSync(path.join(repoRoot, 'packages/mcp-server/src/index.ts'))).toBe(false)
		expect(existsSync(path.join(repoRoot, 'packages/mcp-server/dist/index.js'))).toBe(false)
	})

	it('migration ledger marks transport/stdio-rust-rmcp as rust_impl (rej-010)', () => {
		const ledger = JSON.parse(readText('docs/specs/coderag-migration-ledger.json')) as {
			reauditRef?: string
			capabilities: Array<{
				id: string
				state: string
				notes?: string
				proof?: { status: string }
			}>
			summary: { rust_impl: number; authority_rust: number; parity_proven: number; authority_progress: number }
			slices: Record<string, { status: string }>
		}

		const stdioRust = ledger.capabilities.find((cap) => cap.id === 'transport/stdio-rust-rmcp')
		const tsAdapter = ledger.capabilities.find((cap) => cap.id === 'transport/stdio-ts-adapter')
		expect(ledger.reauditRef).toBe('rej-010')
		expect(stdioRust?.state).toBe('rust_impl')
		expect(stdioRust?.proof?.status).toBe('missing')
		expect(stdioRust?.notes).toContain('Cycle29')
		expect(tsAdapter?.state).toBe('ts_deleted')
		expect(ledger.summary.rust_impl).toBe(3)
		expect(ledger.summary.authority_rust).toBe(0)
		expect(ledger.summary.parity_proven).toBe(0)
		expect(ledger.summary.authority_progress).toBe(0)
		expect(ledger.slices.S5?.status).toBe('harness_landed')
	})

	it('golden parity harness proves codebase_search baseline over rmcp stdio', () => {
		const stdioParity = readText('crates/coderag-mcp-server/tests/golden_parity.rs')
		const retrievalParity = readText('test/retrieval-parity.test.ts')

		expect(stdioParity).toContain('codebase_search_matches_golden_baseline_paths')
		expect(stdioParity).toContain('CODEBASE_SEARCH_ROUTE')
		expect(retrievalParity).toContain('frozen baseline')
	})
})
