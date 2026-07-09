import { toErrorResponse } from '../api/errors.js'

export async function errorHandler(fn: () => Promise<Response>): Promise<Response> {
	try {
		return await fn()
	} catch (error) {
		return toErrorResponse(error)
	}
}
