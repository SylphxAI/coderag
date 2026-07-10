/**
 * Integration test for coderag MCP server with HTTP transport (Rust rmcp).
 * Proves codebase_search golden baseline parity over streamable HTTP.
 */

import { type ChildProcess, execSync, spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'

const repoRoot = path.resolve(import.meta.dirname, '../..')
const binWrapper = path.join(repoRoot, 'bin/coderag-mcp')
const rustCliBin = path.join(repoRoot, 'target/release/coderag-cli')
const fixtureRoot = path.join(repoRoot, 'fixtures/benchmark-corpus')
const baselinePath = path.join(repoRoot, 'fixtures/golden-retrieval-baseline.json')
const RUST_HTTP_READY = 'Streamable HTTP MCP listening on http://'

const TEST_HOST = '127.0.0.1'
let baseUrl: string

type GoldenBaselineCase = {
	id: string
	query: string
	expectedTopPath: string
	expectedPaths: string[]
	minResults: number
}

type GoldenBaseline = {
	schemaVersion: number
	profile: string
	route: string
	cases: GoldenBaselineCase[]
}

const goldenBaseline = JSON.parse(readFileSync(baselinePath, 'utf8')) as GoldenBaseline

const getFreePort = async (): Promise<number> =>
	new Promise((resolve, reject) => {
		const server = net.createServer()
		server.unref()
		server.once('error', reject)
		server.listen(0, TEST_HOST, () => {
			const address = server.address()
			server.close(() => {
				if (typeof address === 'object' && address) {
					resolve(address.port)
				} else {
					reject(new Error('Failed to allocate a test HTTP port'))
				}
			})
		})
	})

const streamableHttpHeaders = {
	'Content-Type': 'application/json',
	Accept: 'application/json, text/event-stream',
}

const parseMcpResponse = async (response: Response) => {
	const contentType = response.headers.get('content-type') ?? ''
	const body = await response.text()

	if (contentType.includes('application/json')) {
		return JSON.parse(body) as Record<string, unknown>
	}

	const dataLines = body
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line.startsWith('data:'))
		.map((line) => line.slice('data:'.length).trim())
		.filter((line) => line.length > 0)

	const payload = dataLines.at(-1)
	if (!payload) {
		throw new SyntaxError(`No MCP JSON payload in streamable HTTP response: ${body.slice(0, 200)}`)
	}
	return JSON.parse(payload) as Record<string, unknown>
}

const createMcpHttpClient = () => {
	let sessionHeaders: Record<string, string> = { ...streamableHttpHeaders }

	const postMcp = async (body: Record<string, unknown>) => {
		const response = await fetch(baseUrl, {
			method: 'POST',
			headers: sessionHeaders,
			body: JSON.stringify(body),
		})
		const sessionId = response.headers.get('mcp-session-id')
		if (sessionId) {
			sessionHeaders = { ...sessionHeaders, 'mcp-session-id': sessionId }
		}
		return response
	}

	const sendRequest = async (method: string, params?: unknown, id = 1) => {
		const response = await postMcp({
			jsonrpc: '2.0',
			id,
			method,
			params,
		})
		return parseMcpResponse(response)
	}

	const sendNotification = async (method: string, params?: unknown) => {
		await postMcp({
			jsonrpc: '2.0',
			method,
			params,
		})
	}

	const initializeSession = async () => {
		await sendRequest('initialize', {
			protocolVersion: '2024-11-05',
			capabilities: {},
			clientInfo: { name: 'test-http-client', version: '1.0.0' },
		})
		await sendNotification('notifications/initialized')
	}

	return { sendRequest, sendNotification, initializeSession }
}

const waitForRustHttpServer = (serverProc: ChildProcess) =>
	new Promise<void>((resolve, reject) => {
		const timeout = setTimeout(() => {
			reject(new Error('Rust HTTP MCP server startup timeout'))
		}, 30_000)

		const onReady = (output: string) => {
			if (output.includes(RUST_HTTP_READY)) {
				clearTimeout(timeout)
				setTimeout(resolve, 200)
			}
		}

		serverProc.stdout?.on('data', (data) => onReady(data.toString()))
		serverProc.stderr?.on('data', (data) => onReady(data.toString()))
	})

describe('MCP Server HTTP Transport Integration (Rust rmcp)', () => {
	let serverProc: ChildProcess

	beforeAll(async () => {
		execSync('cargo build --release -p coderag-core -p coderag-cli -p coderag-mcp-server', {
			cwd: repoRoot,
			stdio: 'pipe',
			timeout: 300_000,
		})

		const testPort = await getFreePort()
		baseUrl = `http://${TEST_HOST}:${String(testPort)}/mcp`
		serverProc = spawn(binWrapper, [], {
			stdio: ['pipe', 'pipe', 'pipe'],
			env: {
				...process.env,
				CODERAG_MCP_TRANSPORT: 'http',
				MCP_HTTP_PORT: testPort.toString(),
				MCP_HTTP_HOST: TEST_HOST,
				CODERAG_RUST_CLI: rustCliBin,
			},
		})

		await waitForRustHttpServer(serverProc)
	}, 300_000)

	afterAll(() => {
		serverProc?.kill('SIGTERM')
	})

	it('should respond to health check', async () => {
		const response = await fetch(`${baseUrl}/health`)
		expect(response.ok).toBe(true)
		const data = (await response.json()) as { status?: string }
		expect(data.status).toBe('ok')
	})

	it('should respond to initialize request over HTTP', async () => {
		const client = createMcpHttpClient()
		const response = await client.sendRequest('initialize', {
			protocolVersion: '2024-11-05',
			capabilities: {},
			clientInfo: { name: 'test-http-client', version: '1.0.0' },
		})

		expect(response.id).toBe(1)
		const serverInfo = (response.result as { serverInfo?: { name?: string } })?.serverInfo
		expect(serverInfo?.name).toBe('coderag-mcp')
	})

	it('should list codebase_search tool over HTTP', async () => {
		const client = createMcpHttpClient()
		await client.initializeSession()

		const response = await client.sendRequest('tools/list', {}, 2)

		expect(response.id).toBe(2)
		const tools = (response.result as { tools?: Array<{ name: string }> })?.tools
		expect(tools).toBeDefined()
		const toolNames = tools?.map((tool) => tool.name) ?? []
		expect(toolNames).toContain('codebase_search')
	})

	it('loads the frozen golden retrieval baseline fixture', () => {
		expect(goldenBaseline.schemaVersion).toBe(1)
		expect(goldenBaseline.profile).toBe('coderag-retrieval-parity-v1')
		expect(goldenBaseline.route).toBe('rust-tfidf')
		expect(goldenBaseline.cases.length).toBeGreaterThanOrEqual(3)
	})

	for (const parityCase of goldenBaseline.cases) {
		it(`codebase_search golden parity over HTTP: ${parityCase.id}`, async () => {
			const client = createMcpHttpClient()
			await client.initializeSession()

			const response = await client.sendRequest(
				'tools/call',
				{
					name: 'codebase_search',
					arguments: {
						root: fixtureRoot,
						query: parityCase.query,
						limit: 5,
					},
				},
				3
			)

			expect(response.id).toBe(3)
			const result = response.result as {
				isError?: boolean
				structuredContent?: {
					status?: string
					route?: string
					results?: Array<{ path?: string }>
				}
			}
			expect(result?.isError).not.toBe(true)
			expect(result?.structuredContent?.status).toBe('ok')
			expect(result?.structuredContent?.route).toBe(goldenBaseline.route)

			const results = result?.structuredContent?.results ?? []
			expect(results.length).toBeGreaterThanOrEqual(parityCase.minResults)

			const relativePaths = results.map((hit) => {
				const hitPath = hit.path ?? ''
				const rootPrefix = `${fixtureRoot}/`
				return hitPath.startsWith(rootPrefix) ? hitPath.slice(rootPrefix.length) : hitPath
			})
			expect(relativePaths[0]).toBe(parityCase.expectedTopPath)
			expect(relativePaths).toEqual(parityCase.expectedPaths)
		})
	}
})

describe('MCP Server HTTP Transport Authentication (Rust rmcp)', () => {
	const API_KEY = 'test-secret-key-123'
	let serverProc: ChildProcess
	let authBaseUrl: string

	beforeAll(async () => {
		execSync('cargo build --release -p coderag-mcp-server', {
			cwd: repoRoot,
			stdio: 'pipe',
			timeout: 300_000,
		})

		const testPort = await getFreePort()
		authBaseUrl = `http://${TEST_HOST}:${String(testPort)}/mcp`
		serverProc = spawn(binWrapper, [], {
			stdio: ['pipe', 'pipe', 'pipe'],
			env: {
				...process.env,
				CODERAG_MCP_TRANSPORT: 'http',
				MCP_HTTP_PORT: testPort.toString(),
				MCP_HTTP_HOST: TEST_HOST,
				MCP_API_KEY: API_KEY,
				CODERAG_RUST_CLI: rustCliBin,
			},
		})

		await waitForRustHttpServer(serverProc)
	}, 300_000)

	afterAll(() => {
		serverProc?.kill('SIGTERM')
	})

	const initialize = (headers: Record<string, string>) =>
		fetch(authBaseUrl, {
			method: 'POST',
			headers: { ...streamableHttpHeaders, ...headers },
			body: JSON.stringify({
				jsonrpc: '2.0',
				id: 1,
				method: 'initialize',
				params: {
					protocolVersion: '2024-11-05',
					capabilities: {},
					clientInfo: { name: 'auth-test-client', version: '1.0.0' },
				},
			}),
		})

	it('rejects requests with no X-API-Key header (401)', async () => {
		const response = await initialize({})
		expect(response.status).toBe(401)
		const data = (await response.json()) as { error?: { message?: string } }
		expect(data.error?.message).toContain('X-API-Key')
	})

	it('accepts requests carrying the correct X-API-Key', async () => {
		const response = await initialize({ 'X-API-Key': API_KEY })
		expect(response.status).toBe(200)
		const data = await parseMcpResponse(response)
		const serverInfo = (data.result as { serverInfo?: { name?: string } })?.serverInfo
		expect(serverInfo?.name).toBe('coderag-mcp')
	})

	it('keeps the health endpoint open without a key', async () => {
		const response = await fetch(`${authBaseUrl}/health`)
		expect(response.ok).toBe(true)
		const data = (await response.json()) as { status?: string }
		expect(data.status).toBe('ok')
	})
})
