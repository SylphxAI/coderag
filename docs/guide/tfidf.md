# TF-IDF and BM25

CodeRAG uses BM25, an improved version of TF-IDF, for keyword-based search. This page explains the mathematical foundations and implementation details.

## Term Frequency (TF)

Term frequency measures how often a term appears in a document (chunk).

**Formula:**

```
TF(t, d) = count(t in d) / total_terms(d)
```

Where:
- `t` = term (token)
- `d` = document (chunk)
- `count(t in d)` = number of times term t appears in document d
- `total_terms(d)` = total number of tokens in document d

**Example:**

```typescript
// Chunk: "async function fetchUser(userId) { return await api.get(userId) }"
// Tokens: ["async", "function", "fetchUser", "(", "userId", ")", "{", "return", "await", "api", ".", "get", "(", "userId", ")", "}"]
// Total: 16 tokens

TF("userId", chunk) = 2 / 16 = 0.125
TF("async", chunk)  = 1 / 16 = 0.0625
TF("return", chunk) = 1 / 16 = 0.0625
```

**Implementation:**

```typescript
function calculateTF(termFrequency: Map<string, number>): Map<string, number> {
  const totalTerms = Array.from(termFrequency.values()).reduce((sum, freq) => sum + freq, 0)
  const tf = new Map<string, number>()

  for (const [term, freq] of termFrequency.entries()) {
    tf.set(term, freq / totalTerms)
  }

  return tf
}
```

## Inverse Document Frequency (IDF)

IDF measures how rare a term is across all documents. Rare terms are more informative than common terms.

**Formula (smoothed):**

```
IDF(t) = log((N + 1) / (df(t) + 1)) + 1
```

Where:
- `N` = total number of chunks
- `df(t)` = document frequency (number of chunks containing term t)
- `+1` terms provide smoothing (prevent zero/negative values)

**Why smoothing?**

Standard IDF `log(N / df)` becomes 0 when a term appears in all documents. Smoothed IDF ensures every term has a positive score.

**Example:**

```typescript
// Index: 1000 chunks total

IDF("fetchUser")  = log((1000 + 1) / (5 + 1)) + 1    = 4.22  // Rare
IDF("async")      = log((1000 + 1) / (200 + 1)) + 1  = 2.61  // Common
IDF("function")   = log((1000 + 1) / (800 + 1)) + 1  = 1.25  // Very common
```

Rare terms like `fetchUser` get higher IDF scores.

**Implementation:**

```typescript
function calculateIDF(
  documents: Map<string, number>[],
  totalDocuments: number
): Map<string, number> {
  const documentFrequency = new Map<string, number>()

  // Count chunks containing each term
  for (const doc of documents) {
    const uniqueTerms = new Set(doc.keys())
    for (const term of uniqueTerms) {
      documentFrequency.set(term, (documentFrequency.get(term) || 0) + 1)
    }
  }

  // Calculate IDF for each term
  const idf = new Map<string, number>()
  for (const [term, docFreq] of documentFrequency.entries()) {
    idf.set(term, Math.log((totalDocuments + 1) / (docFreq + 1)) + 1)
  }

  return idf
}
```

## TF-IDF Calculation

TF-IDF combines TF and IDF to score term importance in a document.

**Formula:**

```
TF-IDF(t, d) = TF(t, d) * IDF(t)
```

**Example:**

```typescript
// Term: "fetchUser"
TF("fetchUser", chunk) = 2 / 16 = 0.125
IDF("fetchUser") = 4.22

TF-IDF("fetchUser", chunk) = 0.125 * 4.22 = 0.5275
```

**Implementation:**

```typescript
function calculateTFIDF(tf: Map<string, number>, idf: Map<string, number>): Map<string, number> {
  const tfidf = new Map<string, number>()

  for (const [term, tfScore] of tf.entries()) {
    const idfScore = idf.get(term) || 0
    tfidf.set(term, tfScore * idfScore)
  }

  return tfidf
}
```

Each chunk is represented as a TF-IDF vector (map of term to score).

## BM25 Formula

BM25 (Best Matching 25) improves TF-IDF with saturation and normalization.

**Full formula:**

```
BM25(d, q) = Σ IDF(qi) * (f(qi, d) * (k1 + 1)) / (f(qi, d) + k1 * (1 - b + b * |d| / avgdl))
             for qi in q
```

Where:
- `d` = document (chunk)
- `q` = query
- `qi` = query term i
- `f(qi, d)` = raw frequency of qi in d
- `|d|` = document length (token count)
- `avgdl` = average document length across all chunks
- `k1` = term frequency saturation parameter (default: 1.2)
- `b` = length normalization parameter (default: 0.75)
- `IDF(qi)` = inverse document frequency of qi

**Key improvements over TF-IDF:**

1. **Term frequency saturation (k1)**: Diminishing returns for repeated terms
   - A term appearing 10 times is not 10x more important than appearing once
   - k1 = 1.2 means TF plateaus around 2.2x boost

2. **Length normalization (b)**: Penalizes long chunks
   - Prevents long chunks from dominating just by containing more terms
   - b = 0.75 means 75% length normalization, 25% unchanged

**BM25 Parameters:**

```typescript
const BM25_K1 = 1.2  // Saturation: 1.2-2.0 typical
const BM25_B = 0.75  // Normalization: 0 = none, 1 = full
```

These values are industry standards from Elasticsearch and Lucene.

**Implementation:**

```typescript
export async function searchDocumentsFromStorage(
  query: string,
  candidates: StorageSearchResult[],
  idf: Map<string, number>,
  options: { avgDocLength?: number } = {}
): Promise<SearchResult[]> {
  const queryTokens = await getQueryTokens(query)

  let avgDocLength = options.avgDocLength
  if (!avgDocLength) {
    const totalTokens = candidates.reduce((sum, c) => sum + (c.tokenCount || 0), 0)
    avgDocLength = candidates.length > 0 ? totalTokens / candidates.length : 1
  }
  avgDocLength = Math.max(avgDocLength, 1)

  const results = []

  for (const candidate of candidates) {
    const matchedTerms = []
    for (const term of queryTokens) {
      if (candidate.matchedTerms.has(term)) {
        matchedTerms.push(term)
      }
    }

    if (matchedTerms.length === 0) continue

    const docLen = candidate.tokenCount || 1
    let score = 0

    for (const term of matchedTerms) {
      const termFreq = candidate.matchedTerms.get(term).rawFreq
      const termIdf = idf.get(term) || 0

      // BM25 term score
      const numerator = termFreq * (BM25_K1 + 1)
      const denominator = termFreq + BM25_K1 * (1 - BM25_B + (BM25_B * docLen) / avgDocLength)
      score += termIdf * (numerator / denominator)
    }

    results.push({ uri: `file://${candidate.path}`, score, matchedTerms })
  }

  return results.sort((a, b) => b.score - a.score)
}
```

## Code-Aware Tokenization

CodeRAG uses StarCoder2, a code-aware tokenizer that understands programming syntax.

**Why StarCoder2?**

Generic tokenizers split code incorrectly:

```typescript
// Generic tokenizer (word-based):
"getUserById" → ["get", "User", "By", "Id"]  // Broken
"snake_case"  → ["snake", "case"]            // Lost underscore

// StarCoder2:
"getUserById" → ["getUserById"]              // Preserved
"snake_case"  → ["snake_case"]               // Preserved
```

**Tokenization interface:**

```typescript
import { tokenize } from '@sylphx/coderag'

const tokens = await tokenize('async function getUserById(id: string)')
// Returns: ['async', 'function', 'getUserById', '(', 'id', ':', 'string', ')']
```

**Tokenization caching:**

Query tokens are cached to avoid re-tokenization:

```typescript
// Query token cache (LRU)
const queryTokenCache = new Map<string, string[]>()
const QUERY_CACHE_MAX_SIZE = 100

async function getCachedQueryTokens(query: string): Promise<string[]> {
  const cached = queryTokenCache.get(query)
  if (cached) return cached

  const tokens = [...new Set(await tokenize(query))]

  // LRU eviction
  if (queryTokenCache.size >= QUERY_CACHE_MAX_SIZE) {
    const firstKey = queryTokenCache.keys().next().value
    if (firstKey) queryTokenCache.delete(firstKey)
  }

  queryTokenCache.set(query, tokens)
  return tokens
}
```

Cache stores up to 100 unique queries, evicting oldest when full.

## Vector Magnitude

For cosine similarity search (used as TF-IDF fallback), vectors need normalized magnitude.

**Magnitude formula:**

```
magnitude(v) = sqrt(Σ vi^2)
```

**Implementation:**

```typescript
function calculateMagnitude(vector: Map<string, number>): number {
  let sum = 0
  for (const value of vector.values()) {
    sum += value * value
  }
  return Math.sqrt(sum)
}
```

**Cosine similarity:**

```typescript
export function calculateCosineSimilarity(
  queryVector: Map<string, number>,
  docVector: DocumentVector
): number {
  let dotProduct = 0

  for (const [term, queryScore] of queryVector.entries()) {
    const docScore = docVector.terms.get(term) || 0
    dotProduct += queryScore * docScore
  }

  const queryMagnitude = calculateMagnitude(queryVector)

  if (queryMagnitude === 0 || docVector.magnitude === 0) {
    return 0
  }

  return dotProduct / (queryMagnitude * docVector.magnitude)
}
```

Cosine similarity ranges from 0 (orthogonal) to 1 (identical).
