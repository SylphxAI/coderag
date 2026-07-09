import fs from 'node:fs'
import path from 'node:path'

const repoRoot = path.resolve(import.meta.dirname, '..')
const source = path.join(repoRoot, 'target/release/coderag-mcp-server')
const targetDir = path.join(repoRoot, 'bin/native')
const target = path.join(targetDir, 'coderag-mcp-server')

if (!fs.existsSync(source)) {
	console.error(`[stage-rust-mcp] Missing release binary at ${source}. Run: bun run build:rust`)
	process.exit(1)
}

fs.mkdirSync(targetDir, { recursive: true })
fs.copyFileSync(source, target)
fs.chmodSync(target, 0o755)

console.log(`[stage-rust-mcp] Staged ${target}`)
