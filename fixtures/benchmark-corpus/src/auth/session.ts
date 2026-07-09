export interface Session {
	id: string
	userId: string
	expiresAt: Date
}

export function createSession(userId: string, ttlMs = 86_400_000): Session {
	return {
		id: crypto.randomUUID(),
		userId,
		expiresAt: new Date(Date.now() + ttlMs),
	}
}

export function isSessionValid(session: Session): boolean {
	return session.expiresAt.getTime() > Date.now()
}
