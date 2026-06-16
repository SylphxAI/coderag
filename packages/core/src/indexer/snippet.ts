/**
 * Snippet extraction for in-memory (file-level) search results.
 *
 * Pure, self-contained helper extracted from the indexer orchestrator.
 * No dependency on indexer instance state.
 */

/**
 * Extract code block snippets from content around matched terms
 *
 * Returns the most relevant code blocks (not just lines) with context.
 * Blocks are ranked by term density (more matched terms = higher score).
 */
export function extractSnippet(
	content: string,
	matchedTerms: string[],
	options: { contextLines?: number; maxChars?: number; maxBlocks?: number } = {}
): string {
	const { contextLines = 3, maxChars = 2000, maxBlocks = 4 } = options
	const lines = content.split('\n')

	// Step 1: Find all lines with matches and score them
	const matchedLineInfos: Array<{
		lineNum: number
		score: number
		matchedTerms: string[]
	}> = []

	for (let i = 0; i < lines.length; i++) {
		const lineLower = lines[i].toLowerCase()
		const termsInLine = matchedTerms.filter((term) => lineLower.includes(term.toLowerCase()))

		if (termsInLine.length > 0) {
			matchedLineInfos.push({
				lineNum: i,
				score: termsInLine.length,
				matchedTerms: termsInLine,
			})
		}
	}

	if (matchedLineInfos.length === 0) {
		// Return first few lines if no matches found
		return lines.slice(0, 5).join('\n')
	}

	// Step 2: Expand each matched line to a block with context, then merge overlapping blocks
	interface Block {
		start: number
		end: number
		score: number
		matchedTerms: Set<string>
	}

	const blocks: Block[] = []

	for (const info of matchedLineInfos) {
		const start = Math.max(0, info.lineNum - contextLines)
		const end = Math.min(lines.length - 1, info.lineNum + contextLines)

		// Try to merge with existing block if overlapping
		let merged = false
		for (const block of blocks) {
			if (start <= block.end + 1 && end >= block.start - 1) {
				// Overlapping or adjacent - merge
				block.start = Math.min(block.start, start)
				block.end = Math.max(block.end, end)
				block.score += info.score
				for (const term of info.matchedTerms) {
					block.matchedTerms.add(term)
				}
				merged = true
				break
			}
		}

		if (!merged) {
			blocks.push({
				start,
				end,
				score: info.score,
				matchedTerms: new Set(info.matchedTerms),
			})
		}
	}

	// Step 3: Sort blocks by unique terms (primary) and density (secondary)
	// Unique terms = how many different query terms appear in block
	// Density = unique terms / block size (prefer compact blocks)
	blocks.sort((a, b) => {
		const uniqueA = a.matchedTerms.size
		const uniqueB = b.matchedTerms.size
		if (uniqueA !== uniqueB) {
			return uniqueB - uniqueA // More unique terms = better
		}
		// Tie-break: prefer denser blocks (more terms per line)
		const densityA = uniqueA / (a.end - a.start + 1)
		const densityB = uniqueB / (b.end - b.start + 1)
		return densityB - densityA
	})
	const topBlocks = blocks.slice(0, maxBlocks)

	// Sort by position for output (top to bottom in file)
	topBlocks.sort((a, b) => a.start - b.start)

	// Step 4: Build output with character limit
	const snippetParts: string[] = []
	let totalChars = 0

	for (const block of topBlocks) {
		const blockLines = lines.slice(block.start, block.end + 1)
		const blockContent = blockLines.map((line, i) => `${block.start + i + 1}: ${line}`).join('\n')

		// Check if adding this block would exceed limit
		if (totalChars + blockContent.length > maxChars && snippetParts.length > 0) {
			break
		}

		snippetParts.push(blockContent)
		totalChars += blockContent.length
	}

	return snippetParts.join('\n...\n')
}
