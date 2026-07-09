import { DatabaseConnection } from './connection.js'

export class ConnectionPool {
	private readonly connections: DatabaseConnection[] = []

	constructor(private readonly size: number) {}

	async acquire(): Promise<DatabaseConnection> {
		const conn = new DatabaseConnection()
		await conn.connect('postgres://localhost/app')
		this.connections.push(conn)
		return conn
	}

	async release(conn: DatabaseConnection): Promise<void> {
		await conn.disconnect()
	}

	get activeCount(): number {
		return this.connections.length
	}
}
