export interface Repository<T> {
	findById(id: string): Promise<T | null>
	save(entity: T): Promise<void>
	delete(id: string): Promise<void>
}

export class UserRepository implements Repository<{ id: string; email: string }> {
	async findById(id: string) {
		return { id, email: `${id}@example.com` }
	}

	async save(entity: { id: string; email: string }): Promise<void> {
		void entity
	}

	async delete(id: string): Promise<void> {
		void id
	}
}
