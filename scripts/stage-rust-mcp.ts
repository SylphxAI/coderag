import fs from 'node:fs'
import path from 'node:path'

const repoRoot = path.resolve(import.meta.dirname, '..')

type StagedBinary = {
	readonly name: string
	readonly source: string
	readonly targets: readonly string[]
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
}
