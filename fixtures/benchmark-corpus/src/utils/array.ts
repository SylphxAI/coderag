export function unique<T>(items: T[]): T[] {
	return [...new Set(items)]
}

export function chunk<T>(items: T[], size: number): T[][] {
	const chunks: T[][] = []
	for (let i = 0; i < items.length; i += size) {
		chunks.push(items.slice(i, i + size))
	}
	return chunks
}

export function groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
	return items.reduce<Record<string, T[]>>((acc, item) => {
		const key = keyFn(item)
		acc[key] ??= []
		acc[key].push(item)
		return acc
	}, {})
}
