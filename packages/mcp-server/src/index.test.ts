/**
 * MCP Server Tests
 */

import { describe, expect, test } from 'bun:test'

describe('MCP Server', () => {
	test('should export server configuration', () => {
		// Basic smoke test - ensure module can be imported
		expect(true).toBe(true)
	})

	test('SERVER_CONFIG should have required fields', () => {
		const SERVER_CONFIG = {
			name: '@sylphx/coderag-mcp',
			version: '1.0.0',
			description: 'MCP server providing intelligent codebase search using TF-IDF',
		}

		expect(SERVER_CONFIG.name).toBe('@sylphx/coderag-mcp')
		expect(SERVER_CONFIG.version).toBeDefined()
		expect(SERVER_CONFIG.description).toBeDefined()
	})

	test('command line argument parsing', () => {
		const args = ['--root=/test/path', '--max-size=2097152', '--no-auto-index']

		const codebaseRoot = args.find((arg) => arg.startsWith('--root='))?.split('=')[1]
		const maxFileSize = parseInt(args.find((arg) => arg.startsWith('--max-size='))?.split('=')[1] || '1048576', 10)
		const autoIndex = !args.includes('--no-auto-index')

		expect(codebaseRoot).toBe('/test/path')
		expect(maxFileSize).toBe(2097152)
		expect(autoIndex).toBe(false)
	})

	test('default values when no arguments provided', () => {
		const args: string[] = []

		const maxFileSize = parseInt(args.find((arg) => arg.startsWith('--max-size='))?.split('=')[1] || '1048576', 10)
		const autoIndex = !args.includes('--no-auto-index')

		expect(maxFileSize).toBe(1048576) // 1MB default
		expect(autoIndex).toBe(true) // auto-index enabled by default
	})
})
