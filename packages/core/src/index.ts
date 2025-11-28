/**
 * @codebase-search/core
 * Core library for intelligent codebase search using TF-IDF
 */

export {
	type ASTChunkOptions,
	type ChunkResult,
	chunkCodeByAST,
	chunkCodeByASTSimple,
	getSupportedLanguages,
} from './ast-chunking.js'
export { getCoderagDataDir, type ProjectMetadata } from './db/client.js'
export {
	chunkText,
	composeProviders,
	cosineSimilarity,
	createDefaultConfig,
	createEmbeddingProvider,
	createMockProvider,
	createOpenAIProvider,
	type EmbeddingConfig,
	type EmbeddingProvider,
	generateMockEmbedding,
	getDefaultEmbeddingProvider,
	normalizeVector,
} from './embeddings.js'
export {
	type HybridSearchOptions,
	type HybridSearchResult,
	hybridSearch,
	keywordSearch,
	semanticSearch,
} from './hybrid-search.js'
export {
	type IncrementalStats,
	IncrementalTFIDF,
	type IncrementalUpdate,
} from './incremental-tfidf.js'
// Re-export main components
export {
	CodebaseIndexer,
	type FileChangeEvent,
	type FileDiff,
	type IndexerOptions,
	type IndexingStatus,
	type SearchResult,
} from './indexer.js'
export {
	type EmbeddedLanguageConfig,
	EXTENSION_TO_LANGUAGE,
	getLanguageConfig,
	getLanguageConfigByExtension,
	getLanguageFromPath,
	getSupportedExtensions,
	isLanguageSupported,
	LANGUAGE_REGISTRY,
	type LanguageConfig,
} from './language-config.js'
export { type CacheEntry, type CacheStats, createCacheKey, LRUCache } from './search-cache.js'
export { type CodebaseFile, MemoryStorage } from './storage.js'
export { PersistentStorage } from './storage-persistent.js'
export {
	buildSearchIndex,
	calculateCosineSimilarity,
	type DocumentVector,
	processQuery,
	type SearchIndex,
	searchDocuments,
} from './tfidf.js'
export {
	detectLanguage,
	isTextFile,
	loadGitignore,
	type ScanOptions,
	type ScanResult,
	scanFiles,
	simpleHash,
} from './utils.js'
export {
	type VectorDocument,
	type VectorSearchResult,
	VectorStorage,
	type VectorStorageOptions,
	type VectorStorageStats,
} from './vector-storage.js'
