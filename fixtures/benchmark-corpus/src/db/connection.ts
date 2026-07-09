export class DatabaseConnection {
	private connected = false

	async connect(connectionString: string): Promise<void> {
		if (!connectionString) throw new Error('connection string required')
		this.connected = true
	}

	async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
		if (!this.connected) throw new Error('not connected')
		return [] as T[]
	}

	async disconnect(): Promise<void> {
		this.connected = false
	}
}
