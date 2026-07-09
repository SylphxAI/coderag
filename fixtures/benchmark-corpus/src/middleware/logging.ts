export function logRequest(req: Request): void {
	const url = new URL(req.url)
	console.error(`[req] ${req.method} ${url.pathname}`)
}

export function logResponse(status: number, durationMs: number): void {
	console.error(`[res] ${status} ${durationMs}ms`)
}

export function withTiming<T>(fn: () => Promise<T>): Promise<{ result: T; durationMs: number }> {
	const start = performance.now()
	return fn().then((result) => ({ result, durationMs: performance.now() - start }))
}
