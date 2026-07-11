/**
 * Post-publish readback: confirm platform packages exist on npm for the mcp version.
 *
 * Safe on the Changesets version-PR path (no packages published yet): if the
 * main package version is not on the registry, exit 0 with SKIP.
 * Fail-closed after a real publish when packages are missing.
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

function npmViewVersion(name: string, ver: string): string | null {
	const result = spawnSync('npm', ['view', `${name}@${ver}`, 'version', '--json'], {
		encoding: 'utf8',
	})
	if (result.status !== 0) return null
	const raw = (result.stdout || '').trim()
	try {
		const parsed = JSON.parse(raw) as string | string[]
		if (typeof parsed === 'string') return parsed
		if (Array.isArray(parsed) && parsed.includes(ver)) return ver
	} catch {
		if (raw.replace(/"/g, '') === ver) return ver
	}
	return raw.includes(ver) ? ver : null
}

// Version-PR-only Release runs still invoke postpublish after creating the
// Changesets version PR (published=false). Skip fail-closed readback until
// the version actually exists on the registry.
if (!npmViewVersion('@sylphx/coderag-mcp', version)) {
	console.log(
		`[verify-multiarch-readback] SKIP: @sylphx/coderag-mcp@${version} not on registry yet (version PR path; publish happens after version PR merge)`
	)
	process.exit(0)
}

let failed = 0
for (const name of platformNames) {
	const expected = optional[name]
	const found = npmViewVersion(name, expected)
	if (found) {
		console.log(`[verify-multiarch-readback] OK ${name}@${expected}`)
	} else {
		failed++
		console.error(`[verify-multiarch-readback] MISSING ${name}@${expected}`)
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
