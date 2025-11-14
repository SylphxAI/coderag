# Embedding Providers 配置指南

## 支援的 Provider

我地用 Vercel AI SDK，支援任何 OpenAI-compatible embedding provider：

- ✅ **OpenAI** (官方)
- ✅ **OpenRouter** (多模型聚合)
- ✅ **Together AI**
- ✅ **Fireworks AI**
- ✅ **任何 OpenAI-compatible endpoint**

---

## 配置方式

### 方式 1: 環境變數（推薦）

```bash
# OpenAI (官方)
export OPENAI_API_KEY="sk-..."
export EMBEDDING_MODEL="text-embedding-3-small"  # 可選，默認值

# OpenRouter
export OPENAI_API_KEY="sk-or-v1-..."
export OPENAI_BASE_URL="https://openrouter.ai/api/v1"
export EMBEDDING_MODEL="text-embedding-3-small"
export EMBEDDING_DIMENSIONS="1536"

# Together AI
export OPENAI_API_KEY="..."
export OPENAI_BASE_URL="https://api.together.xyz/v1"
export EMBEDDING_MODEL="togethercomputer/m2-bert-80M-8k-retrieval"
export EMBEDDING_DIMENSIONS="768"

# 自定義 endpoint
export OPENAI_API_KEY="your-api-key"
export OPENAI_BASE_URL="https://your-endpoint.com/v1"
export EMBEDDING_MODEL="your-model"
export EMBEDDING_DIMENSIONS="1536"
```

### 方式 2: 代碼配置

```typescript
import { createEmbeddingProvider } from '@sylphx/codebase-search';

// OpenAI (官方)
const openaiProvider = createEmbeddingProvider({
  provider: 'openai',
  model: 'text-embedding-3-small',
  dimensions: 1536,
  apiKey: 'sk-...',
});

// OpenRouter
const openrouterProvider = createEmbeddingProvider({
  provider: 'openai-compatible',
  model: 'text-embedding-3-small',
  dimensions: 1536,
  apiKey: 'sk-or-v1-...',
  baseURL: 'https://openrouter.ai/api/v1',
});

// Together AI
const togetherProvider = createEmbeddingProvider({
  provider: 'openai-compatible',
  model: 'togethercomputer/m2-bert-80M-8k-retrieval',
  dimensions: 768,
  apiKey: '...',
  baseURL: 'https://api.together.xyz/v1',
});

// 任何 OpenAI-compatible endpoint
const customProvider = createEmbeddingProvider({
  provider: 'openai-compatible',
  model: 'your-model',
  dimensions: 1536,
  apiKey: 'your-key',
  baseURL: 'https://your-endpoint.com/v1',
});
```

---

## Provider 詳細配置

### 1. OpenAI (官方) ✅

**優點：** 質量最高，速度快
**缺點：** 需要 API key，有費用

```bash
# 環境變數
export OPENAI_API_KEY="sk-..."
export EMBEDDING_MODEL="text-embedding-3-small"  # 可選
```

**支援的模型：**
- `text-embedding-3-small` (1536 dims) - **推薦**，性價比最高
- `text-embedding-3-large` (3072 dims) - 最高質量
- `text-embedding-ada-002` (1536 dims) - 舊版

**費用：**
- `text-embedding-3-small`: $0.02 / 1M tokens
- `text-embedding-3-large`: $0.13 / 1M tokens

---

### 2. OpenRouter 🔄

**優點：**
- 支援多個模型（OpenAI, Cohere, etc.）
- 單一 API key
- 費用透明

**缺點：** 略慢於直連

```bash
# 環境變數
export OPENAI_API_KEY="sk-or-v1-..."
export OPENAI_BASE_URL="https://openrouter.ai/api/v1"
export EMBEDDING_MODEL="text-embedding-3-small"
export EMBEDDING_DIMENSIONS="1536"
```

**獲取 API key:** https://openrouter.ai/keys

**支援的 embedding 模型：**
- `openai/text-embedding-3-small`
- `openai/text-embedding-3-large`
- `openai/text-embedding-ada-002`

**代碼示例：**
```typescript
const provider = createEmbeddingProvider({
  provider: 'openai-compatible',
  model: 'openai/text-embedding-3-small',
  dimensions: 1536,
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
});
```

---

### 3. Together AI 🚀

**優點：**
- 開源模型
- 價格便宜
- 支援多種 embedding 模型

**缺點：** 質量略低於 OpenAI

```bash
# 環境變數
export OPENAI_API_KEY="..."
export OPENAI_BASE_URL="https://api.together.xyz/v1"
export EMBEDDING_MODEL="togethercomputer/m2-bert-80M-8k-retrieval"
export EMBEDDING_DIMENSIONS="768"
```

**獲取 API key:** https://api.together.xyz/settings/api-keys

**支援的 embedding 模型：**
- `togethercomputer/m2-bert-80M-8k-retrieval` (768 dims)
- `togethercomputer/m2-bert-80M-32k-retrieval` (768 dims)
- `WhereIsAI/UAE-Large-V1` (1024 dims)
- `BAAI/bge-large-en-v1.5` (1024 dims)

**代碼示例：**
```typescript
const provider = createEmbeddingProvider({
  provider: 'openai-compatible',
  model: 'togethercomputer/m2-bert-80M-8k-retrieval',
  dimensions: 768,
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: 'https://api.together.xyz/v1',
});
```

---

### 4. Fireworks AI 🔥

**優點：** 快速，支援多種模型
**缺點：** Embedding 模型選擇較少

```bash
# 環境變數
export OPENAI_API_KEY="..."
export OPENAI_BASE_URL="https://api.fireworks.ai/inference/v1"
export EMBEDDING_MODEL="nomic-ai/nomic-embed-text-v1.5"
export EMBEDDING_DIMENSIONS="768"
```

**獲取 API key:** https://fireworks.ai/api-keys

---

### 5. 本地 Ollama + OpenAI-compatible API

**優點：**
- 完全免費
- 離線可用
- 隱私保護

**缺點：** 需要本地運行，質量較低

```bash
# 1. 安裝 Ollama
brew install ollama

# 2. 啟動 Ollama
ollama serve

# 3. 下載 embedding 模型
ollama pull nomic-embed-text

# 4. 配置
export OPENAI_API_KEY="ollama"  # 任意值
export OPENAI_BASE_URL="http://localhost:11434/v1"
export EMBEDDING_MODEL="nomic-embed-text"
export EMBEDDING_DIMENSIONS="768"
```

**代碼示例：**
```typescript
const provider = createEmbeddingProvider({
  provider: 'openai-compatible',
  model: 'nomic-embed-text',
  dimensions: 768,
  apiKey: 'ollama', // Ollama 不驗證 API key
  baseURL: 'http://localhost:11434/v1',
});
```

---

## 使用示例

### 完整配置示例

```typescript
import { CodebaseIndexer, createEmbeddingProvider } from '@sylphx/codebase-search';

// 1. 創建 embedding provider
const embeddingProvider = createEmbeddingProvider({
  provider: 'openai-compatible',
  model: 'text-embedding-3-small',
  dimensions: 1536,
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL, // 可選
});

// 2. 創建 indexer（會自動使用 embedding provider）
const indexer = new CodebaseIndexer({
  codebaseRoot: '/path/to/project',
  embeddingProvider, // 傳入自定義 provider
});

// 3. 索引和搜索
await indexer.index();
const results = await indexer.search('user authentication');
```

### 自動配置（從環境變數）

```typescript
import { CodebaseIndexer } from '@sylphx/codebase-search';

// 自動從環境變數讀取配置
const indexer = new CodebaseIndexer({
  codebaseRoot: '/path/to/project',
  // embeddingProvider 自動從 OPENAI_API_KEY, OPENAI_BASE_URL 等創建
});

await indexer.index();
```

---

## 環境變數總結

| 變數 | 說明 | 必須 | 默認值 |
|------|------|------|--------|
| `OPENAI_API_KEY` | API Key | ✅ | - |
| `OPENAI_BASE_URL` | 自定義 endpoint | ❌ | `https://api.openai.com/v1` |
| `EMBEDDING_MODEL` | 模型名稱 | ❌ | `text-embedding-3-small` |
| `EMBEDDING_DIMENSIONS` | Embedding 維度 | ❌ | 自動偵測 |

---

## Provider 選擇建議

### 生產環境推薦：

1. **OpenAI** (官方) - 質量最高，速度快
   - 適合：追求最佳質量
   - 費用：中等（$0.02/1M tokens）

2. **OpenRouter** - 靈活性高，支援多模型
   - 適合：需要切換不同模型
   - 費用：與 OpenAI 相近

3. **Together AI** - 開源模型，便宜
   - 適合：預算有限
   - 費用：較低

### 開發/測試環境：

1. **Mock Provider** (內建)
   - 完全免費
   - 確定性輸出
   - 適合單元測試

2. **Ollama** (本地)
   - 免費
   - 離線可用
   - 適合開發測試

---

## 故障排查

### 問題 1: API Key 無效

```
Error: 401 Unauthorized
```

**解決方案：**
1. 檢查 API key 是否正確
2. 檢查 API key 是否過期
3. 檢查 provider 網站的 API key 設置

### 問題 2: 模型不支持

```
Error: Model not found
```

**解決方案：**
1. 檢查模型名稱是否正確
2. 查看 provider 文檔確認支援的模型
3. 確認 baseURL 是否正確

### 問題 3: Dimensions 不匹配

```
Error: Vector dimension mismatch
```

**解決方案：**
1. 明確設置 `EMBEDDING_DIMENSIONS` 環境變數
2. 或在代碼中指定 `dimensions` 參數
3. 確認模型的實際輸出維度

---

## 常見問題

### Q: 可以同時使用多個 provider 嗎？

A: 可以！使用 `composeProviders()` 設置 fallback：

```typescript
import { createEmbeddingProvider, composeProviders } from '@sylphx/codebase-search';

const primary = createEmbeddingProvider({
  provider: 'openai',
  model: 'text-embedding-3-small',
  dimensions: 1536,
  apiKey: process.env.OPENAI_API_KEY,
});

const fallback = createEmbeddingProvider({
  provider: 'openai-compatible',
  model: 'nomic-embed-text',
  dimensions: 768,
  apiKey: 'ollama',
  baseURL: 'http://localhost:11434/v1',
});

// 主用 OpenAI，失敗時用 Ollama
const composed = composeProviders(primary, fallback);
```

### Q: 如何選擇 embedding dimensions？

A: 建議：
- **1536 dims** - OpenAI text-embedding-3-small（推薦）
- **3072 dims** - OpenAI text-embedding-3-large（最高質量）
- **768 dims** - 開源模型（較低質量但便宜）

### Q: 費用如何估算？

A:
```
費用 = (代碼行數 × 平均行長度 / 4) × (tokens 單價)

例如：10,000 行代碼，平均 80 字符/行
Tokens ≈ 10000 × 80 / 4 = 200,000 tokens = 0.2M tokens
費用 (OpenAI) ≈ 0.2 × $0.02 = $0.004 (非常便宜！)
```

---

## 更多資源

- [Vercel AI SDK 文檔](https://sdk.vercel.ai/docs)
- [OpenRouter API 文檔](https://openrouter.ai/docs)
- [Together AI 文檔](https://docs.together.ai/)
- [Ollama 文檔](https://ollama.ai/docs)
