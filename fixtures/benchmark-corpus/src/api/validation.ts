export function validateEmail(email: string): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function validatePasswordStrength(password: string): boolean {
	return password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password)
}

export function parsePagination(searchParams: URLSearchParams) {
	return {
		limit: Math.min(Number(searchParams.get('limit') ?? 20), 100),
		offset: Number(searchParams.get('offset') ?? 0),
	}
}
