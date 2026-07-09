const buckets = new Map<string, { count: number; resetAt: number }>()

export function checkRateLimit(key: string, limit = 100, windowMs = 60_000): boolean {
	const now = Date.now()
	const bucket = buckets.get(key)
	if (!bucket || bucket.resetAt < now) {
		buckets.set(key, { count: 1, resetAt: now + windowMs })
		return true
	}
	if (bucket.count >= limit) return false
	bucket.count += 1
	return true
}
