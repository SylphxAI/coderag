export class ApiError extends Error {
	constructor(
		message: string,
		readonly status: number,
		readonly code: string
	) {
		super(message)
		this.name = 'ApiError'
	}
}

export function toErrorResponse(error: unknown): Response {
	if (error instanceof ApiError) {
		return Response.json({ error: error.code, message: error.message }, { status: error.status })
	}
	return Response.json({ error: 'internal_error' }, { status: 500 })
}
