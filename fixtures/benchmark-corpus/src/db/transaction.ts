export async function withTransaction<T>(fn: () => Promise<T>): Promise<T> {
	await beginTransaction()
	try {
		const result = await fn()
		await commitTransaction()
		return result
	} catch (error) {
		await rollbackTransaction()
		throw error
	}
}

async function beginTransaction(): Promise<void> {}
async function commitTransaction(): Promise<void> {}
async function rollbackTransaction(): Promise<void> {}
