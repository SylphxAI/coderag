export function corsHeaders(origin = '*'): HeadersInit {
	return {
		'Access-Control-Allow-Origin': origin,
		'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type, Authorization',
	}
}

export function handlePreflight(req: Request): Response | null {
	if (req.method !== 'OPTIONS') return null
	return new Response(null, { status: 204, headers: corsHeaders() })
}
