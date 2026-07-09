import type { HybridSearchResult, SearchResult } from '@sylphx/coderag'
import type { RetrievalEngineEvidence, RetrievalRoute } from './evidence.js'
import { mapRustHitsToSearchResults } from './evidence.js'
import type { RustSearchEnvelope } from './rust-engine.js'

export const RETRIEVAL_CONTRACT_VERSION = 'coderag-retrieval-v1'

const resultKey = (result: { path: string; startLine?: number; endLine?: number }): string =>
	`${result.path}:${result.startLine ?? 0}:${result.endLine ?? 0}`

export const mapHybridResultsToSearchResults = (results: HybridSearchResult[]): SearchResult[] =>
	results.map((result) => ({
		path: result.path,
		score: result.score,
		matchedTerms: result.matchedTerms ?? [],
		size: result.content?.length ?? result.snippet?.length ?? 0,
		snippet: result.snippet ?? result.content,
		chunkType: result.chunkType,
		startLine: result.startLine,
		endLine: result.endLine,
		language: result.language,
	}))

export const mergeRustLexicalWithSemantic = (
	rustHits: SearchResult[],
	semanticHits: SearchResult[],
	limit: number
): SearchResult[] => {
	const rustByKey = new Map(rustHits.map((hit) => [resultKey(hit), hit]))
	const semanticByKey = new Map(semanticHits.map((hit) => [resultKey(hit), hit]))
	const mergedKeys = new Set([...rustByKey.keys(), ...semanticByKey.keys()])

	const merged = [...mergedKeys].map((key) => {
		const rustHit = rustByKey.get(key)
		const semanticHit = semanticByKey.get(key)

		if (rustHit && semanticHit) {
			return {
				...semanticHit,
				score: semanticHit.score * 0.7 + rustHit.score * 0.3,
				matchedTerms: [
					...new Set([...(semanticHit.matchedTerms ?? []), ...(rustHit.matchedTerms ?? [])]),
				],
				...(rustHit.scoreComponents && rustHit.scoreComponents.length > 0
					? { scoreComponents: rustHit.scoreComponents }
					: {}),
			}
		}

		if (semanticHit) {
			return { ...semanticHit, score: semanticHit.score * 0.85 }
		}

		if (!rustHit) {
			throw new Error('Merged retrieval key is missing both rust and semantic hits.')
		}

		return { ...rustHit, score: rustHit.score * 0.35 }
	})

	return merged.sort((left, right) => right.score - left.score).slice(0, limit)
}

export const buildRetrievalEngineEvidence = (input: {
	useRustIndexing: boolean
	route: RetrievalRoute
}): RetrievalEngineEvidence => ({
	contract_version: RETRIEVAL_CONTRACT_VERSION,
	index: input.useRustIndexing ? 'rust-tfidf' : 'typescript',
	search: input.route,
})

export const mapRustSearchEnvelope = (
	envelope: RustSearchEnvelope,
	limit: number
): SearchResult[] => {
	if (envelope.status !== 'ok' || !envelope.results) {
		return []
	}

	return mapRustHitsToSearchResults(envelope.results).slice(0, limit)
}
