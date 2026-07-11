/**
 * Sync optionalDependency + platform package versions to @sylphx/coderag-mcp version.
 * Run after `changeset version` so platform packages publish at the same version.
 */
import fs from 'node:fs'
import path from 'node:path'

const repoRoot = path.resolve(import.meta.dirname, '..')
const mcpPackagePath = path.join(repoRoot, 'packages/mcp-server/package.json')
const mcpPkg = JSON.parse(fs.readFileSync(mcpPackagePath, 'utf8')) as {
	version: string
	optionalDependencies?: Record<string, string>
}

const version = mcpPkg.version
const platformDir = path.join(repoRoot, 'packages/mcp-server/npm')
const platforms = fs
	.readdirSync(platformDir, { withFileTypes: true })
	.filter((e) => e.isDirectory())
	.map((e) => e.name)

const expectedOptional: Record<string, string> = {}
let updated = false

for (const platform of platforms) {
	const pkgPath = path.join(platformDir, platform, 'package.json')
	if (!fs.existsSync(pkgPath)) continue
	const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as {
		name: string
		version: string
	}
	expectedOptional[pkg.name] = version
	if (pkg.version !== version) {
		console.log(`[sync-platform-versions] ${pkg.name}: ${pkg.version} → ${version}`)
		pkg.version = version
		fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
		updated = true
	}
}

const currentOptional = mcpPkg.optionalDependencies ?? {}
const nextOptional = { ...currentOptional, ...expectedOptional }
const optionalChanged = JSON.stringify(currentOptional) !== JSON.stringify(nextOptional)

if (optionalChanged) {
	mcpPkg.optionalDependencies = nextOptional
	fs.writeFileSync(mcpPackagePath, `${JSON.stringify(mcpPkg, null, 2)}\n`)
	console.log(`[sync-platform-versions] Updated optionalDependencies to ${version}`)
	updated = true
}

if (!updated) {
	console.log(`[sync-platform-versions] Already synced at ${version}`)
} else {
	console.log(`[sync-platform-versions] Done (mcp @ ${version})`)
}
