import { verifyAccessToken } from '../auth/token.js'

export async function authMiddleware(req: Request, secret: string): Promise<Request | Response> {
	const header = req.headers.get('authorization')
	if (!header?.startsWith('Bearer ')) {
		return new Response('unauthorized', { status: 401 })
	}
	const userId = verifyAccessToken(header.slice(7), secret)
	if (!userId) return new Response('invalid token', { status: 401 })
	return req
}
