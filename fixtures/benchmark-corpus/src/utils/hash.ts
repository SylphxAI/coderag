export function simpleHash(input: string): string {
	let hash = 0
	for (let i = 0; i < input.length; i++) {
		hash = (hash << 5) - hash + input.charCodeAt(i)
		hash |= 0
	}
	return Math.abs(hash).toString(16)
}

export function stableObjectHash(obj: Record<string, unknown>): string {
	return simpleHash(JSON.stringify(obj, Object.keys(obj).sort()))
}
