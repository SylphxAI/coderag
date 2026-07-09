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
	}>
	index?: {
		refreshMode?: string
		filesChanged?: number
		filesRemoved?: number
	}
	code?: string
	message?: string
}

export function resolveRustCliBinary(): string {
	const env = process.env.CODERAG_RUST_CLI
	if (env && existsSync(env)) return env

	const release = join(here, '../../../target/release/coderag-cli')
	if (existsSync(release)) return release

	const debug = join(here, '../../../target/debug/coderag-cli')
	if (existsSync(debug)) return debug

	return 'coderag-cli'
}

export function isRustCliAvailable(): boolean {
	return resolveRustCliBinary() !== 'coderag-cli'
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
			message: result.error.message,
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
