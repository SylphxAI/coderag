import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveRustCliBinary } from './rust-engine.js'

const here = dirname(fileURLToPath(import.meta.url))

export type DoctorStatus = 'ok' | 'warn' | 'fail'

export interface DoctorCheck {
	id: string
	status: DoctorStatus
	message: string
}

export interface DoctorReport {
	profile: 'coderag_doctor'
	version: string
	status: 'ready' | 'degraded' | 'unavailable'
	checks: DoctorCheck[]
}

const probeRustCore = (): DoctorCheck => {
	const corePath = join(here, '../../../crates/coderag-core/src/lib.rs')
	if (existsSync(corePath)) {
		return {
			id: 'rust_core',
			status: 'ok',
			message: 'coderag-core Rust retrieval engine sources are present.',
		}
	}

	return {
		id: 'rust_core',
		status: 'fail',
		message: 'Missing crates/coderag-core/src/lib.rs.',
	}
}

const probeCliBinary = (): DoctorCheck => {
	const binary = resolveRustCliBinary()
	if (binary !== 'coderag-cli' && existsSync(binary)) {
		return {
			id: 'cli_binary',
			status: 'ok',
			message: `Rust CLI is available at ${binary}.`,
		}
	}

	return {
		id: 'cli_binary',
		status: 'warn',
		message:
			'Rust CLI binary is not built. Run `cargo build --release` to enable the default native retrieval path.',
	}
}

const probeGoldenEvalFixture = (): DoctorCheck => {
	const fixture = join(here, '../../../fixtures/benchmark-corpus/src/auth/login.ts')
	if (existsSync(fixture)) {
		return {
			id: 'golden_fixture',
			status: 'ok',
			message: 'Golden retrieval benchmark corpus is available.',
		}
	}

	return {
		id: 'golden_fixture',
		status: 'fail',
		message: 'Missing fixtures/benchmark-corpus for retrieval eval gates.',
	}
}

const probeRustEngineFlag = (): DoctorCheck => {
	if (process.env.CODERAG_USE_RUST_ENGINE === '0') {
		return {
			id: 'rust_engine_flag',
			status: 'warn',
			message: 'CODERAG_USE_RUST_ENGINE=0 forces the TypeScript indexer adapter path.',
		}
	}

	if (process.env.CODERAG_USE_RUST_ENGINE === '1') {
		return {
			id: 'rust_engine_flag',
			status: 'ok',
			message: 'CODERAG_USE_RUST_ENGINE=1 routes retrieval through the Rust core.',
		}
	}

	const binary = resolveRustCliBinary()
	if (binary !== 'coderag-cli' && existsSync(binary)) {
		return {
			id: 'rust_engine_flag',
			status: 'ok',
			message: 'Rust CLI is built; keyword retrieval defaults to the Rust core.',
		}
	}

	return {
		id: 'rust_engine_flag',
		status: 'warn',
		message:
			'Rust CLI is not built. The TypeScript indexer remains the default adapter path until `cargo build --release`.',
	}
}

export async function runDoctor(version: string): Promise<DoctorReport> {
	const checks = [
		probeRustCore(),
		probeCliBinary(),
		probeGoldenEvalFixture(),
		probeRustEngineFlag(),
	]
	const hasFail = checks.some((check) => check.status === 'fail')
	const hasWarn = checks.some((check) => check.status === 'warn')

	return {
		profile: 'coderag_doctor',
		version,
		status: hasFail ? 'unavailable' : hasWarn ? 'degraded' : 'ready',
		checks,
	}
}

if (import.meta.main) {
	const pkg = JSON.parse(readFileSync(join(here, '../package.json'), 'utf8')) as { version: string }
	const report = await runDoctor(pkg.version)
	console.log(JSON.stringify(report, null, 2))
	process.exit(report.status === 'unavailable' ? 1 : 0)
}
