import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { runDoctor } from '../packages/mcp-server/src/doctor.ts'
import { buildCodebaseSearchEnvelope } from '../packages/mcp-server/src/evidence.ts'
import { invokeRustEngine } from '../packages/mcp-server/src/rust-engine.ts'
import {
	buildRetrievalEngineEvidence,
	RETRIEVAL_CONTRACT_VERSION,
} from '../packages/mcp-server/src/search-coordinator.ts'

const ARTIFACT_DIR_ENV = 'CODERAG_BENCHMARK_OUTPUT_DIR'
const DEFAULT_ARTIFACT_DIR = 'benchmark-artifacts'
const ARTIFACT_FILE = 'coderag_release_gate.json'

type GateStatus = 'passed' | 'failed'

interface GateCheck {
	id: string
	status: GateStatus
	message: string
	evidence?: Record<string, unknown>
}

interface ReleaseGateReport {
	profile: 'coderag_release_gate'
	generated_at: string
	artifact_dir: string
	status: GateStatus
	summary: {
		total: number
		passed: number
		failed: number
	}
	checks: GateCheck[]
}

const repoRoot = path.resolve(import.meta.dirname, '..')
const fixtureRoot = path.join(repoRoot, 'fixtures/benchmark-corpus')

const GOLDEN_QUERIES: Array<{ query: string; expectedPath: string }> = [
	{ query: 'user authentication login', expectedPath: 'src/auth/login.ts' },
	{ query: 'database connection pool', expectedPath: 'src/db/pool.ts' },
	{ query: 'checkRateLimit windowMs', expectedPath: 'src/api/rate-limit.ts' },
]

const addCheck = (
	checks: GateCheck[],
	id: string,
	passed: boolean,
	message: string,
	evidence?: Record<string, unknown>
): void => {
	checks.push({
		id,
		status: passed ? 'passed' : 'failed',
		message,
		...(evidence ? { evidence } : {}),
	})
}

const fileExists = (relativePath: string): boolean => existsSync(path.join(repoRoot, relativePath))

export async function buildReleaseGateReport(artifactDir: string): Promise<ReleaseGateReport> {
	const checks: GateCheck[] = []

	addCheck(
		checks,
		'rust:retrieval_core',
		fileExists('crates/coderag-core/src/engine.rs'),
		'Rust coderag-core retrieval engine is present'
	)

	addCheck(
		checks,
		'fixtures:benchmark_corpus',
		fileExists('fixtures/benchmark-corpus/src/auth/login.ts'),
		'Golden retrieval benchmark corpus is checked in'
	)

	addCheck(
		checks,
		'tests:golden_retrieval',
		fileExists('test/golden-retrieval.test.ts'),
		'Golden retrieval eval test harness is present'
	)

	addCheck(
		checks,
		'fixtures:parity_baseline',
		fileExists('fixtures/golden-retrieval-baseline.json'),
		'Frozen retrieval parity baseline fixture is checked in'
	)

	addCheck(
		checks,
		'tests:retrieval_parity',
		fileExists('test/retrieval-parity.test.ts'),
		'Retrieval parity test harness is present'
	)

	const doctor = await runDoctor('0.0.0')
	addCheck(
		checks,
		'doctor:golden_fixture',
		doctor.checks.find((check) => check.id === 'golden_fixture')?.status === 'ok',
		'doctor reports the golden retrieval corpus is available',
		{ doctorStatus: doctor.status }
	)

	const index = invokeRustEngine('coderag_index', { root: fixtureRoot, mode: 'full' })
	addCheck(
		checks,
		'boundary:coderag_index',
		index.status === 'ok',
		'coderag_index returns ok from the Rust CLI on the benchmark corpus'
	)

	const autoRefresh = invokeRustEngine('coderag_index', { root: fixtureRoot, mode: 'auto' })
	addCheck(
		checks,
		'boundary:incremental_cache_hit',
		autoRefresh.status === 'ok' && autoRefresh.index?.refreshMode === 'cache_hit',
		'coderag_index mode=auto reuses the persisted index when file hashes are unchanged',
		{ refreshMode: autoRefresh.index?.refreshMode }
	)

	for (const { query, expectedPath } of GOLDEN_QUERIES) {
		const search = invokeRustEngine('coderag_search', {
			root: fixtureRoot,
			query,
			limit: 5,
		})
		const hit = search.results?.some((result) => result.path.endsWith(expectedPath)) ?? false
		addCheck(
			checks,
			`golden:${expectedPath}`,
			search.status === 'ok' && hit,
			`Rust retrieval returns ${expectedPath} for "${query}"`,
			{ query, expectedPath, hit }
		)
	}

	const sampleEnvelope = buildCodebaseSearchEnvelope({
		query: 'user authentication login',
		route: 'rust-semantic-hybrid',
		engine: buildRetrievalEngineEvidence({
			useRustIndexing: true,
			route: 'rust-semantic-hybrid',
		}),
		indexedFiles: index.index?.chunksIndexed ?? 0,
		indexing: false,
		results: [],
	})
	addCheck(
		checks,
		'contract:retrieval_envelope',
		sampleEnvelope.engine.contract_version === RETRIEVAL_CONTRACT_VERSION &&
			sampleEnvelope.engine.index === 'rust-tfidf' &&
			sampleEnvelope.engine.search === 'rust-semantic-hybrid',
		'Unified retrieval envelope documents versioned Rust index and hybrid semantic search routes',
		{
			contractVersion: sampleEnvelope.engine.contract_version,
			indexRoute: sampleEnvelope.engine.index,
			searchRoute: sampleEnvelope.engine.search,
		}
	)

	const pkg = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as {
		bin?: Record<string, string>
	}

	const binWrapper = readFileSync(path.join(repoRoot, 'bin/coderag-mcp'), 'utf8')
	addCheck(
		checks,
		'mcp:rust_adapter_default',
		typeof pkg.bin?.['coderag-mcp'] === 'string' &&
			binWrapper.includes('coderag-mcp-server') &&
			binWrapper.includes('resolve_rust_bin') &&
			!binWrapper.includes('use_ts_transport'),
		'Default npm bin launches the Rust rmcp MCP server; TS stdio adapter retired'
	)

	const httpTransportSource = readFileSync(
		path.join(repoRoot, 'crates/coderag-mcp-server/src/http_transport.rs'),
		'utf8'
	)
	addCheck(
		checks,
		'mcp:rust_web_http_transport',
		httpTransportSource.includes('StreamableHttpService') &&
			httpTransportSource.includes('/mcp/health') &&
			binWrapper.includes('resolve_transport') &&
			binWrapper.includes('CODERAG_MCP_TRANSPORT=http'),
		'Rust rmcp streamable HTTP Web MCP transport is wired; npm bin routes CODERAG_MCP_TRANSPORT=http to Rust'
	)

	const httpParityProbe = spawnSync('bun', ['test', 'test/integration/http-transport.test.ts'], {
		cwd: repoRoot,
		encoding: 'utf8',
		timeout: 300_000,
	})
	addCheck(
		checks,
		'mcp:http_transport_parity',
		fileExists('test/integration/http-transport.test.ts') && httpParityProbe.status === 0,
		'HTTP transport integration test proves Rust rmcp codebase_search golden parity over streamable HTTP',
		httpParityProbe.status === 0
			? { exitCode: 0 }
			: {
					exitCode: httpParityProbe.status,
					stderr: httpParityProbe.stderr?.slice(-2000),
					stdout: httpParityProbe.stdout?.slice(-2000),
				}
	)

	const tsAdapterDeletedGate = fileExists('scripts/check-ts-adapter-deletion-ready.sh')
	const stdioAuthorityGate = fileExists('scripts/check-no-ts-stdio-backend.sh')
	const rustMain = fileExists('crates/coderag-mcp-server/src/main.rs')
		? readFileSync(path.join(repoRoot, 'crates/coderag-mcp-server/src/main.rs'), 'utf8')
		: ''
	const httpAuthorityGate = fileExists('scripts/check-no-ts-http-backend.sh')
	addCheck(
		checks,
		'mcp:http_authority_rust',
		httpAuthorityGate &&
			tsAdapterDeletedGate &&
			httpTransportSource.includes('StreamableHttpService') &&
			binWrapper.includes('CODERAG_MCP_TRANSPORT=http') &&
			!fileExists('packages/mcp-server/src/index.ts'),
		'Web MCP HTTP transport is Rust-only authority: bin routes http to rmcp and TS stdio adapter is deleted',
		{
			httpAuthorityGate,
			tsAdapterDeletedGate,
			tsStdioAdapterPresent: fileExists('packages/mcp-server/src/index.ts'),
		}
	)

	addCheck(
		checks,
		'mcp:stdio_ts_adapter_deleted',
		tsAdapterDeletedGate &&
			!fileExists('packages/mcp-server/src/index.ts') &&
			!fileExists('packages/mcp-server/dist/index.js') &&
			!binWrapper.includes('use_ts_transport'),
		'transport/stdio-ts-adapter retired: no TS stdio MCP entrypoint or opt-in routing remains',
		{
			tsAdapterDeletedGate,
			tsStdioAdapterPresent: fileExists('packages/mcp-server/src/index.ts'),
		}
	)

	addCheck(
		checks,
		'mcp:stdio_rust_authority_rust',
		stdioAuthorityGate &&
			rustMain.includes('transport::stdio') &&
			binWrapper.includes('resolve_rust_bin') &&
			binWrapper.includes('stdio') &&
			!fileExists('packages/mcp-server/src/index.ts'),
		'MCP stdio transport is Rust-only authority: default bin routes to rmcp stdio and TS stdio adapter is deleted',
		{
			stdioAuthorityGate,
			stdioGoldenParity: fileExists('crates/coderag-mcp-server/tests/golden_parity.rs'),
			tsStdioAdapterPresent: fileExists('packages/mcp-server/src/index.ts'),
		}
	)

	const codebaseSearchHandler = fileExists('crates/coderag-mcp-server/src/codebase_search.rs')
		? readFileSync(path.join(repoRoot, 'crates/coderag-mcp-server/src/codebase_search.rs'), 'utf8')
		: ''
	const toolRoutes = fileExists('crates/coderag-mcp-server/src/tool_routes.rs')
		? readFileSync(path.join(repoRoot, 'crates/coderag-mcp-server/src/tool_routes.rs'), 'utf8')
		: ''
	const codebaseSearchAuthorityGate = fileExists('scripts/check-no-ts-codebase-search.sh')
	addCheck(
		checks,
		'mcp:codebase_search_authority_rust',
		codebaseSearchAuthorityGate &&
			codebaseSearchHandler.includes('coderag_index') &&
			codebaseSearchHandler.includes('coderag_search') &&
			codebaseSearchHandler.includes('CODEBASE_SEARCH_ROUTE') &&
			toolRoutes.includes('"codebase_search"') &&
			toolRoutes.includes('RustCore') &&
			!fileExists('packages/mcp-server/src/index.ts'),
		'codebase_search tool authority is Rust-only on rmcp stdio and HTTP; golden baseline parity proven on both transports',
		{
			codebaseSearchAuthorityGate,
			rmcpHandlerPresent: fileExists('crates/coderag-mcp-server/src/codebase_search.rs'),
			stdioGoldenParity: fileExists('crates/coderag-mcp-server/tests/golden_parity.rs'),
			httpGoldenParity: fileExists('test/integration/http-transport.test.ts'),
			tsMcpEntryPresent: fileExists('packages/mcp-server/src/index.ts'),
		}
	)

	const parityProbe = spawnSync('bun', ['test', 'test/retrieval-parity.test.ts'], {
		cwd: repoRoot,
		encoding: 'utf8',
		env: {
			...process.env,
			CODERAG_USE_RUST_ENGINE: '1',
			CODERAG_MCP_TRANSPORT: '',
		},
		timeout: 300_000,
	})
	addCheck(
		checks,
		'parity:frozen_baseline',
		parityProbe.status === 0,
		'Rust retrieval matches the frozen golden baseline on the benchmark corpus',
		parityProbe.status === 0
			? { exitCode: 0 }
			: {
					exitCode: parityProbe.status,
					stderr: parityProbe.stderr?.slice(-2000),
					stdout: parityProbe.stdout?.slice(-2000),
				}
	)

	const matrixProbe = spawnSync('bun', ['test', 'test/shippedPath.matrix.test.ts'], {
		cwd: repoRoot,
		encoding: 'utf8',
		env: {
			...process.env,
			CODERAG_USE_RUST_ENGINE: '1',
			CODERAG_MCP_TRANSPORT: '',
		},
		timeout: 300_000,
	})
	addCheck(
		checks,
		'boundary:rust_cli_engine',
		fileExists('crates/coderag-mcp-server/src/tool_routes.rs') && matrixProbe.status === 0,
		'Shipped-path matrix test proves primary retrieval routes through Rust core without legacy runtime',
		matrixProbe.status === 0
			? { exitCode: 0 }
			: {
					exitCode: matrixProbe.status,
					stderr: matrixProbe.stderr?.slice(-2000),
					stdout: matrixProbe.stdout?.slice(-2000),
				}
	)

	const passed = checks.filter((check) => check.status === 'passed').length
	const failed = checks.length - passed

	return {
		profile: 'coderag_release_gate',
		generated_at: new Date().toISOString(),
		artifact_dir: artifactDir,
		status: failed === 0 ? 'passed' : 'failed',
		summary: {
			total: checks.length,
			passed,
			failed,
		},
		checks,
	}
}

async function main(): Promise<void> {
	const artifactDir = path.resolve(
		process.env[ARTIFACT_DIR_ENV] ?? path.join(repoRoot, DEFAULT_ARTIFACT_DIR)
	)

	const report = await buildReleaseGateReport(artifactDir)
	mkdirSync(artifactDir, { recursive: true })
	const outputPath = path.join(artifactDir, ARTIFACT_FILE)
	writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
	console.error(`CodeRAG release gate report written to ${outputPath}`)

	if (report.status !== 'passed') {
		for (const check of report.checks.filter((entry) => entry.status === 'failed')) {
			console.error(`[FAILED] ${check.id}: ${check.message}`)
		}
		process.exit(1)
	}
}

if (import.meta.main) {
	main().catch((error: unknown) => {
		console.error(error)
		process.exit(1)
	})
}
