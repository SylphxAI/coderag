import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const repoRoot = path.resolve(import.meta.dirname, '..')

describe('MCP stdio transport routing', () => {
	it('bin wrapper defaults to Rust rmcp stdio server', () => {
		const bin = readFileSync(path.join(repoRoot, 'bin/coderag-mcp'), 'utf8')
		const pkgBin = readFileSync(path.join(repoRoot, 'packages/mcp-server/bin/coderag-mcp'), 'utf8')

		for (const wrapper of [bin, pkgBin]) {
			expect(wrapper).toContain('resolve_rust_bin')
			expect(wrapper).toContain('resolve_transport')
			expect(wrapper).toContain('stdio')
			expect(wrapper).not.toContain('use_ts_transport')
		}
	})

	it('Rust MCP server exposes rmcp stdio transport', () => {
		const mainRs = readFileSync(path.join(repoRoot, 'crates/coderag-mcp-server/src/main.rs'), 'utf8')
		expect(mainRs).toContain('transport::stdio')
		expect(mainRs).toContain('http_transport::transport_from_env')
	})

	it('migration ledger marks transport/stdio-rust-rmcp as rust_impl (rej-010)', () => {
		const ledger = JSON.parse(
			readFileSync(path.join(repoRoot, 'docs/specs/coderag-migration-ledger.json'), 'utf8')
		) as {
			capabilities: Array<{ id: string; state: string; proof?: { status: string } }>
		}
		const stdioRust = ledger.capabilities.find((cap) => cap.id === 'transport/stdio-rust-rmcp')
		expect(stdioRust?.state).toBe('rust_impl')
		expect(stdioRust?.proof?.status).toBe('missing')
	})

	it('stdio authority gate script exists', () => {
		const script = readFileSync(path.join(repoRoot, 'scripts/check-no-ts-stdio-backend.sh'), 'utf8')
		expect(script).toContain('rust_impl')
		expect(script).toContain('transport::stdio')
	})
})
