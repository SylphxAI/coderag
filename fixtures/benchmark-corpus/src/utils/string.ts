export function slugify(input: string): string {
	return input
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
}

export function truncate(input: string, max: number): string {
	return input.length <= max ? input : `${input.slice(0, max - 3)}...`
}

export function camelToSnake(input: string): string {
	return input.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)
}
