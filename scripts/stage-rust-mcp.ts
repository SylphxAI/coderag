import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const repoRoot = path.resolve(import.meta.dirname, '..')

type StagedBinary = {
	readonly name: string
	readonly source: string
	readonly targets: readonly string[]
}

function hostPlatformDir(): string | null {
	const platform = os.platform()
	const arch = os.arch()
	if (platform === 'darwin' && arch === 'arm64') return 'darwin-arm64'
	if (platform === 'darwin' && arch === 'x64') return 'darwin-x64'
	if (platform === 'linux' && arch === 'x64') return 'linux-x64-gnu'
	if (platform === 'linux' && arch === 'arm64') return 'linux-arm64-gnu'
	return null
}

const binaries: readonly StagedBinary[] = [
	{
		name: 'coderag-mcp-server',
		source: path.join(repoRoot, 'target/release/coderag-mcp-server'),
		targets: [
			path.join(repoRoot, 'bin/native/coderag-mcp-server'),
			path.join(repoRoot, 'packages/mcp-server/bin/native/coderag-mcp-server'),
		],
	},
	{
		name: 'coderag-cli',
		source: path.join(repoRoot, 'target/release/coderag-cli'),
		targets: [
			path.join(repoRoot, 'bin/native/coderag-cli'),
			path.join(repoRoot, 'packages/mcp-server/bin/native/coderag-cli'),
		],
	},
]

for (const binary of binaries) {
	if (!fs.existsSync(binary.source)) {
		console.error(
			`[stage-rust-mcp] Missing release binary at ${binary.source}. Run: bun run build:rust`
		)
		process.exit(1)
	}

	for (const target of binary.targets) {
		fs.mkdirSync(path.dirname(target), { recursive: true })
		fs.copyFileSync(binary.source, target)
		fs.chmodSync(target, 0o755)
		console.log(`[stage-rust-mcp] Staged ${target}`)
	}

	// Stage both natives into the host platform optionalDependency package so
	// local install/layout matches the published multi-arch consumer path.
	const platformDir = hostPlatformDir()
	if (platformDir) {
		const platformTarget = path.join(repoRoot, 'packages/mcp-server/npm', platformDir, binary.name)
		fs.mkdirSync(path.dirname(platformTarget), { recursive: true })
		fs.copyFileSync(binary.source, platformTarget)
		fs.chmodSync(platformTarget, 0o755)
		console.log(`[stage-rust-mcp] Staged platform package binary ${platformTarget}`)
	}
}
