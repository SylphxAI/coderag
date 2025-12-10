import { defineConfig } from 'vitepress'

const title = 'CodeRAG'
const description =
	'Lightning-fast semantic code search with AST chunking - RAG-ready for AI assistants'
const url = 'https://coderag.sylphx.com'
const ogImage = `${url}/og-image.png`

export default defineConfig({
	title,
	description,
	base: '/',
	cleanUrls: true,
	ignoreDeadLinks: true,
	lastUpdated: true,

	head: [
		// Favicon
		['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
		['link', { rel: 'icon', type: 'image/png', href: '/favicon.png' }],

		// SEO
		['meta', { name: 'theme-color', content: '#6366f1' }],
		['meta', { name: 'author', content: 'Sylphx' }],
		[
			'meta',
			{
				name: 'keywords',
				content:
					'code search, RAG, retrieval augmented generation, TF-IDF, BM25, vector search, embeddings, AST, semantic search, MCP, AI assistant',
			},
		],

		// Open Graph
		['meta', { property: 'og:type', content: 'website' }],
		['meta', { property: 'og:title', content: title }],
		['meta', { property: 'og:description', content: description }],
		['meta', { property: 'og:url', content: url }],
		['meta', { property: 'og:image', content: ogImage }],
		['meta', { property: 'og:image:width', content: '1200' }],
		['meta', { property: 'og:image:height', content: '630' }],
		['meta', { property: 'og:site_name', content: 'CodeRAG' }],
		['meta', { property: 'og:locale', content: 'en_US' }],

		// Twitter Card
		['meta', { name: 'twitter:card', content: 'summary_large_image' }],
		['meta', { name: 'twitter:title', content: title }],
		['meta', { name: 'twitter:description', content: description }],
		['meta', { name: 'twitter:image', content: ogImage }],
		['meta', { name: 'twitter:site', content: '@SylphxAI' }],

		// Canonical
		['link', { rel: 'canonical', href: url }],
	],

	sitemap: {
		hostname: url,
	},

	themeConfig: {
		logo: '/logo.svg',
		siteTitle: 'CodeRAG',

		nav: [
			{ text: 'Guide', link: '/guide/getting-started' },
			{ text: 'API', link: '/api/overview' },
			{ text: 'MCP Server', link: '/mcp/overview' },
			{
				text: 'Resources',
				items: [
					{ text: 'GitHub', link: 'https://github.com/SylphxAI/coderag' },
					{ text: 'npm', link: 'https://www.npmjs.com/package/@sylphx/coderag' },
					{ text: 'Changelog', link: 'https://github.com/SylphxAI/coderag/releases' },
				],
			},
		],

		sidebar: {
			'/guide/': [
				{
					text: 'Introduction',
					items: [
						{ text: 'What is CodeRAG?', link: '/guide/getting-started' },
						{ text: 'Installation', link: '/guide/installation' },
						{ text: 'Quick Start', link: '/guide/quick-start' },
					],
				},
				{
					text: 'Core Concepts',
					items: [
						{ text: 'How Search Works', link: '/guide/how-search-works' },
						{ text: 'AST Chunking', link: '/guide/ast-chunking' },
						{ text: 'TF-IDF & BM25', link: '/guide/tfidf' },
						{ text: 'Vector Search', link: '/guide/vector-search' },
						{ text: 'Hybrid Search', link: '/guide/hybrid-search' },
					],
				},
				{
					text: 'Advanced',
					items: [
						{ text: 'Persistent Storage', link: '/guide/storage' },
						{ text: 'File Watching', link: '/guide/file-watching' },
						{ text: 'Language Support', link: '/guide/languages' },
						{ text: 'Performance Tuning', link: '/guide/performance' },
					],
				},
			],
			'/api/': [
				{
					text: 'API Reference',
					items: [
						{ text: 'Overview', link: '/api/overview' },
						{ text: 'CodebaseIndexer', link: '/api/indexer' },
						{ text: 'PersistentStorage', link: '/api/storage' },
						{ text: 'Search Functions', link: '/api/search' },
						{ text: 'Embedding Providers', link: '/api/embeddings' },
						{ text: 'AST Chunking', link: '/api/chunking' },
						{ text: 'Types', link: '/api/types' },
					],
				},
			],
			'/mcp/': [
				{
					text: 'MCP Server',
					items: [
						{ text: 'Overview', link: '/mcp/overview' },
						{ text: 'Installation', link: '/mcp/installation' },
						{ text: 'Configuration', link: '/mcp/configuration' },
						{ text: 'Tools Reference', link: '/mcp/tools' },
						{ text: 'IDE Integration', link: '/mcp/ide-integration' },
					],
				},
			],
		},

		socialLinks: [
			{ icon: 'github', link: 'https://github.com/SylphxAI/coderag' },
			{ icon: 'npm', link: 'https://www.npmjs.com/package/@sylphx/coderag' },
		],

		footer: {
			message: 'Released under the MIT License.',
			copyright: 'Copyright © 2024 Sylphx',
		},

		search: {
			provider: 'local',
			options: {
				detailedView: true,
			},
		},

		editLink: {
			pattern: 'https://github.com/SylphxAI/coderag/edit/main/docs/:path',
			text: 'Edit this page on GitHub',
		},

		outline: {
			level: [2, 3],
		},

		lastUpdated: {
			text: 'Last updated',
			formatOptions: {
				dateStyle: 'medium',
			},
		},
	},

	markdown: {
		theme: {
			light: 'github-light',
			dark: 'github-dark',
		},
		lineNumbers: true,
	},
})
