export interface Notification {
	userId: string
	channel: 'email' | 'sms' | 'push'
	message: string
}

export async function sendNotification(notification: Notification): Promise<void> {
	console.error(`notify:${notification.channel} -> ${notification.userId}`)
}

export async function sendWelcomeEmail(userId: string, email: string): Promise<void> {
	await sendNotification({ userId, channel: 'email', message: `Welcome ${email}` })
}
