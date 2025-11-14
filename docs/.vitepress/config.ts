import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Codebase Search',
  description: 'Intelligent codebase search with hybrid TF-IDF and vector search',
  base: '/',

  themeConfig: {
    logo: '/logo.svg',

    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'API', link: '/api/core' },
      { text: 'MCP Server', link: '/mcp/overview' },
      { text: 'GitHub', link: 'https://github.com/sylphlab/codebase-search' }
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Introduction',
          items: [
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'Installation', link: '/guide/installation' },
            { text: 'Quick Start', link: '/guide/quick-start' }
          ]
        },
        {
          text: 'Core Concepts',
          items: [
            { text: 'TF-IDF Search', link: '/guide/tfidf' },
            { text: 'Vector Search', link: '/guide/vector-search' },
            { text: 'Hybrid Search', link: '/guide/hybrid-search' },
            { text: 'Code Tokenization', link: '/guide/tokenization' }
          ]
        },
        {
          text: 'Configuration',
          items: [
            { text: 'Embedding Providers', link: '/guide/providers' },
            { text: 'Custom Providers', link: '/guide/custom-providers' },
            { text: 'Performance Tuning', link: '/guide/performance' }
          ]
        }
      ],
      '/api/': [
        {
          text: 'API Reference',
          items: [
            { text: 'Core Package', link: '/api/core' },
            { text: 'Embeddings', link: '/api/embeddings' },
            { text: 'Search', link: '/api/search' },
            { text: 'Storage', link: '/api/storage' }
          ]
        }
      ],
      '/mcp/': [
        {
          text: 'MCP Server',
          items: [
            { text: 'Overview', link: '/mcp/overview' },
            { text: 'Installation', link: '/mcp/installation' },
            { text: 'Tools', link: '/mcp/tools' },
            { text: 'Configuration', link: '/mcp/configuration' }
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/sylphlab/codebase-search' }
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024 SylphLab'
    },

    search: {
      provider: 'local'
    }
  },

  markdown: {
    theme: {
      light: 'github-light',
      dark: 'github-dark'
    },
    lineNumbers: true
  }
});
