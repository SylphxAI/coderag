import { describe, expect, it } from 'vitest'
import { CodeTokenizer, simpleCodeTokenize } from './code-tokenizer.js'

describe('simple local code tokenizer (zero heavy deps)', () => {
	it('tokenizes camelCase and snake_case without HF', () => {
		const tokens = simpleCodeTokenize('getUserData authenticate_user login')
		expect(tokens).toEqual(expect.arrayContaining(['get', 'user', 'data', 'authenticate', 'user', 'login']))
	})

	it('CodeTokenizer defaults to simple when preferSimple', async () => {
		const tok = new CodeTokenizer({ preferSimple: true })
		await tok.initialize()
		expect(tok.backendName()).toBe('simple')
		const tokens = await tok.tokenize('findUserByEmail')
		expect(tokens.some((t) => t.includes('user') || t.includes('find') || t.includes('email'))).toBe(true)
	})
})
