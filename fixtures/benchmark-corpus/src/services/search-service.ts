export interface SearchHit {
	path: string
	score: number
	snippet: string
}

export function rankResults(query: string, hits: SearchHit[]): SearchHit[] {
	const terms = query.toLowerCase().split(/\s+/)
	return hits
		.map((hit) => ({
			...hit,
			score: terms.reduce(
				(score, term) => (hit.snippet.toLowerCase().includes(term) ? score + 1 : score),
				hit.score
			),
		}))
		.sort((a, b) => b.score - a.score)
}
