import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const repoRoot = path.resolve(import.meta.dirname, '..')

describe('TS stdio adapter deletion matrix', () => {
	it('npm bin routes exclusively to Rust rmcp', () => {
		const bin = readFileSync(path.join(repoRoot, 'bin/coderag-mcp'), 'utf8')
		const pkgBin = readFileSync(path.join(repoRoot, 'packages/mcp-server/bin/coderag-mcp'), 'utf8')

		for (const wrapper of [bin, pkgBin]) {
			expect(wrapper).toContain('resolve_rust_bin')
			expect(wrapper).toContain('resolve_transport')
			expect(wrapper).not.toContain('use_ts_transport')
			expect(wrapper).not.toContain('CODERAG_MCP_TRANSPORT:-}" == "ts"')
			expect(wrapper).not.toContain('packages/mcp-server/dist/index.js')
		}
	})

	it('TS stdio adapter sources are deleted', () => {
		expect(existsSync(path.join(repoRoot, 'packages/mcp-server/src/index.ts'))).toBe(false)
		expect(existsSync(path.join(repoRoot, 'packages/mcp-server/dist/index.js'))).toBe(false)
	})

	it('HTTP integration harness exists for web-mcp-http authority proof', () => {
		const integration = readFileSync(path.join(repoRoot, 'test/integration/http-transport.test.ts'), 'utf8')
		expect(integration).toContain('HTTP transport')
		expect(integration).toContain('codebase_search')
	})

	it('deletion gate script enforces ts_deleted ledger state', () => {
		const script = readFileSync(path.join(repoRoot, 'scripts/check-ts-adapter-deletion-ready.sh'), 'utf8')
		expect(script).toContain('require_ledger_state "transport/stdio-ts-adapter" "ts_deleted"')
		expect(script).toContain('packages/mcp-server/src/index.ts must be deleted')
		expect(script).toContain('use_ts_transport')
	})

	it('ledger records stdio-ts-adapter as ts_deleted', () => {
		const ledger = JSON.parse(
			readFileSync(path.join(repoRoot, 'docs/specs/coderag-migration-ledger.json'), 'utf8')
		) as {
			capabilities: Array<{ id: string; state: string }>
			summary: { ts_deleted: number; ts_only: number; completion_progress: number }
		}
		const tsAdapter = ledger.capabilities.find((cap) => cap.id === 'transport/stdio-ts-adapter')
		expect(tsAdapter?.state).toBe('ts_deleted')
		expect(ledger.summary.ts_deleted).toBe(4)
		expect(ledger.summary.ts_only).toBe(0)
		expect(ledger.summary.completion_progress).toBe(1.0)
	})

	it('codebase_search authority gate blocks parallel TS MCP tool handlers', () => {
		const script = readFileSync(path.join(repoRoot, 'scripts/check-no-ts-codebase-search.sh'), 'utf8')
		expect(script).toContain('check-no-ts-codebase-search')
		expect(script).toContain('tool/codebase_search')
		expect(script).toContain('rust_impl')
	})

	it('stdio Rust authority gate blocks parallel TS stdio MCP backend', () => {
		const script = readFileSync(path.join(repoRoot, 'scripts/check-no-ts-stdio-backend.sh'), 'utf8')
		expect(script).toContain('check-no-ts-stdio-backend')
		expect(script).toContain('transport/stdio-rust-rmcp')
		expect(script).toContain('rust_impl')
		expect(script).toContain('transport::stdio')
	})

	it('ledger records transport/stdio-rust-rmcp as ts_deleted (tick023 admission)', () => {
		const ledger = JSON.parse(
			readFileSync(path.join(repoRoot, 'docs/specs/coderag-migration-ledger.json'), 'utf8')
		) as {
			capabilities: Array<{ id: string; state: string; proof?: { status: string } }>
			summary: {
				rust_impl: number
				authority_rust: number
				parity_proven: number
				authority_progress: number
				ts_deleted: number
				completion_progress: number
			}
		}
		const admittedProof = new Set(['missing', 'differential_green', 'canary_green', 'caught_up'])
		const stdioRust = ledger.capabilities.find((cap) => cap.id === 'transport/stdio-rust-rmcp')
		expect(stdioRust?.state).toBe('ts_deleted')
		expect(admittedProof.has(stdioRust?.proof?.status ?? '')).toBe(true)
		expect(stdioRust?.proof?.status).toBe('canary_green')
		expect(ledger.summary.rust_impl).toBe(0)
		expect(ledger.summary.authority_rust).toBe(0)
		expect(ledger.summary.parity_proven).toBe(0)
		expect(ledger.summary.ts_deleted).toBe(4)
		expect(ledger.summary.completion_progress).toBe(1.0)
		expect(ledger.summary.authority_progress).toBe(1.0)
	})

	it('ledger records tool/codebase_search as ts_deleted (tick023 admission)', () => {
		const ledger = JSON.parse(
			readFileSync(path.join(repoRoot, 'docs/specs/coderag-migration-ledger.json'), 'utf8')
		) as {
			capabilities: Array<{ id: string; state: string; proof?: { status: string } }>
			summary: { rust_impl: number; authority_rust: number; parity_proven: number; ts_deleted: number }
		}
		const admittedProof = new Set(['missing', 'differential_green', 'canary_green', 'caught_up'])
		const codebaseSearch = ledger.capabilities.find((cap) => cap.id === 'tool/codebase_search')
		expect(codebaseSearch?.state).toBe('ts_deleted')
		expect(admittedProof.has(codebaseSearch?.proof?.status ?? '')).toBe(true)
		expect(codebaseSearch?.proof?.status).toBe('canary_green')
		expect(ledger.summary.rust_impl).toBe(0)
		expect(ledger.summary.authority_rust).toBe(0)
		expect(ledger.summary.parity_proven).toBe(0)
		expect(ledger.summary.ts_deleted).toBe(4)
	})
})
