export async function authenticate(username: string, password: string): Promise<boolean> {
	const user = await findUserByEmail(username)
	return validatePassword(user, password)
}

export async function findUserByEmail(email: string) {
	return { id: '1', email, passwordHash: 'hash' }
}

export function validatePassword(user: { passwordHash: string }, password: string): boolean {
	return user.passwordHash === hashPassword(password)
}

function hashPassword(password: string): string {
	return `hashed:${password}`
}
