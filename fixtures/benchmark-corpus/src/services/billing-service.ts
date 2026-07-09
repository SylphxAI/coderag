export function calculateSubscriptionPrice(seats: number, plan: 'starter' | 'pro'): number {
	const base = plan === 'starter' ? 9 : 29
	return base * Math.max(seats, 1)
}

export async function chargeCustomer(customerId: string, amountCents: number): Promise<string> {
	if (amountCents <= 0) throw new Error('invalid amount')
	return `ch_${customerId}_${amountCents}`
}
