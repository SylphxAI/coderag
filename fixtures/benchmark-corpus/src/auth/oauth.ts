export async function exchangeOAuthCode(code: string, redirectUri: string) {
	const response = await fetch('https://oauth.example/token', {
		method: 'POST',
		body: JSON.stringify({ code, redirectUri }),
	})
	return response.json()
}

export function buildAuthorizationUrl(clientId: string, scope: string[]): string {
	const params = new URLSearchParams({ client_id: clientId, scope: scope.join(' ') })
	return `https://oauth.example/authorize?${params}`
}
