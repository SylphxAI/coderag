export type Handler = (req: Request) => Promise<Response>

export class Router {
	private routes = new Map<string, Handler>()

	get(path: string, handler: Handler): void {
		this.routes.set(`GET:${path}`, handler)
	}

	post(path: string, handler: Handler): void {
		this.routes.set(`POST:${path}`, handler)
	}

	async handle(req: Request): Promise<Response> {
		const key = `${req.method}:${new URL(req.url).pathname}`
		const handler = this.routes.get(key)
		if (!handler) return new Response('not found', { status: 404 })
		return handler(req)
	}
}
