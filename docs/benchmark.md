---
layout: doc

title: Benchmark Proof
description: Reproducible public benchmark for CodeRAG — indexing throughput and search latency on a fixed in-repo corpus.
---

# Benchmark Proof

CodeRAG public performance claims are backed by a single checked-in script and a
fixed fixture corpus — not hand-tuned marketing numbers.

## What Gets Measured

| Phase | What it proves |
| --- | --- |
| **Indexing** | Files/sec on `fixtures/benchmark-corpus/` (30 TypeScript files, AST chunking) |
| **Search** | TF-IDF search p50 / min / max latency over 20 iterations (3 warmup) |

The benchmark uses in-memory storage (`MemoryStorage`) and `lowMemoryMode: false`
to measure best-case local search latency on the fixture corpus. Results are
machine- and fixture-specific.

## Reproduce

```bash
bun install
bun run build
bun run benchmark:public-proof
```

The script prints JSON to stdout and a human-readable summary to stderr.

Example output shape:

```json
{
  "profile": "coderag-public-proof",
  "corpus": {
    "fixtureTypeScriptFiles": 30,
    "indexedFiles": "<from script>",
    "indexedChunks": "<from script>"
  },
  "indexing": {
    "durationMs": "<from script>",
    "filesPerSecond": "<from script>"
  },
  "search": {
    "iterations": 20,
    "warmupIterations": 3,
    "p50Ms": "<from script>",
    "minMs": "<from script>",
    "maxMs": "<from script>",
    "avgMs": "<from script>"
  }
}
```

> **Note:** Run the script on your machine and paste the output here when
> updating release notes. Do not edit the numbers in README or this page without
> running `bun run benchmark:public-proof`.

## Latest Run

Run `bun run benchmark:public-proof` locally to populate this table for your
environment. Commit updated numbers only from actual script output.

| Metric | Result |
| --- | --- |
| Fixture corpus | 30 TypeScript files → 31 indexed files, 71 chunks |
| Indexing throughput | **186.1 files/sec** (166.6 ms total; run 2 of 2) |
| Search p50 (TF-IDF) | **0.0 ms** (20 iterations, 3 warmup) |
| Search min / max | **0.0 ms / 0.5 ms** (avg 0.0 ms) |

## What This Proves

- **Indexing is bounded** on a fixed corpus — throughput is measurable and reproducible.
- **Search latency is bounded** on a warm index — p50/min/max come from 20 timed runs.
- **Claims stay honest** — README performance section links here; no invented MacBook tables.

## Fixture Corpus

The corpus lives at `fixtures/benchmark-corpus/src/` and covers auth, database,
API, middleware, utilities, and services modules. Do not edit fixtures without
re-running the benchmark.