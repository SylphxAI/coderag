import { describe, expect, test } from 'bun:test'
import {
	buildRetrievalEngineEvidence,
	mergeRustLexicalWithSemantic,
	RETRIEVAL_CONTRACT_VERSION,
} from '../src/search-coordinator.js'

describe('search coordinator', () => {
	test('merges rust lexical and semantic hits into a hybrid ranking', () => {
		const merged = mergeRustLexicalWithSemantic(
			[
				{
					path: 'src/auth/login.ts',
					score: 2,
					matchedTerms: ['login'],
					size: 100,
					startLine: 1,
					endLine: 10,
				},
			],
			[
				{
					path: 'src/auth/login.ts',
					score: 1,
					matchedTerms: ['authentication'],
					size: 100,
					startLine: 1,
					endLine: 10,
				},
				{
					path: 'src/db/pool.ts',
					score: 0.9,
					matchedTerms: ['database'],
					size: 80,
				},
			],
			2
		)

		expect(merged).toHaveLength(2)
		expect(merged[0]?.path).toBe('src/auth/login.ts')
		expect(merged[0]?.matchedTerms).toEqual(expect.arrayContaining(['login', 'authentication']))
	})

	test('builds unified engine metadata across retrieval routes', () => {
		expect(
			buildRetrievalEngineEvidence({
				useRustIndexing: true,
				route: 'rust-semantic-hybrid',
			})
		).toEqual({
			contract_version: RETRIEVAL_CONTRACT_VERSION,
			index: 'rust-tfidf',
			search: 'rust-semantic-hybrid',
		})
	})
})
