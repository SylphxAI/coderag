import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'

const readText = (path: string) => readFileSync(path, 'utf8')

describe('README discovery surfaces', () => {
	it('keeps pain-first fold content and honest discovery status', () => {
		const readme = readText('README.md')

		expect(readme).toContain('Did it find the right code?')
		expect(readme).toContain('## Why not grep alone?')
		expect(readme).toContain('claude mcp add coderag')
		expect(readme).toContain('@sylphx/coderag-mcp')
		expect(readme).toMatch(/Star the repo|Star this repo/)
		expect(readme).toContain('Not listed yet')
		expect(readme).toContain('### Discovery')
		expect(readme).toContain('grep/ripgrep')
		expect(readme).toContain('Cloud RAG')
		expect(readme).toContain('docs/benchmark.md')
		expect(readme).toContain('docs/articles/stop-code-search-guessing.md')
		expect(readme).toContain('bun run benchmark:public-proof')
		expect(readme).toContain('## Security model')
		expect(readme).toContain('examples/codebase-search-request.json')
		expect(readme).not.toContain('MacBook Pro')
		expect(readme).not.toContain('<50ms')
		expect(readme).not.toContain('1000-2000 files/sec')
	})

	it('ships the public benchmark script and fixture corpus', () => {
		expect(existsSync('scripts/benchmark-public-proof.ts')).toBe(true)
		expect(existsSync('fixtures/benchmark-corpus/src/auth/login.ts')).toBe(true)
		expect(readText('package.json')).toContain('benchmark:public-proof')
	})

	it('links the shareable discovery article from docs surfaces', () => {
		const vitepress = readText('docs/.vitepress/config.ts')
		const gettingStarted = readText('docs/guide/getting-started.md')
		const index = readText('docs/index.md')

		expect(existsSync('docs/articles/stop-code-search-guessing.md')).toBe(true)
		expect(existsSync('docs/benchmark.md')).toBe(true)
		expect(vitepress).toContain('/articles/stop-code-search-guessing')
		expect(gettingStarted).toContain('/articles/stop-code-search-guessing')
		expect(index).toContain('Did it find the right code?')
	})
})
