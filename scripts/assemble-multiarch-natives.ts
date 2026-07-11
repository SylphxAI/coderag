/**
 * Assemble multi-arch platform packages from CI artifacts (or local staging).
 *
 * Expected artifact layout (from native matrix upload):
 *   artifacts/coderag-native-<rust-target>/coderag-mcp-server
 *
 * Writes into:
 *   packages/mcp-server/npm/<platform-key>/coderag-mcp-server
 *
 * Fail-closed: requires all configured platforms unless CODERAG_MULTIARCH_PARTIAL=1.
 */
import fs from 'node:fs'
import path from 'node:path'

const repoRoot = path.resolve(import.meta.dirname, '..')

const PLATFORMS = [
	{
		key: 'darwin-arm64',
		target: 'aarch64-apple-darwin',
		artifactNames: ['coderag-native-aarch64-apple-darwin'],
	},
	{
		key: 'darwin-x64',
		target: 'x86_64-apple-darwin',
		artifactNames: ['coderag-native-x86_64-apple-darwin'],
	},
	{
		key: 'linux-x64-gnu',
		target: 'x86_64-unknown-linux-gnu',
		artifactNames: ['coderag-native-x86_64-unknown-linux-gnu'],
	},
	{
		key: 'linux-arm64-gnu',
		target: 'aarch64-unknown-linux-gnu',
		artifactNames: ['coderag-native-aarch64-unknown-linux-gnu'],
	},
] as const

const artifactsRoot = process.env.CODERAG_ARTIFACTS_DIR
	? path.resolve(process.env.CODERAG_ARTIFACTS_DIR)
	: path.join(repoRoot, 'artifacts')

const partial = process.env.CODERAG_MULTIARCH_PARTIAL === '1'
const binaryName = 'coderag-mcp-server'

function findBinary(artifactDirNames: readonly string[]): string | null {
	for (const name of artifactDirNames) {
		const candidates = [
			path.join(artifactsRoot, name, binaryName),
			path.join(artifactsRoot, name, binaryName.replace(/-/g, '_')),
			// download-artifact sometimes flattens one level
			path.join(artifactsRoot, binaryName),
		]
		for (const candidate of candidates) {
			if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
				return candidate
			}
		}
		// Walk artifact dir for the binary name
		const dir = path.join(artifactsRoot, name)
		if (!fs.existsSync(dir)) continue
		const stack = [dir]
		while (stack.length > 0) {
			const current = stack.pop()
			if (current === undefined) break
			for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
				const full = path.join(current, entry.name)
				if (entry.isDirectory()) {
					stack.push(full)
				} else if (entry.name === binaryName) {
					return full
				}
			}
		}
	}
	return null
}

const missing: string[] = []
let assembled = 0

for (const platform of PLATFORMS) {
	const source = findBinary(platform.artifactNames)
	const destDir = path.join(repoRoot, 'packages/mcp-server/npm', platform.key)
	const dest = path.join(destDir, binaryName)

	if (!source) {
		missing.push(`${platform.key} (${platform.target})`)
		console.error(`[assemble-multiarch] MISSING binary for ${platform.key}`)
		continue
	}

	fs.mkdirSync(destDir, { recursive: true })
	fs.copyFileSync(source, dest)
	fs.chmodSync(dest, 0o755)

	const size = fs.statSync(dest).size
	if (size < 1024 * 100) {
		console.error(`[assemble-multiarch] FAIL: ${dest} is suspiciously small (${size} bytes)`)
		process.exit(1)
	}

	console.log(`[assemble-multiarch] ${platform.key}: ${source} → ${dest} (${size} bytes)`)
	assembled++
}

if (missing.length > 0) {
	console.error(`[assemble-multiarch] Missing platforms: ${missing.join(', ')}`)
	console.error(`[assemble-multiarch] artifactsRoot=${artifactsRoot}`)
	if (fs.existsSync(artifactsRoot)) {
		console.error('[assemble-multiarch] artifacts listing:')
		const list = (dir: string, depth = 0) => {
			if (depth > 3) return
			for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
				const full = path.join(dir, entry.name)
				console.error(`${'  '.repeat(depth)}${entry.isDirectory() ? `${entry.name}/` : entry.name}`)
				if (entry.isDirectory()) list(full, depth + 1)
			}
		}
		list(artifactsRoot)
	} else {
		console.error('[assemble-multiarch] artifacts root does not exist')
	}
	if (!partial) {
		console.error(
			'[assemble-multiarch] Fail-closed: all platforms required. Set CODERAG_MULTIARCH_PARTIAL=1 only for local debug.'
		)
		process.exit(1)
	}
}

if (assembled === 0) {
	console.error('[assemble-multiarch] No platform binaries assembled')
	process.exit(1)
}

console.log(`[assemble-multiarch] Assembled ${assembled}/${PLATFORMS.length} platform packages`)
