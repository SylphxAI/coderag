import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

export type RustSearchEnvelope = {
	status: string
	query?: string
	results?: Array<{
		path: string
		score: number
		matchedTerms: string[]
		scoreComponents?: Array<{
			term: string
			termFrequency: number
			documentFrequency: number
			idf: number
			bm25: number
		}>
		startLine?: number
		endLine?: number
		snippet?: string
		symbolName?: string
		chunkType?: string
	}>
	index?: {
		refreshMode?: string
		filesChanged?: number
		filesRemoved?: number
		filesScanned?: number
		chunksIndexed?: number
	}
	code?: string
	message?: string
}

function hostPlatformKey(): string {
	const os =
		process.platform === 'darwin'
			? 'darwin'
			: process.platform === 'linux'
				? 'linux'
				: process.platform
	const arch = process.arch === 'x64' ? 'x64' : process.arch === 'arm64' ? 'arm64' : process.arch
	return `${os}-${arch}`
}

function platformPackageDir(): string | null {
	switch (hostPlatformKey()) {
		case 'darwin-arm64':
			return 'darwin-arm64'
		case 'darwin-x64':
			return 'darwin-x64'
		case 'linux-x64':
			return 'linux-x64-gnu'
		case 'linux-arm64':
			return 'linux-arm64-gnu'
		default:
			return null
	}
}

export function resolveRustCliBinary(): string {
	const env = process.env.LOCUS_RUST_CLI
	if (env && existsSync(env)) return env

	// Prefer host-matched platform package (dev monorepo layout).
	const plat = platformPackageDir()
	if (plat) {
		const hostMatched = [
			join(here, '../npm', plat, 'locus-cli'),
			join(here, '../../mcp-server/npm', plat, 'locus-cli'),
		]
		for (const candidate of hostMatched) {
			if (existsSync(candidate)) return candidate
		}
	}

	// Staged natives next to the published package (bin/native layout).
	const staged = [
		join(here, '../bin/native/locus-cli'),
		join(here, '../../../bin/native/locus-cli'),
	]
	for (const candidate of staged) {
		if (existsSync(candidate)) return candidate
	}

	const release = join(here, '../../../target/release/locus-cli')
	if (existsSync(release)) return release

	const debug = join(here, '../../../target/debug/locus-cli')
	if (existsSync(debug)) return debug

	return 'locus-cli'
}

export function isRustCliAvailable(): boolean {
	return resolveRustCliBinary() !== 'locus-cli'
}

export function invokeRustEngine(tool: string, input: Record<string, unknown>): RustSearchEnvelope {
	const binary = resolveRustCliBinary()
	const payload = JSON.stringify({ tool, input })
	const result = spawnSync(binary, [], {
		input: payload,
		encoding: 'utf8',
		maxBuffer: 16 * 1024 * 1024,
	})

	if (result.error) {
		return {
			status: 'error',
			code: 'ENGINE_UNAVAILABLE',
			message: `${result.error.message} (resolved=${binary})`,
		}
	}

	if (result.status !== 0) {
		return {
			status: 'error',
			code: 'ENGINE_FAILED',
			message: result.stderr || `Rust engine exited with status ${result.status}`,
		}
	}

	return JSON.parse(result.stdout) as RustSearchEnvelope
}

export function shouldUseRustEngine(): boolean {
	if (process.env.CODERAG_USE_RUST_ENGINE === '0') {
		return false
	}
	if (process.env.CODERAG_USE_RUST_ENGINE === '1') {
		return true
	}
	return isRustCliAvailable()
}
