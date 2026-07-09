export interface Migration {
	id: string
	up: string
	down: string
}

export const migrations: Migration[] = [
	{ id: '001_users', up: 'CREATE TABLE users (id TEXT PRIMARY KEY)', down: 'DROP TABLE users' },
	{
		id: '002_sessions',
		up: 'CREATE TABLE sessions (id TEXT PRIMARY KEY)',
		down: 'DROP TABLE sessions',
	},
]

export async function runMigrations(applied: Set<string>): Promise<string[]> {
	const ran: string[] = []
	for (const migration of migrations) {
		if (!applied.has(migration.id)) {
			ran.push(migration.id)
		}
	}
	return ran
}
