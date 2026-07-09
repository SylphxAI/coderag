import { validateEmail } from '../api/validation.js'
import { UserRepository } from '../db/repository.js'

export class UserService {
	constructor(private readonly repo = new UserRepository()) {}

	async getUser(id: string) {
		return this.repo.findById(id)
	}

	async register(email: string) {
		if (!validateEmail(email)) throw new Error('invalid email')
		const user = { id: crypto.randomUUID(), email }
		await this.repo.save(user)
		return user
	}
}
