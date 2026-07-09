export async function handleHealthCheck(): Promise<Response> {
	return Response.json({ status: 'ok' })
}

export async function handleUserList(req: Request): Promise<Response> {
	const url = new URL(req.url)
	const limit = Number(url.searchParams.get('limit') ?? 10)
	return Response.json({ users: [], limit })
}

export async function handleCreateUser(req: Request): Promise<Response> {
	const body = await req.json()
	return Response.json({ created: true, user: body }, { status: 201 })
}
