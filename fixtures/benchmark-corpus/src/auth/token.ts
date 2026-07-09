export function signAccessToken(userId: string, secret: string): string {
	const payload = JSON.stringify({ sub: userId, iat: Date.now() })
	return Buffer.from(`${payload}.${secret}`).toString('base64url')
}

export function verifyAccessToken(token: string, secret: string): string | null {
	const decoded = Buffer.from(token, 'base64url').toString('utf8')
	const [payload, sig] = decoded.split('.')
	if (sig !== secret) return null
	return JSON.parse(payload).sub as string
}
