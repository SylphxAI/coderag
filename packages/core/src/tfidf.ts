/**
 * TF-IDF (Term Frequency-Inverse Document Frequency) implementation
 * Simplified version for codebase search
 */

import { simpleCodeTokenize } from './code-tokenizer.js'

// Query token cache - avoids re-tokenizing the same query (CPU optimization)
const queryTokenCache = new Map<string, string[]>()
const QUERY_CACHE_MAX_SIZE = 100

function getCachedQueryTokens(query: string): string[] {
	const cached = queryTokenCache.get(query)
	if (cached) return cached

	// Tokenize and dedupe
	const tokens = [...new Set(tokenize(query))]

	// LRU-style eviction: remove oldest if full
	if (queryTokenCache.size >= QUERY_CACHE_MAX_SIZE) {
		const firstKey = queryTokenCache.keys().next().value
		if (firstKey) queryTokenCache.delete(firstKey)
	}

	queryTokenCache.set(query, tokens)
	return tokens
}

export interface DocumentVector {
	uri: string
	terms: Map<string, number> // term → TF-IDF score
	rawTerms: Map<string, number> // term → raw frequency
	magnitude: number // Vector magnitude for cosine similarity
}

export interface SearchIndex {
	documents: DocumentVector[]
	idf: Map<string, number> // term → IDF score
	totalDocuments: number
	metadata: {
		generatedAt: string
		version: string
	}
}

/**
 * Code-aware tokenizer using StarCoder2 approach
 * Handles camelCase, snake_case, identifiers, and string contents
 */
export function tokenize(text: string): string[] {
	return simpleCodeTokenize(text)
}

/**
 * Calculate Term Frequency (TF)
 */
function calculateTF(termFrequency: Map<string, number>): Map<string, number> {
	const totalTerms = Array.from(termFrequency.values()).reduce((sum, freq) => sum + freq, 0)
	const tf = new Map<string, number>()

	for (const [term, freq] of termFrequency.entries()) {
		tf.set(term, freq / totalTerms)
	}

	return tf
}

/**
 * Calculate Inverse Document Frequency (IDF)
 */
function calculateIDF(
	documents: Map<string, number>[],
	totalDocuments: number
): Map<string, number> {
	const documentFrequency = new Map<string, number>()

	// Count how many documents contain each term
	for (const doc of documents) {
		const uniqueTerms = new Set(doc.keys())
		for (const term of uniqueTerms) {
			documentFrequency.set(term, (documentFrequency.get(term) || 0) + 1)
		}
	}

	// Calculate IDF for each term
	const idf = new Map<string, number>()
	for (const [term, docFreq] of documentFrequency.entries()) {
		idf.set(term, Math.log(totalDocuments / docFreq))
	}

	return idf
}

/**
 * Calculate TF-IDF scores for a document
 */
function calculateTFIDF(tf: Map<string, number>, idf: Map<string, number>): Map<string, number> {
	const tfidf = new Map<string, number>()

	for (const [term, tfScore] of tf.entries()) {
		const idfScore = idf.get(term) || 0
		tfidf.set(term, tfScore * idfScore)
	}

	return tfidf
}

/**
 * Calculate vector magnitude for cosine similarity
 */
function calculateMagnitude(vector: Map<string, number>): number {
	let sum = 0
	for (const value of vector.values()) {
		sum += value * value
	}
	return Math.sqrt(sum)
}

/**
 * Extract term frequencies from content
 */
function extractTermFrequencies(content: string): Map<string, number> {
	const tokens = tokenize(content)
	const frequencies = new Map<string, number>()

	for (const token of tokens) {
		frequencies.set(token, (frequencies.get(token) || 0) + 1)
	}

	return frequencies
}

/**
 * Build TF-IDF search index from documents
 */
export function buildSearchIndex(documents: Array<{ uri: string; content: string }>): SearchIndex {
	// Extract term frequencies for all documents
	const documentTerms = documents.map((doc) => ({
		uri: doc.uri,
		terms: extractTermFrequencies(doc.content),
	}))

	// Calculate IDF scores
	const idf = calculateIDF(
		documentTerms.map((d) => d.terms),
		documents.length
	)

	// Calculate TF-IDF for each document
	const documentVectors: DocumentVector[] = documentTerms.map((doc) => {
		const tf = calculateTF(doc.terms)
		const tfidf = calculateTFIDF(tf, idf)
		const magnitude = calculateMagnitude(tfidf)

		return {
			uri: doc.uri,
			terms: tfidf,
			rawTerms: doc.terms,
			magnitude,
		}
	})

	return {
		documents: documentVectors,
		idf,
		totalDocuments: documents.length,
		metadata: {
			generatedAt: new Date().toISOString(),
			version: '1.0.0',
		},
	}
}

/**
 * Calculate cosine similarity between query and document
 */
export function calculateCosineSimilarity(
	queryVector: Map<string, number>,
	docVector: DocumentVector
): number {
	let dotProduct = 0

	// Calculate dot product
	for (const [term, queryScore] of queryVector.entries()) {
		const docScore = docVector.terms.get(term) || 0
		dotProduct += queryScore * docScore
	}

	// Calculate query magnitude
	const queryMagnitude = calculateMagnitude(queryVector)

	if (queryMagnitude === 0 || docVector.magnitude === 0) {
		return 0
	}

	return dotProduct / (queryMagnitude * docVector.magnitude)
}

/**
 * Process query into TF-IDF vector
 */
export function processQuery(query: string, idf: Map<string, number>): Map<string, number> {
	const terms = tokenize(query)
	return processQueryWithTokens(terms, idf)
}

/**
 * Process query from pre-tokenized terms (CPU optimization - avoids re-tokenizing)
 */
function processQueryWithTokens(tokens: string[], idf: Map<string, number>): Map<string, number> {
	const queryVector = new Map<string, number>()

	for (const term of tokens) {
		const idfValue = idf.get(term) || 0
		if (idfValue > 0) {
			queryVector.set(term, idfValue)
		}
	}

	return queryVector
}

/**
 * SQL-based search result from storage
 * Uses pre-computed magnitude for memory efficiency
 */
export interface StorageSearchResult {
	path: string
	matchedTerms: Map<string, { tfidf: number; rawFreq: number }>
	magnitude: number // Pre-computed from files table
}

/**
 * Search documents using SQL-based storage (Memory optimization)
 * Uses pre-computed magnitude - does not need to load all document vectors
 */
export function searchDocumentsFromStorage(
	query: string,
	candidates: StorageSearchResult[],
	idf: Map<string, number>,
	options: {
		limit?: number
		minScore?: number
	} = {}
): Array<{ uri: string; score: number; matchedTerms: string[] }> {
	const { limit = 10, minScore = 0 } = options

	// Get query tokens (cached)
	const queryTokens = getCachedQueryTokens(query)

	// Build query vector
	const queryVector = new Map<string, number>()
	for (const term of queryTokens) {
		const idfValue = idf.get(term) || 0
		if (idfValue > 0) {
			queryVector.set(term, idfValue)
		}
	}

	// Calculate query magnitude
	let queryMagnitudeSquared = 0
	for (const value of queryVector.values()) {
		queryMagnitudeSquared += value * value
	}
	const queryMagnitude = Math.sqrt(queryMagnitudeSquared)

	if (queryMagnitude === 0) {
		return []
	}

	// Score each candidate
	const results: Array<{ uri: string; score: number; matchedTerms: string[] }> = []
	let minThreshold = minScore

	for (const candidate of candidates) {
		// Get matched terms
		const matchedTerms: string[] = []
		for (const term of queryTokens) {
			if (candidate.matchedTerms.has(term)) {
				matchedTerms.push(term)
			}
		}

		if (matchedTerms.length === 0) continue

		// Calculate dot product using matched terms
		let dotProduct = 0
		for (const [term, queryScore] of queryVector.entries()) {
			const docData = candidate.matchedTerms.get(term)
			if (docData) {
				dotProduct += queryScore * docData.tfidf
			}
		}

		// Use pre-computed magnitude from files table (Memory optimization)
		// No need to load all document vectors just for magnitude calculation
		const docMagnitude = candidate.magnitude

		if (docMagnitude === 0) continue

		// Cosine similarity
		let score = dotProduct / (queryMagnitude * docMagnitude)

		// Boost for exact term matches
		score *= 1.5 ** matchedTerms.length

		// Boost for phrase matches
		if (matchedTerms.length === queryTokens.length && queryTokens.length > 1) {
			score *= 2.0
		}

		if (score < minThreshold) continue

		results.push({ uri: `file://${candidate.path}`, score, matchedTerms })

		// Bounded results
		if (results.length >= limit * 2) {
			results.sort((a, b) => b.score - a.score)
			results.length = limit
			minThreshold = results[results.length - 1].score
		}
	}

	return results.sort((a, b) => b.score - a.score).slice(0, limit)
}

/**
 * Get query tokens (exported for SQL-based search)
 */
export function getQueryTokens(query: string): string[] {
	return getCachedQueryTokens(query)
}

/**
 * Search documents using TF-IDF and cosine similarity
 */
export function searchDocuments(
	query: string,
	index: SearchIndex,
	options: {
		limit?: number
		minScore?: number
	} = {}
): Array<{ uri: string; score: number; matchedTerms: string[] }> {
	const { limit = 10, minScore = 0 } = options

	// Process query with cached tokens (CPU optimization)
	const queryTokens = getCachedQueryTokens(query)
	const queryVector = processQueryWithTokens(queryTokens, index.idf)

	// Calculate similarity only for documents with matching terms (CPU optimization)
	// Use bounded results array to reduce memory and sorting overhead
	const results: Array<{ uri: string; score: number; matchedTerms: string[] }> = []
	let minThreshold = minScore // Track minimum score needed to enter top-k

	for (const doc of index.documents) {
		// Early skip: check if document has ANY matching terms first
		const matchedTerms: string[] = []
		for (const token of queryTokens) {
			if (doc.rawTerms.has(token)) {
				matchedTerms.push(token)
			}
		}

		// Skip documents with no matching terms - saves CPU on similarity calculation
		if (matchedTerms.length === 0) continue

		// Only calculate similarity for documents with matches
		let score = calculateCosineSimilarity(queryVector, doc)

		// Boost for exact term matches
		score *= 1.5 ** matchedTerms.length

		// Boost for phrase matches (all terms found)
		if (matchedTerms.length === queryTokens.length && queryTokens.length > 1) {
			score *= 2.0
		}

		// Early skip if score can't make it into top-k (CPU + Memory optimization)
		if (score < minThreshold) continue

		// Insert into results maintaining rough order
		results.push({ uri: doc.uri, score, matchedTerms })

		// If we have more than 2x limit, trim to limit (amortized sorting)
		if (results.length >= limit * 2) {
			results.sort((a, b) => b.score - a.score)
			results.length = limit
			minThreshold = results[results.length - 1].score
		}
	}

	// Final sort and limit
	return results.sort((a, b) => b.score - a.score).slice(0, limit)
}
