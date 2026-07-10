import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const repoRoot = path.resolve(import.meta.dirname, '..')

const readText = (relativePath: string): string => readFileSync(path.join(repoRoot, relativePath), 'utf8')

describe('coderag differential harness (rej-010)', () => {
	it('ships fail-closed differential entrypoint and oracle artifacts', () => {
		expect(existsSync(path.join(repoRoot, 'scripts/run-coderag-differential.sh'))).toBe(true)
		expect(existsSync(path.join(repoRoot, 'scripts/differential/codebase-search-oracle.ts'))).toBe(true)
		expect(existsSync(path.join(repoRoot, 'fixtures/golden-retrieval-baseline.json'))).toBe(true)
		expect(
			existsSync(path.join(repoRoot, 'crates/coderag-mcp-server/tests/stdio_codebase_search_differential.rs'))
		).toBe(true)

		const harness = readText('scripts/run-coderag-differential.sh')
		expect(harness).toContain('coderag-differential')
		expect(harness).toContain('codebase-search-oracle.ts')
		expect(harness).toContain('tool_codebase_search_differential_matches_ts_oracle')
		expect(harness).toContain('transport_stdio_rust_rmcp_differential_matches_ts_oracle')
		expect(harness).toContain('differential_green')
		expect(harness).toContain('no SKIP-as-pass')
		expect(harness).toContain('--slice')
	})

	it('parity slice manifest binds codebase_search and stdio transport domains', () => {
		const slice = JSON.parse(readText('docs/specs/codebase-search-parity-slice.json')) as {
			slice: string
			harness: { entrypoint: string; boundedSlices: Record<string, string> }
			capabilities: Array<{ id: string; differentialTest: string }>
		}

		expect(slice.slice).toContain('codebase_search')
		expect(slice.harness.entrypoint).toBe('scripts/run-coderag-differential.sh')
		expect(slice.harness.boundedSlices['tool/codebase_search']).toContain('--slice tool/codebase_search')
		expect(slice.harness.boundedSlices['transport/stdio-rust-rmcp']).toContain('--slice transport/stdio-rust-rmcp')
		expect(slice.capabilities.some((capability) => capability.id === 'tool/codebase_search')).toBe(true)
		expect(slice.capabilities.some((capability) => capability.id === 'transport/stdio-rust-rmcp')).toBe(true)
	})

	it('migration ledger records rej-010 proof holds without promotions', () => {
		const ledger = JSON.parse(readText('docs/specs/coderag-migration-ledger.json')) as {
			reauditRef?: string
			promotionFreeze?: { active: boolean; reason?: string }
			capabilities: Array<{
				id: string
				state: string
				promotionHold?: { rejectionRef?: string }
				proof?: { status: string }
				differentialTest?: string
			}>
			summary: { rust_impl: number; authority_rust: number }
		}

		expect(ledger.reauditRef).toBe('rej-010')
		expect(ledger.promotionFreeze?.active).toBe(true)

		const codebaseSearch = ledger.capabilities.find((entry) => entry.id === 'tool/codebase_search')
		const stdioRust = ledger.capabilities.find((entry) => entry.id === 'transport/stdio-rust-rmcp')

		expect(codebaseSearch?.state).toBe('rust_impl')
		expect(stdioRust?.state).toBe('rust_impl')
		expect(codebaseSearch?.promotionHold?.rejectionRef).toBe('rej-010')
		expect(stdioRust?.promotionHold?.rejectionRef).toBe('rej-010')
		expect(codebaseSearch?.proof?.status).toBe('missing')
		expect(stdioRust?.proof?.status).toBe('missing')
		expect(codebaseSearch?.differentialTest).toContain('run-coderag-differential.sh')
		expect(stdioRust?.differentialTest).toContain('run-coderag-differential.sh')
		expect(ledger.summary.rust_impl).toBe(3)
		expect(ledger.summary.authority_rust).toBe(0)
	})

	it('native packaging stages rmcp + cli binaries for npm publish', () => {
		const stageScript = readText('scripts/stage-rust-mcp.ts')
		const pkg = JSON.parse(readText('packages/mcp-server/package.json')) as {
			files: string[]
		}
		const pkgBin = readText('packages/mcp-server/bin/coderag-mcp')

		expect(stageScript).toContain('packages/mcp-server/bin/native/coderag-mcp-server')
		expect(stageScript).toContain('packages/mcp-server/bin/native/coderag-cli')
		expect(pkg.files).toContain('bin/native')
		// Package-local bin resolves staged native relative to PACKAGE_ROOT (published layout).
		expect(pkgBin).toContain('bin/native/coderag-mcp-server')
	})
})
