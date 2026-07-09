#!/usr/bin/env bun
/**
 * Reproducible public benchmark for CodeRAG README claims.
 * Indexes fixtures/benchmark-corpus, runs hybrid TF-IDF search 20x, prints p50 latency.
 */

import fs from 'node:fs'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { fileURLToPath } from 'node:url'
import { CodebaseIndexer } from '../packages/core/src/indexer.ts'
import { MemoryStorage } from '../packages/core/src/storage.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const corpusRoot = path.resolve(__dirname, '../fixtures/benchmark-corpus')
const SEARCH_ITERATIONS = 20
const WARMUP_ITERATIONS = 3

const queries = [
	'user authentication login',
	'database connection pool',
	'handle request router',
	'rate limit middleware',
	'retry utility function',
]

const countTypeScriptFiles = (dir: string): number => {
	let count = 0
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const fullPath = path.join(dir, entry.name)
		if (entry.isDirectory()) {
			count += countTypeScriptFiles(fullPath)
		} else if (entry.isFile() && entry.name.endsWith('.ts')) {
			count += 1
		}
	}
	return count
}

const percentile = (sorted: number[], p: number): number => {
	const index = Math.ceil((p / 100) * sorted.length) - 1
	return sorted[Math.max(0, Math.min(index, sorted.length - 1))]
}

const formatMs = (value: number): string => `${value.toFixed(1)} ms`

async function main(): Promise<void> {
	const fixtureFileCount = countTypeScriptFiles(path.join(corpusRoot, 'src'))
	const storage = new MemoryStorage()
	const indexer = new CodebaseIndexer({
		codebaseRoot: corpusRoot,
		storage,
		lowMemoryMode: false,
	})

	const indexStart = performance.now()
	await indexer.index()
	const indexDurationMs = performance.now() - indexStart

	const indexedFiles = await storage.count()
	const status = indexer.getStatus()
	const filesPerSecond = indexedFiles / (indexDurationMs / 1000)

	for (let i = 0; i < WARMUP_ITERATIONS; i++) {
		await indexer.search(queries[i % queries.length], { limit: 10, includeContent: true })
	}

	const latencies: number[] = []
	for (let i = 0; i < SEARCH_ITERATIONS; i++) {
		const query = queries[i % queries.length]
		const start = performance.now()
		await indexer.search(query, { limit: 10, includeContent: true })
		latencies.push(performance.now() - start)
	}

	await indexer.close()

	const sorted = [...latencies].sort((a, b) => a - b)
	const report = {
		profile: 'coderag-public-proof',
		corpus: {
			path: corpusRoot,
			fixtureTypeScriptFiles: fixtureFileCount,
			indexedFiles,
			indexedChunks: status.totalChunks,
		},
		indexing: {
			durationMs: Number(indexDurationMs.toFixed(1)),
			filesPerSecond: Number(filesPerSecond.toFixed(1)),
		},
		search: {
			iterations: SEARCH_ITERATIONS,
			warmupIterations: WARMUP_ITERATIONS,
			queries,
			p50Ms: Number(percentile(sorted, 50).toFixed(1)),
			minMs: Number(sorted[0].toFixed(1)),
			maxMs: Number(sorted[sorted.length - 1].toFixed(1)),
			avgMs: Number((sorted.reduce((sum, value) => sum + value, 0) / sorted.length).toFixed(1)),
		},
	}

	console.log(JSON.stringify(report, null, 2))
	console.error('')
	console.error('CodeRAG public benchmark proof')
	console.error(
		`Corpus: ${fixtureFileCount} fixture .ts files, ${indexedFiles} indexed files, ${status.totalChunks} chunks`
	)
	console.error(`Indexing: ${formatMs(indexDurationMs)} (${filesPerSecond.toFixed(1)} files/sec)`)
	console.error(
		`Search (TF-IDF, ${SEARCH_ITERATIONS} runs after ${WARMUP_ITERATIONS} warmup): p50 ${formatMs(report.search.p50Ms)}, avg ${formatMs(report.search.avgMs)}, min ${formatMs(report.search.minMs)}, max ${formatMs(report.search.maxMs)}`
	)
}

main().catch((error) => {
	console.error(error)
	process.exit(1)
})
