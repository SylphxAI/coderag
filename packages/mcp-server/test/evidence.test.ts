import { describe, expect, test } from 'bun:test'
import { buildCodebaseSearchEnvelope } from '../src/evidence.js'

describe('codebase search evidence envelope', () => {
	test('builds structured retrieval contract fields', () => {
		const envelope = buildCodebaseSearchEnvelope({
			query: 'user authentication login',
			route: 'rust-tfidf',
			engine: {
				contract_version: 'coderag-retrieval-v1',
				index: 'rust-tfidf',
				search: 'rust-tfidf',
			},
			indexedFiles: 31,
			indexing: false,
			results: [
				{
					path: 'src/auth/login.ts',
					score: 1.2,
					matchedTerms: ['authentication', 'login'],
					size: 120,
					startLine: 1,
					endLine: 12,
					snippet: 'export function authenticate() {}',
				},
			],
		})

		expect(envelope.status).toBe('ok')
		expect(envelope.subject).toBe('codebase_search')
		expect(envelope.route).toBe('rust-tfidf')
		expect(envelope.engine.contract_version).toBe('coderag-retrieval-v1')
		expect(envelope.engine.index).toBe('rust-tfidf')
		expect(envelope.results[0]?.locator.startLine).toBe(1)
		expect(envelope.results[0]?.confidence).toBe('deterministic')
		expect(envelope.nextActions.length).toBeGreaterThan(0)
	})
})
