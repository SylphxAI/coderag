import { beforeAll, describe, expect, it } from 'bun:test'
import { execSync, spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const repoRoot = path.resolve(import.meta.dirname, '..')
const rustCliBin = path.join(repoRoot, 'target/release/coderag-cli')
const fixtureRoot = path.join(repoRoot, 'fixtures/benchmark-corpus')

type CliEnvelope = {
	status?: string
	query?: string
	results?: Array<{ path?: string; score?: number }>
	index?: { refreshMode?: string; chunksIndexed?: number }
	search?: { route?: string }
	code?: string
	message?: string
}

const invokeCli = (tool: string, input: Record<string, unknown>, env: NodeJS.ProcessEnv) => {
	const probe = spawnSync(rustCliBin, [], {
		cwd: repoRoot,
		encoding: 'utf8',
		env,
		input: JSON.stringify({ tool, input }),
		timeout: 60_000,
	})
	expect(probe.status).toBe(0)
	return JSON.parse(probe.stdout) as CliEnvelope
}

describe('shipped path matrix (Rust core, no legacy flags)', () => {
	let fakeNodeEnv: NodeJS.ProcessEnv
	let nodeInvokeLog: string

	beforeAll(() => {
		execSync('cargo build --release -p coderag-core -p coderag-cli -p coderag-mcp-server', {
			cwd: repoRoot,
			stdio: 'pipe',
			timeout: 300_000,
		})

		const probeDir = mkdtempSync(path.join(os.tmpdir(), 'coderag-matrix-probe-'))
		nodeInvokeLog = path.join(probeDir, 'node-invoke.log')
		const fakeNode = path.join(probeDir, 'node')
		writeFileSync(fakeNode, `#!/usr/bin/env bash\nprintf '%s\\n' "$@" >> "${nodeInvokeLog}"\nexit 99\n`)
		chmodSync(fakeNode, 0o755)

		fakeNodeEnv = {
			...process.env,
			CODERAG_NODE: fakeNode,
			CODERAG_USE_RUST_ENGINE: '1',
			CODERAG_MCP_TRANSPORT: '',
		}
	}, 300_000)

	it('coderag_index routes through coderag-core without legacy runtime', () => {
		const envelope = invokeCli('coderag_index', { root: fixtureRoot, mode: 'full' }, fakeNodeEnv)
		expect(envelope.status).toBe('ok')
		expect((envelope.index?.chunksIndexed ?? 0) > 0).toBe(true)
		expect(existsSync(nodeInvokeLog)).toBe(false)
	})

	it('coderag_search returns rust-tfidf hits without legacy runtime', () => {
		invokeCli('coderag_index', { root: fixtureRoot, mode: 'auto' }, fakeNodeEnv)
		const envelope = invokeCli(
			'coderag_search',
			{ root: fixtureRoot, query: 'user authentication login', limit: 5 },
			fakeNodeEnv
		)
		expect(envelope.status).toBe('ok')
		expect(envelope.search?.route).toBe('rust-tfidf')
		expect((envelope.results?.length ?? 0) > 0).toBe(true)
		expect(envelope.results?.some((hit) => hit.path?.includes('auth/login'))).toBe(true)
		expect(existsSync(nodeInvokeLog)).toBe(false)
	})

	it('default bin resolves staged rmcp server', () => {
		const bin = path.join(repoRoot, 'bin/coderag-mcp')
		expect(existsSync(bin)).toBe(true)
		const staged = path.join(repoRoot, 'bin/native/coderag-mcp-server')
		expect(existsSync(staged)).toBe(true)
	})
})

describe('web MCP HTTP transport routing', () => {
	it('bin wrapper routes CODERAG_MCP_TRANSPORT=http to Rust rmcp server', () => {
		const bin = readFileSync(path.join(repoRoot, 'bin/coderag-mcp'), 'utf8')
		expect(bin).toContain('resolve_transport')
		expect(bin).toContain('MCP_TRANSPORT=http')
		expect(bin).toContain('CODERAG_MCP_TRANSPORT=http')
	})

	it('Rust MCP server exposes streamable HTTP transport module', () => {
		const httpTransport = readFileSync(path.join(repoRoot, 'crates/coderag-mcp-server/src/http_transport.rs'), 'utf8')
		const mainRs = readFileSync(path.join(repoRoot, 'crates/coderag-mcp-server/src/main.rs'), 'utf8')
		expect(httpTransport).toContain('StreamableHttpService')
		expect(httpTransport).toContain('health_check')
		expect(mainRs).toContain('http_transport::serve_http')
	})
})
