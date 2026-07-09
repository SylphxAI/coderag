import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { runDoctor } from '../packages/mcp-server/src/doctor.ts'
import { invokeRustEngine } from '../packages/mcp-server/src/rust-engine.ts'

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

	const doctor = await runDoctor('0.0.0')
	addCheck(
		checks,
		'doctor:golden_fixture',
		doctor.checks.find((check) => check.id === 'golden_fixture')?.status === 'ok',
		'doctor reports the golden retrieval corpus is available',
		{ doctorStatus: doctor.status }
	)

	const index = invokeRustEngine('coderag_index', { root: fixtureRoot })
	addCheck(
		checks,
		'boundary:coderag_index',
		index.status === 'ok',
		'coderag_index returns ok from the Rust CLI on the benchmark corpus'
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
