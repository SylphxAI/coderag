/**
 * Post-publish readback: confirm platform packages exist on npm for the mcp version.
 *
 * - Version-PR path: SKIP if main package version not on registry yet.
 * - Publish path: fail-closed if platform packages missing.
 * - Uses version-specific tarball HEAD (full application/json packument can
 *   lag several minutes after first publish of a new package name).
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

function sleep(ms: number): void {
	spawnSync('sleep', [String(ms / 1000)], { stdio: 'ignore' })
}

function tarballUrl(name: string, ver: string): string {
	const scopedPath = name.startsWith('@') ? name.replace('/', '%2f') : name
	const shortName = name.includes('/') ? name.split('/')[1]! : name
	return `https://registry.npmjs.org/${scopedPath}/-/${shortName}-${ver}.tgz`
}

function tarballExists(name: string, ver: string): boolean {
	const url = tarballUrl(name, ver)
	const result = spawnSync(
		'curl',
		['-sS', '-o', '/dev/null', '-w', '%{http_code}', '-L', '-I', url],
		{ encoding: 'utf8' }
	)
	return result.status === 0 && (result.stdout || '').trim().split('\n').pop() === '200'
}

function npmViewVersion(name: string, ver: string): boolean {
	const view = spawnSync('npm', ['view', `${name}@${ver}`, 'version', '--json'], {
		encoding: 'utf8',
	})
	if (view.status !== 0) return false
	const raw = (view.stdout || '').trim()
	try {
		const parsed = JSON.parse(raw) as string | string[]
		if (typeof parsed === 'string') return parsed === ver
		if (Array.isArray(parsed)) return parsed.includes(ver)
	} catch {
		return raw.replace(/"/g, '') === ver
	}
	return raw.includes(ver)
}

function packageExists(name: string, ver: string): boolean {
	// Version-specific tarball is authoritative and available before full packument.
	if (tarballExists(name, ver)) return true
	// Fallback after packument replication.
	return npmViewVersion(name, ver)
}

function packageExistsWithRetry(name: string, ver: string, attempts = 10): boolean {
	for (let i = 0; i < attempts; i++) {
		if (packageExists(name, ver)) return true
		const waitMs = Math.min(20_000, 2000 * (i + 1))
		console.log(
			`[verify-multiarch-readback] waiting for registry: ${name}@${ver} (attempt ${i + 1}/${attempts}, sleep ${waitMs}ms)`
		)
		sleep(waitMs)
	}
	return false
}

// Version-PR-only Release runs still invoke postpublish after creating the
// Changesets version PR (published=false). Skip fail-closed readback until
// the version actually exists on the registry.
if (!packageExists('@sylphx/coderag-mcp', version)) {
	console.log(
		`[verify-multiarch-readback] SKIP: @sylphx/coderag-mcp@${version} not on registry yet (version PR path; publish happens after version PR merge)`
	)
	process.exit(0)
}

let failed = 0
for (const name of platformNames) {
	const expected = optional[name]
	if (packageExistsWithRetry(name, expected)) {
		console.log(`[verify-multiarch-readback] OK ${name}@${expected}`)
	} else {
		failed++
		console.error(`[verify-multiarch-readback] MISSING ${name}@${expected}`)
	}
}

if (failed > 0) {
	console.error(`[verify-multiarch-readback] FAIL: ${failed} package(s) missing on registry`)
	process.exit(1)
}

console.log(
	`[verify-multiarch-readback] PASS: ${platformNames.length} platform packages @ ${version}`
)
