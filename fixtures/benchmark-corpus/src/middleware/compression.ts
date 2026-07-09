export function shouldCompress(req: Request): boolean {
	const accept = req.headers.get('accept-encoding') ?? ''
	return accept.includes('gzip') || accept.includes('br')
}

export function compressBody(body: string): Uint8Array {
	return new TextEncoder().encode(body)
}
