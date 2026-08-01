/**
 * Code-aware tokenizer.
 *
 * Default path: pure local simple code tokenizer (zero heavy deps).
 * Optional path: StarCoder2 tokenizer via optional `@huggingface/transformers`.
 */

export interface CodeToken {
	readonly text: string
	readonly id: number
}

export interface TokenizerOptions {
	readonly modelPath?: string
	readonly cacheDir?: string
	/** Force simple tokenizer even if transformers is installed. */
	readonly preferSimple?: boolean
}

/** Pure local tokenizer: camelCase / snake / identifiers — no network, no ML wheels. */
export function simpleCodeTokenize(code: string): string[] {
	if (!code || code.trim().length === 0) {
		return []
	}

	const tokens: string[] = []
	// Split identifiers and words; expand camelCase and snake_case lightly.
	const parts = code.match(/[A-Za-z_][A-Za-z0-9_]*|[0-9]+/g) ?? []
	for (const part of parts) {
		const camel = part.replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(/[_\s]+/)
		for (const piece of camel) {
			const cleaned = piece.trim().toLowerCase()
			if (cleaned.length > 1) {
				tokens.push(cleaned)
			}
		}
	}
	return tokens
}

type AutoTokenizerModule = {
	AutoTokenizer: {
		from_pretrained: (modelPath: string) => Promise<unknown>
	}
}

async function tryLoadTransformers(): Promise<AutoTokenizerModule | null> {
	try {
		// optionalDependency — must not be a static hard import
		const mod = (await import('@huggingface/transformers')) as AutoTokenizerModule
		return mod
	} catch {
		return null
	}
}

/**
 * Code tokenizer with optional StarCoder2 backend.
 * Falls back to simple local tokenization when HF is absent or fails.
 */
export class CodeTokenizer {
	private tokenizer: unknown
	private initialized = false
	private initPromise: Promise<void> | null = null
	private modelPath: string
	private preferSimple: boolean
	private backend: 'simple' | 'starcoder2' = 'simple'

	constructor(options: TokenizerOptions = {}) {
		this.modelPath = options.modelPath || 'bigcode/starcoder2-15b'
		// Local-first default: simple tokenizer. Opt into StarCoder2 with
		// CODERAG_TOKENIZER=starcoder2 (requires optional @huggingface/transformers).
		const envMode = process.env.CODERAG_TOKENIZER || process.env.LOCUS_TOKENIZER || 'simple'
		this.preferSimple =
			options.preferSimple === true
				? true
				: options.preferSimple === false
					? false
					: envMode !== 'starcoder2'
	}

	backendName(): 'simple' | 'starcoder2' {
		return this.backend
	}

	async initialize(): Promise<void> {
		if (this.initialized) {
			return
		}
		if (this.initPromise) {
			return this.initPromise
		}
		this.initPromise = this.doInitialize()
		return this.initPromise
	}

	private async doInitialize(): Promise<void> {
		if (this.preferSimple) {
			this.backend = 'simple'
			this.initialized = true
			return
		}

		const transformers = await tryLoadTransformers()
		if (!transformers) {
			console.error(
				'[INFO] @huggingface/transformers not installed — using simple local code tokenizer (zero-config).'
			)
			this.backend = 'simple'
			this.initialized = true
			return
		}

		try {
			console.error('[INFO] Loading optional StarCoder2 tokenizer (one-time download)...')
			const startTime = Date.now()
			this.tokenizer = await transformers.AutoTokenizer.from_pretrained(this.modelPath)
			console.error(`[SUCCESS] Optional tokenizer loaded in ${Date.now() - startTime}ms`)
			this.backend = 'starcoder2'
			this.initialized = true
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			console.error(
				`[WARN] Optional StarCoder2 tokenizer failed (${message}); using simple local tokenizer.`
			)
			this.backend = 'simple'
			this.initialized = true
			this.initPromise = null
		}
	}

	async tokenize(code: string): Promise<string[]> {
		if (!this.initialized) {
			await this.initialize()
		}

		if (!code || code.trim().length === 0) {
			return []
		}

		if (this.backend === 'simple' || !this.tokenizer) {
			return simpleCodeTokenize(code)
		}

		const tokenizer = this.tokenizer as {
			(code: string): Promise<{ input_ids: { tolist: () => number[][] } }>
			decode: (ids: number[], opts: { skip_special_tokens: boolean }) => Promise<string>
		}
		const encoded = await tokenizer(code)
		const inputIds = encoded.input_ids.tolist()[0]
		const tokens: string[] = []
		for (const id of inputIds) {
			const token = await tokenizer.decode([id], {
				skip_special_tokens: true,
			})
			const cleaned = token.trim().toLowerCase()
			if (cleaned.length > 1) {
				tokens.push(cleaned)
			}
		}
		return tokens
	}

	async extractTerms(code: string): Promise<Map<string, number>> {
		const tokens = await this.tokenize(code)
		const termFreq = new Map<string, number>()
		for (const token of tokens) {
			termFreq.set(token, (termFreq.get(token) || 0) + 1)
		}
		return termFreq
	}

	isReady(): boolean {
		return this.initialized
	}
}

let globalTokenizer: CodeTokenizer | null = null

export function getTokenizer(): CodeTokenizer {
	if (!globalTokenizer) {
		globalTokenizer = new CodeTokenizer()
	}
	return globalTokenizer
}

export async function tokenize(code: string): Promise<string[]> {
	return getTokenizer().tokenize(code)
}

export async function extractTerms(code: string): Promise<Map<string, number>> {
	return getTokenizer().extractTerms(code)
}

export async function initializeTokenizer(): Promise<void> {
	return getTokenizer().initialize()
}
