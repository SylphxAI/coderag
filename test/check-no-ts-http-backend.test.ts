import { expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const repoRoot = path.resolve(import.meta.dirname, '..')

const readText = (relativePath: string): string => readFileSync(path.join(repoRoot, relativePath), 'utf8')

test('check-no-ts-http-backend gate script exists and enforces Rust HTTP authority', () => {
	const script = readText('scripts/check-no-ts-http-backend.sh')

	expect(script).toContain('check-no-ts-http-backend')
	expect(script).toContain('resolve_rust_bin')
	expect(script).toContain('CODERAG_MCP_TRANSPORT=http')
	expect(script).toContain('StreamableHttpService')
	expect(script).toContain('packages/mcp-server/src/index.ts must be deleted')
	expect(existsSync(path.join(repoRoot, 'test/integration/http-transport.test.ts'))).toBe(true)
})

test('npm bin routes HTTP to Rust rmcp without TS stdio adapter', () => {
	const bin = readText('bin/coderag-mcp')
	const httpTransport = readText('crates/coderag-mcp-server/src/http_transport.rs')

	expect(bin).toContain('resolve_rust_bin')
	expect(bin).toContain('CODERAG_MCP_TRANSPORT=http')
	expect(bin).not.toContain('use_ts_transport')
	expect(bin).not.toMatch(/exec node/i)
	expect(existsSync(path.join(repoRoot, 'packages/mcp-server/src/index.ts'))).toBe(false)

	expect(httpTransport).toContain('StreamableHttpService')
	expect(httpTransport).toContain('health_check')
})

test('migration ledger marks transport/web-mcp-http as ts_deleted (tick023 admission)', () => {
	const ledger = JSON.parse(readText('docs/specs/coderag-migration-ledger.json')) as {
		capabilities: Array<{ id: string; state: string; proof?: { status: string } }>
		summary: { ts_deleted: number; completion_progress: number }
	}

	const http = ledger.capabilities.find((capability) => capability.id === 'transport/web-mcp-http')
	const admittedProof = new Set(['missing', 'stale', 'differential_green', 'canary_green', 'caught_up'])
	expect(http?.state).toBe('ts_deleted')
	expect(admittedProof.has(http?.proof?.status ?? '')).toBe(true)
	expect(http?.proof?.status).toBe('canary_green')
	expect(ledger.summary.ts_deleted).toBe(4)
	expect(ledger.summary.completion_progress).toBe(1.0)
})
