export async function retry<T>(fn: () => Promise<T>, attempts = 3, delayMs = 100): Promise<T> {
	let lastError: unknown
	for (let i = 0; i < attempts; i++) {
		try {
			return await fn()
		} catch (error) {
			lastError = error
			await new Promise((resolve) => setTimeout(resolve, delayMs * (i + 1)))
		}
	}
	throw lastError
}
