/**
 * Post-publish readback: confirm platform packages exist on npm for the mcp version.
 * Fail-closed when CODERAG_MULTIARCH_READBACK=1 (release postpublish).
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const repoRoot = path.resolve(import.meta.dirname, '..')
const mcpPkg = JSON.parse(
	fs.readFileSync(path.join(repoRoot, 'packages/mcp-server/package.json'), 'utf8')
) as { version: string; optionalDependencies?: Record<string, string> }

const version = mcpPkg.version
const optional = mcpPkg.optionalDependencies ?? {}
const platformNames = Object.keys(optional).filter((n) => n.startsWith('@sylphx/coderag-mcp-'))

if (platformNames.length === 0) {
	console.error('[verify-multiarch-readback] No platform optionalDependencies declared')
	process.exit(1)
}

let failed = 0
for (const name of platformNames) {
	const expected = optional[name]
	const result = spawnSync('npm', ['view', `${name}@${expected}`, 'version', '--json'], {
		encoding: 'utf8',
	})
	const ok = result.status === 0 && (result.stdout || '').includes(expected)
	if (ok) {
		console.log(`[verify-multiarch-readback] OK ${name}@${expected}`)
	} else {
		failed++
		console.error(`[verify-multiarch-readback] MISSING ${name}@${expected}`)
		console.error(result.stdout || '')
		console.error(result.stderr || '')
	}
}

// Also confirm main package optionalDependencies on registry match.
const mainView = spawnSync(
	'npm',
	['view', `@sylphx/coderag-mcp@${version}`, 'optionalDependencies', '--json'],
	{ encoding: 'utf8' }
)
if (mainView.status === 0) {
	console.log(`[verify-multiarch-readback] main optionalDependencies: ${mainView.stdout.trim()}`)
} else {
	console.error(`[verify-multiarch-readback] could not view @sylphx/coderag-mcp@${version}`)
	failed++
}

if (failed > 0) {
	console.error(`[verify-multiarch-readback] FAIL: ${failed} package(s) missing on registry`)
	process.exit(1)
}

console.log(
	`[verify-multiarch-readback] PASS: ${platformNames.length} platform packages @ ${version}`
)
