#!/usr/bin/env bun
/**
 * TS baseline oracle for coderag codebase_search + stdio transport differential parity.
 *
 * Executes the frozen golden-retrieval-baseline contract via the TS rust-engine bridge
 * (invokeRustEngine → coderag-cli). Emits canonical JSON consumed by
 * `crates/coderag-mcp-server/tests/stdio_codebase_search_differential.rs`.
 *
 * Fail-closed: requires built coderag-cli (no SKIP-as-pass).
 */
import { createHash } from 'node:crypto'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { invokeRustEngine } from '../../packages/mcp-server/src/rust-engine.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '../..')
const BASELINE_PATH = join(REPO_ROOT, 'fixtures/golden-retrieval-baseline.json')

type ParityCase = {
	id: string
	query: string
	expectedTopPath: string
	expectedPaths: string[]
	minResults: number
}

type ParityBaseline = {
	schemaVersion: number
	profile: string
	capturedFrom: string
	corpusRoot: string
	route: string
	cases: ParityCase[]
}

export interface DifferentialCase {
	readonly id: string
	readonly slice: 'tool/codebase_search' | 'transport/stdio-rust-rmcp' | 'transport/web-mcp-http'
	readonly domain: 'codebase_search'
	readonly input: {
		root: string
		query: string
		limit: number
	}
	readonly output: {
		status: string
		route: string
		paths: string[]
		minResults: number
	}
}

export interface DifferentialCorpus {
	readonly corpusVersion: number
	readonly fixtureCorpusHash: string
	readonly profile: string
	readonly route: string
	readonly corpusRoot: string
	readonly cases: readonly DifferentialCase[]
}

function fixtureCorpusHash(raw: string): string {
	return createHash('sha256').update(raw).digest('hex')
}

function ensureRustCliBuilt(): void {
	execSync('cargo build -q --release -p coderag-core -p coderag-cli -p coderag-mcp-server', {
		cwd: REPO_ROOT,
		stdio: 'pipe',
		timeout: 300_000,
	})
}

function main(): void {
	const baselineRaw = readFileSync(BASELINE_PATH, 'utf8')
	const baseline = JSON.parse(baselineRaw) as ParityBaseline

	if (baseline.schemaVersion !== 1) {
		throw new Error(`unsupported baseline schemaVersion: ${baseline.schemaVersion}`)
	}

	ensureRustCliBuilt()

	const fixtureRoot = join(REPO_ROOT, baseline.corpusRoot)
	const index = invokeRustEngine('coderag_index', { root: fixtureRoot, mode: 'full' })
	if (index.status !== 'ok') {
		throw new Error(`coderag_index failed: ${index.message ?? index.code ?? 'unknown'}`)
	}

	const slices = [
		'tool/codebase_search',
		'transport/stdio-rust-rmcp',
		'transport/web-mcp-http',
	] as const
	const cases: DifferentialCase[] = []

	for (const parityCase of baseline.cases) {
		const search = invokeRustEngine('coderag_search', {
			root: fixtureRoot,
			query: parityCase.query,
			limit: 5,
		})

		if (search.status !== 'ok') {
			throw new Error(
				`${parityCase.id}: coderag_search failed: ${search.message ?? search.code ?? 'unknown'}`
			)
		}

		const paths = (search.results ?? []).map((hit) => hit.path)
		if (paths.length < parityCase.minResults) {
			throw new Error(
				`${parityCase.id}: expected >= ${parityCase.minResults} results, got ${paths.length}`
			)
		}
		if (paths[0] !== parityCase.expectedTopPath) {
			throw new Error(
				`${parityCase.id}: top path ${paths[0]} !== frozen ${parityCase.expectedTopPath}`
			)
		}
		if (JSON.stringify(paths) !== JSON.stringify(parityCase.expectedPaths)) {
			throw new Error(
				`${parityCase.id}: ranked paths drifted from frozen baseline\noracle: ${JSON.stringify(paths)}\nfrozen: ${JSON.stringify(parityCase.expectedPaths)}`
			)
		}

		const shared = {
			id: parityCase.id,
			domain: 'codebase_search' as const,
			input: {
				root: fixtureRoot,
				query: parityCase.query,
				limit: 5,
			},
			output: {
				status: search.status,
				route: search.search?.route ?? baseline.route,
				paths,
				minResults: parityCase.minResults,
			},
		}

		for (const slice of slices) {
			cases.push({ ...shared, slice })
		}
	}

	const corpus: DifferentialCorpus = {
		corpusVersion: 1,
		fixtureCorpusHash: fixtureCorpusHash(baselineRaw),
		profile: baseline.profile,
		route: baseline.route,
		corpusRoot: baseline.corpusRoot,
		cases,
	}

	process.stdout.write(`${JSON.stringify(corpus)}\n`)
}

main()
