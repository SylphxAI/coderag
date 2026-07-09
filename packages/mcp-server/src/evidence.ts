import type { SearchResult } from '@sylphx/coderag'

export type RetrievalRoute = 'tfidf' | 'semantic' | 'rust-tfidf'

export interface RetrievalLocator {
	path: string
	startLine?: number
	endLine?: number
}

export interface ScoreComponentEvidence {
	term: string
	termFrequency: number
	documentFrequency: number
	idf: number
	bm25: number
}

export interface RetrievalResultEvidence {
	path: string
	locator: RetrievalLocator
	score: number
	matchedTerms: string[]
	scoreComponents?: ScoreComponentEvidence[]
	route: RetrievalRoute
	confidence: 'deterministic' | 'derived' | 'inferred' | 'unknown'
	snippet?: string
	chunkType?: string
	language?: string
}

export interface CodebaseSearchEnvelope {
	status: 'ok' | 'error'
	subject: 'codebase_search'
	query: string
	route: RetrievalRoute
	freshness: {
		indexedFiles: number
		indexing: boolean
		stale: boolean
	}
	results: RetrievalResultEvidence[]
	warnings: string[]
	nextActions: string[]
}

export function buildCodebaseSearchEnvelope(input: {
	query: string
	route: RetrievalRoute
	indexedFiles: number
	indexing: boolean
	results: SearchResult[]
	warnings?: string[]
}): CodebaseSearchEnvelope {
	return {
		status: 'ok',
		subject: 'codebase_search',
		query: input.query,
		route: input.route,
		freshness: {
			indexedFiles: input.indexedFiles,
			indexing: input.indexing,
			stale: false,
		},
		results: input.results.map((result) => ({
			path: result.path,
			locator: {
				path: result.path,
				startLine: result.startLine,
				endLine: result.endLine,
			},
			score: result.score,
			matchedTerms: result.matchedTerms ?? [],
			...(result.scoreComponents && result.scoreComponents.length > 0
				? { scoreComponents: result.scoreComponents }
				: {}),
			route: input.route,
			confidence: 'deterministic',
			snippet: result.snippet,
			chunkType: result.chunkType,
			language: result.language,
		})),
		warnings: input.warnings ?? [],
		nextActions: [
			'Open the top result path and verify the cited line range before editing.',
			'Re-run codebase_search after index refresh if files changed.',
		],
	}
}

export function mapRustHitsToSearchResults(
	hits: Array<{
		path: string
		score: number
		matchedTerms: string[]
		scoreComponents?: Array<{
			term: string
			termFrequency: number
			documentFrequency: number
			idf: number
			bm25: number
		}>
		startLine?: number
		endLine?: number
		snippet?: string
		symbolName?: string
		chunkType?: string
	}>
): SearchResult[] {
	return hits.map((hit) => ({
		path: hit.path,
		score: hit.score,
		matchedTerms: hit.matchedTerms,
		...(hit.scoreComponents && hit.scoreComponents.length > 0
			? { scoreComponents: hit.scoreComponents }
			: {}),
		size: hit.snippet?.length ?? 0,
		startLine: hit.startLine,
		endLine: hit.endLine,
		snippet: hit.snippet,
		...(hit.chunkType || hit.symbolName ? { chunkType: hit.chunkType ?? 'function' } : {}),
	}))
}
