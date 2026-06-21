# SylphxAI CodeRAG

SylphxAI/coderag is a TypeScript/Bun monorepo for hybrid code search and an MCP server for AI assistant code retrieval.

## Lifecycle

- State: `active`
- Layer: `tooling`
- Machine manifest: [`.doctrine/project.json`](./.doctrine/project.json)

## Goals

- Provide the `@sylphx/coderag` core package for hybrid TF-IDF, vector, AST chunking, indexing, and persistent search.
- Provide the `@sylphx/coderag-mcp` package as an MCP server surface for AI assistants and IDEs.
- Maintain docs, examples, tests, and package release workflows for the CodeRAG ecosystem.

## Non-Goals

- This repository does not own IDE products, AI assistant runtime policy, or downstream coding-agent behavior.
- This repository does not own embedding provider accounts, external vector services, or customer-specific codebase indexes.
- This repository does not own enterprise engineering doctrine.

## Boundary

This repository owns the CodeRAG core library, MCP server, indexing/search algorithms, persistence layer, docs, examples, tests, and release workflow. Consumers own their MCP configuration, indexed codebase policy, embedding credentials, model/provider selection, and assistant UX.

## Public Surfaces

- Repository README: [`README.md`](./README.md)
- Root package manifest and scripts: [`package.json`](./package.json)
- Core package: [`packages/core/`](./packages/core/)
- MCP server package: [`packages/mcp-server/`](./packages/mcp-server/)
- Documentation site: [`docs/`](./docs/)
- MCP docs: [`docs/mcp/`](./docs/mcp/)
- Examples: [`examples/`](./examples/)
- CI and release workflows: [`.github/workflows/`](./.github/workflows/)

## Delivery

The repository has Bun/Turborepo CI for pull requests, merge queue, and main pushes, plus a reusable main-branch release workflow. Production proof is passing typecheck, tests, package build, MCP smoke/config validation when MCP behavior changes, release workflow evidence, and package-registry/docs readback for published versions. This manifest slice is documentation-only and does not change package code, MCP behavior, CI, release, or docs deployment behavior.
